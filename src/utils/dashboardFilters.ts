import { DashboardSearchParams } from '@/types/dashboard'
import { getDashboardSort } from './helpers'

// Every title on a personal dashboard has the same one user
export function getAvailableSort(
  personal: DashboardSearchParams['personal'],
  sort: DashboardSearchParams['sortBy'],
): DashboardSearchParams['sortBy'] {
  return personal === 'true' && sort === 'users' ? undefined : sort
}

type DashboardFilters = Pick<DashboardSearchParams, 'personal' | 'sortBy'>

export function getDashboardFilters(params: URLSearchParams): DashboardFilters {
  return {
    personal: params.get('personal') === 'true' ? 'true' : undefined,
    sortBy: getDashboardSort(params.get('sortBy')),
  }
}

// Changes the ones given and keeps the rest of the URL, so a change made
// while the one before still loads keeps that one too
export function setDashboardFilters(
  params: URLSearchParams,
  filters: Partial<DashboardFilters>,
  isOwnOnly = false,
) {
  const { personal, sortBy } = { ...getDashboardFilters(params), ...filters }

  // A new list starts from its first rows again
  params.delete('limit')

  if (personal === 'true') {
    params.set('personal', 'true')
  } else {
    params.delete('personal')
  }

  const availableSort = getAvailableSort(isOwnOnly ? 'true' : personal, sortBy)

  if (availableSort) {
    params.set('sortBy', availableSort)
  } else {
    params.delete('sortBy')
  }
}

// Back to the defaults, the period too
export function clearDashboardFilters(params: URLSearchParams) {
  for (const name of ['period', 'personal', 'sortBy', 'limit']) {
    params.delete(name)
  }
}

// None for the default, the settings' custom number of days
export function setPeriodFilter(params: URLSearchParams, period?: string) {
  // A new list starts from its first rows and page again
  params.delete('limit')
  params.delete('page')

  if (period) {
    params.set('period', period)
  } else {
    params.delete('period')
  }
}

// The next change starts from the query shown, not the URL's
export function getNextFilterUrl(
  pathname: string,
  query: string,
  update: (params: URLSearchParams) => void,
): { query: string; url: string } {
  const params = new URLSearchParams(query)

  update(params)

  const nextQuery = params.toString()

  return {
    query: nextQuery,
    url: nextQuery ? `${pathname}?${nextQuery}` : pathname,
  }
}
