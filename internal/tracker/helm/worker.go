package helm

import (
	"errors"
	"fmt"
	"image"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"
	"strings"
	"sync"
	"time"

	"github.com/artifacthub/hub/internal/hub"
	"github.com/artifacthub/hub/internal/license"
	"github.com/artifacthub/hub/internal/tracker"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/vincent-petithory/dataurl"
	"golang.org/x/time/rate"
	"helm.sh/helm/v3/pkg/chart"
	"helm.sh/helm/v3/pkg/chart/loader"
)

// githubRL represents a rate limiter used when loading charts from Github, to
// avoid some rate limiting issues were are experiencing.
var githubRL = rate.NewLimiter(2, 1)

// Worker is in charge of handling Helm packages register and unregister jobs
// generated by the tracker.
type Worker struct {
	svc    *tracker.Services
	r      *hub.Repository
	hg     HTTPGetter
	logger zerolog.Logger
}

// NewWorker creates a new worker instance.
func NewWorker(
	svc *tracker.Services,
	r *hub.Repository,
	opts ...func(w *Worker),
) *Worker {
	w := &Worker{
		svc:    svc,
		r:      r,
		logger: log.With().Str("repo", r.Name).Str("kind", hub.GetKindName(r.Kind)).Logger(),
	}
	for _, o := range opts {
		o(w)
	}
	if w.hg == nil {
		w.hg = &http.Client{Timeout: 10 * time.Second}
	}
	return w
}

// Run instructs the worker to start handling jobs. It will keep running until
// the jobs queue is empty or the context is done.
func (w *Worker) Run(wg *sync.WaitGroup, queue chan *Job) {
	defer wg.Done()
	for {
		select {
		case j, ok := <-queue:
			if !ok {
				return
			}
			switch j.Kind {
			case Register:
				w.handleRegisterJob(j)
			case Unregister:
				w.handleUnregisterJob(j)
			}
		case <-w.svc.Ctx.Done():
			return
		}
	}
}

// handleRegisterJob handles the provided Helm package registration job. This
// involves downloading the chart archive, extracting its contents and register
// the corresponding package.
func (w *Worker) handleRegisterJob(j *Job) {
	// Prepare chart archive url
	u := j.ChartVersion.URLs[0]
	if _, err := url.ParseRequestURI(u); err != nil {
		tmp, err := url.Parse(w.r.URL)
		if err != nil {
			w.warn(fmt.Errorf("invalid chart url: %w", err))
			return
		}
		tmp.Path = path.Join(tmp.Path, u)
		u = tmp.String()
	}

	// Load chart from remote archive
	chart, err := w.loadChart(u)
	if err != nil {
		w.warn(fmt.Errorf("error loading chart: %w", err))
		return
	}
	md := chart.Metadata

	// Store logo when available if requested
	var logoURL, logoImageID string
	if j.StoreLogo && md.Icon != "" {
		logoURL = md.Icon
		data, err := w.getImage(md.Icon)
		if err != nil {
			w.warn(fmt.Errorf("error getting image %s: %w", md.Icon, err))
		} else {
			logoImageID, err = w.svc.Is.SaveImage(w.svc.Ctx, data)
			if err != nil && !errors.Is(err, image.ErrFormat) {
				w.warn(fmt.Errorf("error saving image %s: %w", md.Icon, err))
			}
		}
	}

	// Prepare package to be registered
	p := &hub.Package{
		Name:        md.Name,
		LogoURL:     logoURL,
		LogoImageID: logoImageID,
		Description: md.Description,
		Keywords:    md.Keywords,
		HomeURL:     md.Home,
		Version:     md.Version,
		AppVersion:  md.AppVersion,
		Digest:      j.ChartVersion.Digest,
		Deprecated:  md.Deprecated,
		ContentURL:  u,
		CreatedAt:   j.ChartVersion.Created.Unix(),
		Repository:  w.r,
	}
	readme := getFile(chart, "README.md")
	if readme != nil {
		p.Readme = string(readme.Data)
	}
	licenseFile := getFile(chart, "LICENSE")
	if licenseFile != nil {
		p.License = license.Detect(licenseFile.Data)
	}
	hasProvenanceFile, err := w.chartVersionHasProvenanceFile(u)
	if err == nil {
		p.Signed = hasProvenanceFile
	} else {
		w.logger.Warn().Err(err).Msg("error checking provenance file")
	}
	var maintainers []*hub.Maintainer
	for _, entry := range md.Maintainers {
		if entry.Email != "" {
			maintainers = append(maintainers, &hub.Maintainer{
				Name:  entry.Name,
				Email: entry.Email,
			})
		}
	}
	if len(maintainers) > 0 {
		p.Maintainers = maintainers
	}
	if strings.Contains(strings.ToLower(md.Name), "operator") {
		p.IsOperator = true
	}
	dependencies := make([]map[string]string, 0, len(md.Dependencies))
	for _, dependency := range md.Dependencies {
		dependencies = append(dependencies, map[string]string{
			"name":       dependency.Name,
			"version":    dependency.Version,
			"repository": dependency.Repository,
		})
	}
	if len(dependencies) > 0 {
		p.Data = map[string]interface{}{
			"dependencies": dependencies,
		}
	}

	// Register package
	w.logger.Debug().Str("name", md.Name).Str("v", md.Version).Msg("registering package")
	if err := w.svc.Pm.Register(w.svc.Ctx, p); err != nil {
		w.warn(fmt.Errorf("error registering package %s version %s: %w", md.Name, md.Version, err))
	}
}

