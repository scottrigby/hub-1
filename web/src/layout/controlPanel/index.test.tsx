import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { mocked } from 'ts-jest/utils';

import { API } from '../../api';
import { AppCtx } from '../../context/AppCtx';
import ControlPanelView from './index';
jest.mock('../../api');
jest.mock('./repositories', () => () => <div />);

const mockHistoryPush = jest.fn();
const mockHistoryReplace = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    push: mockHistoryPush,
    replace: mockHistoryReplace,
  }),
}));

const mockCtx = {
  user: { alias: 'test', email: 'test@test.com' },
  prefs: {
    controlPanel: {},
    search: { limit: 25 },
    theme: {
      configured: 'light',
      automatic: false,
    },
  },
};

const mockCtxOrgSelected = {
  user: { alias: 'test', email: 'test@test.com' },
  prefs: {
    controlPanel: { selectedOrg: 'orgTest' },
    search: { limit: 25 },
    theme: {
      configured: 'light',
      automatic: false,
    },
  },
};

describe('ControlPanelView', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders correctly', async () => {
    mocked(API).getRepositories.mockResolvedValue([]);
    const result = render(
      <AppCtx.Provider value={{ ctx: mockCtx, dispatch: jest.fn() }}>
        <Router>
          <ControlPanelView />
        </Router>
      </AppCtx.Provider>
    );
    expect(result.asFragment()).toMatchSnapshot();
    await waitFor(() => {});
  });

  it('calls history replace when section is undefined', async () => {
    mocked(API).getRepositories.mockResolvedValue([]);
    const { getByRole } = render(
      <AppCtx.Provider value={{ ctx: mockCtx, dispatch: jest.fn() }}>
        <Router>
          <ControlPanelView />
        </Router>
      </AppCtx.Provider>
    );

    await waitFor(() => getByRole('main'));
    expect(mockHistoryReplace).toHaveBeenCalledTimes(1);
    expect(mockHistoryReplace).toHaveBeenCalledWith('/control-panel/repositories');

    await waitFor(() => {});
  });

  it('renders 3 sections on user context', async () => {
    mocked(API).getRepositories.mockResolvedValue([]);
    const { getByRole, getAllByRole } = render(
      <AppCtx.Provider value={{ ctx: mockCtx, dispatch: jest.fn() }}>
        <Router>
          <ControlPanelView section="repositories" />
        </Router>
      </AppCtx.Provider>
    );

    await waitFor(() => getByRole('main'));
    const tabs = getAllByRole('tab');
    expect(getByRole('tablist')).toBeInTheDocument();
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveTextContent('Repositories');
    expect(tabs[1]).toHaveTextContent('Organizations');
    expect(tabs[2]).toHaveTextContent('Settings');
    await waitFor(() => {});
  });

  it('renders 3 sections on org context', async () => {
    mocked(API).getRepositories.mockResolvedValue([]);
    const { getByRole, getAllByRole } = render(
      <AppCtx.Provider value={{ ctx: mockCtxOrgSelected, dispatch: jest.fn() }}>
        <Router>
          <ControlPanelView section="repositories" />
        </Router>
      </AppCtx.Provider>
    );

    await waitFor(() => getByRole('main'));
    const tabs = getAllByRole('tab');
    expect(getByRole('tablist')).toBeInTheDocument();
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveTextContent('Repositories');
    expect(tabs[1]).toHaveTextContent('Members');
    expect(tabs[2]).toHaveTextContent('Settings');
    await waitFor(() => {});
  });
});
