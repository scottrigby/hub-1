import { fireEvent, render } from '@testing-library/react';
import React from 'react';

import { Facets } from '../../types';
import Filters from './Filters';

const FacetsMock: Facets[] = [
  {
    title: 'Organization',
    filterKey: 'org',
    options: [
      {
        id: 'helmOrg',
        name: 'Helm org',
        total: 256,
      },
      {
        id: 'falco',
        name: 'Falco',
        total: 22,
      },
    ],
  },
  {
    title: 'User',
    filterKey: 'user',
    options: [
      {
        id: 'testUser',
        name: 'testUser',
        total: 1,
      },
    ],
  },
  {
    title: 'Kind',
    filterKey: 'kind',
    options: [
      {
        id: 0,
        name: 'Helm charts',
        total: 256,
      },
      {
        id: 1,
        name: 'Falco rules',
        total: 21,
      },
      {
        id: 2,
        name: 'OPA policies',
        total: 1,
      },
    ],
  },
  {
    title: 'Repository',
    filterKey: 'repo',
    options: [
      {
        id: 'stable',
        name: 'Stable',
        total: 203,
      },
      {
        id: 'incubator',
        name: 'Incubator',
        total: 53,
      },
    ],
  },
];

const onDeprecatedChangeMock = jest.fn();
const onResetFiltersMock = jest.fn();
const onChangeMock = jest.fn();
const onFacetExpandableChangeMock = jest.fn();

const defaultProps = {
  activeFilters: {},
  activeTsQuery: [],
  facets: FacetsMock,
  visibleTitle: false,
  onChange: onChangeMock,
  onTsQueryChange: jest.fn(),
  onDeprecatedChange: onDeprecatedChangeMock,
  onOperatorsChange: jest.fn(),
  onResetFilters: onResetFiltersMock,
  onFacetExpandableChange: onFacetExpandableChangeMock,
  deprecated: false,
};

describe('Filters', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates snapshot', () => {
    const result = render(<Filters {...defaultProps} />);

    expect(result.asFragment()).toMatchSnapshot();
  });

  describe('Render', () => {
    it('renders component', () => {
      const { getByLabelText, getAllByTestId } = render(<Filters {...defaultProps} />);

      expect(getAllByTestId('checkbox')).toHaveLength(20);
      expect(getByLabelText('Include deprecated')).toBeInTheDocument();
    });

    it('renders component with title', () => {
      const props = {
        ...defaultProps,
        visibleTitle: true,
      };
      const { getByText, queryByTestId } = render(<Filters {...props} />);

      expect(getByText('Filters')).toBeInTheDocument();
      expect(queryByTestId('resetFiltersBtn')).toBeNull();
    });

    it('renders reset btn when active filters is not empty and calls mock to click', () => {
      const props = {
        ...defaultProps,
        activeFilters: { kind: ['0'] },
        visibleTitle: true,
      };
      const { getByTestId } = render(<Filters {...props} />);
      const resetBtn = getByTestId('resetFiltersBtn');
      fireEvent.click(resetBtn);

      expect(onResetFiltersMock).toHaveBeenCalledTimes(1);
    });

    it('calls deprecated mock when deprecated checkbox is clicked', () => {
      const { getByLabelText } = render(<Filters {...defaultProps} />);

      const opt = getByLabelText('Include deprecated');
      expect(opt).toBeInTheDocument();
      fireEvent.click(opt);
      expect(onDeprecatedChangeMock).toHaveBeenCalledTimes(1);
    });

    it('calls onchange mock when any checkbox is clicked', () => {
      const { getByLabelText } = render(<Filters {...defaultProps} />);

      const opt = getByLabelText(/Stable/g);
      expect(opt).toBeInTheDocument();
      fireEvent.click(opt);
      expect(onChangeMock).toHaveBeenCalledTimes(1);
    });

    it('renders facets in correct order', () => {
      const { getAllByTestId } = render(<Filters {...defaultProps} />);

      const titles = getAllByTestId('smallTitle');
      expect(titles).toHaveLength(5);

      expect(titles[0]).toHaveTextContent('Category');
      expect(titles[1]).toHaveTextContent('Kind');
      expect(titles[2]).toHaveTextContent('Publisher');
      expect(titles[3]).toHaveTextContent('Repository');
      expect(titles[4]).toHaveTextContent('Others');
    });
  });
});
