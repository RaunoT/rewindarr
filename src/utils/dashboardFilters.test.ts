import { describe, expect, it } from 'vitest'
import {
  clearDashboardFilters,
  getAvailableSort,
  getNextFilterUrl,
  setDashboardFilters,
  setPeriodFilter,
} from './dashboardFilters'

function apply(
  query: string,
  ...updates: ((params: URLSearchParams) => void)[]
) {
  const params = new URLSearchParams(query)

  for (const update of updates) {
    update(params)
  }

  return params.toString()
}

describe('getAvailableSort', () => {
  it('drops the users sort on a personal dashboard', () => {
    expect(getAvailableSort('true', 'users')).toBeUndefined()
    expect(getAvailableSort('true', 'duration')).toBe('duration')
    expect(getAvailableSort(undefined, 'users')).toBe('users')
  })
})

describe('setDashboardFilters', () => {
  it('keeps the period and starts from the first rows', () => {
    expect(
      apply('period=7days&limit=40', (params) =>
        setDashboardFilters(params, { personal: 'true', sortBy: 'duration' }),
      ),
    ).toBe('period=7days&personal=true&sortBy=duration')
  })

  it('removes filters set back to their defaults', () => {
    expect(
      apply('personal=true&sortBy=duration', (params) =>
        setDashboardFilters(params, { personal: undefined, sortBy: undefined }),
      ),
    ).toBe('')
  })

  it('drops the users sort when only one user is shown', () => {
    expect(
      apply('sortBy=users', (params) =>
        setDashboardFilters(params, { personal: 'true' }),
      ),
    ).toBe('personal=true')
    expect(
      apply('', (params) =>
        setDashboardFilters(params, { sortBy: 'users' }, true),
      ),
    ).toBe('')
  })

  // A change made while the page for the one before loads
  it('builds each change on the one before', () => {
    expect(
      apply(
        '',
        (params) => setDashboardFilters(params, { personal: 'true' }),
        (params) => setDashboardFilters(params, { sortBy: 'duration' }),
        (params) => setPeriodFilter(params, '7days'),
      ),
    ).toBe('personal=true&sortBy=duration&period=7days')
    expect(
      apply(
        'personal=true&sortBy=duration',
        (params) => setDashboardFilters(params, { personal: undefined }),
        (params) => setDashboardFilters(params, { sortBy: 'users' }),
      ),
    ).toBe('sortBy=users')
  })
})

describe('setPeriodFilter', () => {
  it('starts from the first rows and page, and leaves the default out', () => {
    expect(
      apply('period=7days&page=3&limit=40&q=dune', (params) =>
        setPeriodFilter(params, ''),
      ),
    ).toBe('q=dune')
    expect(
      apply('q=dune', (params) => setPeriodFilter(params, 'allTime')),
    ).toBe('q=dune&period=allTime')
  })
})

describe('clearDashboardFilters', () => {
  it('removes every filter and the period', () => {
    expect(
      apply(
        'period=7days&personal=true&sortBy=duration&limit=40',
        clearDashboardFilters,
      ),
    ).toBe('')
  })
})

describe('getNextFilterUrl', () => {
  // As the dashboard does it: the URL stays the same until the page for the
  // first change loads, and the query shown already has that change
  it('keeps a change made while the one before still loads', () => {
    const committedQuery = ''
    const justMe = (params: URLSearchParams) =>
      setDashboardFilters(params, { personal: 'true' })
    const watchTime = (params: URLSearchParams) =>
      setDashboardFilters(params, { sortBy: 'duration' })
    const first = getNextFilterUrl('/dashboard/movies', committedQuery, justMe)
    const second = getNextFilterUrl('/dashboard/movies', first.query, watchTime)

    expect(first.url).toBe('/dashboard/movies?personal=true')
    expect(second.url).toBe('/dashboard/movies?personal=true&sortBy=duration')
    // Starting from the URL instead loses the first change
    expect(
      getNextFilterUrl('/dashboard/movies', committedQuery, watchTime).url,
    ).toBe('/dashboard/movies?sortBy=duration')
  })

  it('leaves the query out when nothing is left in it', () => {
    expect(
      getNextFilterUrl(
        '/dashboard/movies',
        'personal=true&period=7days',
        clearDashboardFilters,
      ),
    ).toEqual({ query: '', url: '/dashboard/movies' })
  })
})
