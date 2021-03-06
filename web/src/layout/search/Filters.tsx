import classnames from 'classnames';
import find from 'lodash/find';
import isEmpty from 'lodash/isEmpty';
import isNull from 'lodash/isNull';
import isUndefined from 'lodash/isUndefined';
import React from 'react';
import { IoMdCloseCircleOutline } from 'react-icons/io';

import { Facets } from '../../types';
import CheckBox from '../common/Checkbox';
import SmallTitle from '../common/SmallTitle';
import Facet from './Facet';
import styles from './Filters.module.css';
import TsQuery from './TsQuery';

interface Props {
  activeFilters: {
    [key: string]: string[];
  };
  activeTsQuery?: string[];
  facets: Facets[] | null;
  visibleTitle: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTsQueryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeprecatedChange: () => void;
  onOperatorsChange: () => void;
  onResetFilters: () => void;
  onFacetExpandableChange: (filterKey: string, open: boolean) => void;
  deprecated?: boolean | null;
  operators?: boolean | null;
  expandedList?: string;
}

const Filters = (props: Props) => {
  const getFacetsByFilterKey = (filterKey: string): Facets | undefined => {
    return find(props.facets, (facets: Facets) => filterKey === facets.filterKey);
  };

  const getPublishers = (): JSX.Element | null => {
    let publishersList = null;
    if (!isNull(props.facets)) {
      const user = getFacetsByFilterKey('user');
      let userElement = null;
      if (!isUndefined(user)) {
        userElement = (
          <Facet
            {...user}
            onChange={props.onChange}
            active={props.activeFilters.hasOwnProperty(user.filterKey) ? props.activeFilters[user.filterKey] : []}
            isExpanded={props.expandedList === user.filterKey}
            onFacetExpandableChange={props.onFacetExpandableChange}
            displaySubtitle
          />
        );
      }

      const org = getFacetsByFilterKey('org');
      let orgElement = null;
      if (!isUndefined(org)) {
        orgElement = (
          <Facet
            {...org}
            onChange={props.onChange}
            active={props.activeFilters.hasOwnProperty(org.filterKey) ? props.activeFilters[org.filterKey] : []}
            isExpanded={props.expandedList === org.filterKey}
            onFacetExpandableChange={props.onFacetExpandableChange}
            displaySubtitle
          />
        );
      }

      if (!isNull(userElement) || !isNull(orgElement)) {
        publishersList = (
          <div className="mt-3 mt-sm-4 pt-1">
            <SmallTitle text="Publisher" className="text-secondary font-weight-bold pt-2" />
            {orgElement}
            {userElement}
          </div>
        );
      }
    }

    return publishersList;
  };

  const getKindFacets = (): JSX.Element | null => {
    let kindElement = null;
    const kind = getFacetsByFilterKey('kind');
    if (!isUndefined(kind)) {
      kindElement = (
        <Facet
          {...kind}
          onChange={props.onChange}
          active={props.activeFilters.hasOwnProperty(kind.filterKey) ? props.activeFilters[kind.filterKey] : []}
          isExpanded={props.expandedList === kind.filterKey}
          onFacetExpandableChange={props.onFacetExpandableChange}
          notExpandable
        />
      );
    }

    return kindElement;
  };

  const getRepositoryFacets = (): JSX.Element | null => {
    let crElement = null;
    const repo = getFacetsByFilterKey('repo');
    if (!isUndefined(repo)) {
      crElement = (
        <Facet
          {...repo}
          onChange={props.onChange}
          active={props.activeFilters.hasOwnProperty(repo.filterKey) ? props.activeFilters[repo.filterKey] : []}
          isExpanded={props.expandedList === repo.filterKey}
          onFacetExpandableChange={props.onFacetExpandableChange}
        />
      );
    }

    return crElement;
  };

  return (
    <div className={classnames(styles.filters, { 'pt-2 mt-3 mb-5': props.visibleTitle })}>
      {props.visibleTitle && (
        <div className="d-flex flex-row align-items-center justify-content-between pb-2 mb-4 border-bottom">
          <div className={`h6 text-uppercase mb-0 ${styles.title}`}>Filters</div>
          {(!isEmpty(props.activeFilters) || props.deprecated || props.operators || !isEmpty(props.activeTsQuery)) && (
            <div className={`d-flex align-items-center ${styles.resetBtnWrapper}`}>
              <IoMdCloseCircleOutline className={`text-secondary ${styles.resetBtnDecorator}`} />
              <button
                data-testid="resetFiltersBtn"
                className={`btn btn-link btn-sm p-0 pl-1 text-secondary ${styles.resetBtn}`}
                onClick={props.onResetFilters}
              >
                Reset
              </button>
            </div>
          )}
        </div>
      )}

      <TsQuery active={props.activeTsQuery || []} onChange={props.onTsQueryChange} />
      {getKindFacets()}
      {getPublishers()}
      {getRepositoryFacets()}

      <div role="menuitem" className={`mt-3 mt-sm-4 pt-1 ${styles.facet}`}>
        <SmallTitle text="Others" className="text-secondary font-weight-bold" />

        <div className="mt-3">
          <CheckBox
            name="operators"
            value="operators"
            className={styles.checkbox}
            label="Only operators"
            checked={!isUndefined(props.operators) && !isNull(props.operators) && props.operators}
            onChange={props.onOperatorsChange}
          />

          <CheckBox
            name="deprecated"
            value="deprecated"
            className={styles.checkbox}
            label="Include deprecated"
            checked={!isUndefined(props.deprecated) && !isNull(props.deprecated) && props.deprecated}
            onChange={props.onDeprecatedChange}
          />
        </div>
      </div>
    </div>
  );
};

export default Filters;