// handleUnregisterJob handles the provided Helm package unregistration job.
// This involves deleting the package version corresponding to a given chart
// version.
func (w *Worker) handleUnregisterJob(j *Job) {
	// Unregister package
	p := &hub.Package{
		Name:       j.ChartVersion.Name,
		Version:    j.ChartVersion.Version,
		Repository: w.r,
	}
	w.logger.Debug().Str("name", p.Name).Str("v", p.Version).Msg("unregistering package")
	if err := w.svc.Pm.Unregister(w.svc.Ctx, p); err != nil {
		w.warn(fmt.Errorf("error unregistering package %s version %s: %w", p.Name, p.Version, err))
	}
}

// loadChart loads a chart from a remote archive located at the url provided.
func (w *Worker) loadChart(u string) (*chart.Chart, error) {
	// Rate limit requests to Github to avoid them being rejected
	if strings.HasPrefix(u, "https://github.com") {
		_ = githubRL.Wait(w.svc.Ctx)
	}

	resp, err := w.hg.Get(u)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		chart, err := loader.LoadArchive(resp.Body)
		if err != nil {
			return nil, err
		}
		return chart, nil
	}
	return nil, fmt.Errorf("unexpected status code received: %d", resp.StatusCode)
}

// chartVersionHasProvenanceFile checks if a chart version has a provenance
// file checking if a .prov file exists for the chart version url provided.
func (w *Worker) chartVersionHasProvenanceFile(u string) (bool, error) {
	resp, err := w.hg.Get(u + ".prov")
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		return true, nil
	}
	return false, nil
}

// getImage gets the image located at the url provided. If it's a data url the
// image is extracted from it. Otherwise it's downloaded using the url.
func (w *Worker) getImage(u string) ([]byte, error) {
	// Image in data url
	if strings.HasPrefix(u, "data:") {
		dataURL, err := dataurl.DecodeString(u)
		if err != nil {
			return nil, err
		}
		return dataURL.Data, nil
	}

	// Download image using url provided
	resp, err := w.hg.Get(u)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		return ioutil.ReadAll(resp.Body)
	}
	return nil, fmt.Errorf("unexpected status code received: %d", resp.StatusCode)
}

// warn is a helper that sends the error provided to the errors collector and
// logs it as a warning.
func (w *Worker) warn(err error) {
	w.svc.Ec.Append(w.r.RepositoryID, err)
	w.logger.Warn().Err(err).Send()
}

// HTTPGetter defines the methods an HTTPGetter implementation must provide.
type HTTPGetter interface {
	Get(url string) (*http.Response, error)
}

// getFile returns the file requested from the provided chart.
func getFile(chart *chart.Chart, name string) *chart.File {
	for _, file := range chart.Files {
		if file.Name == name {
			return file
		}
	}
	return nil
}
