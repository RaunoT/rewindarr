import { DashboardSearchParams } from '@/types/dashboard'
import { Settings } from '@/types/settings'
import { getPeriods, Period } from './constants'

// The settings form only accepts whole days, but an older or hand-edited value
// must not turn into NaN or a period that starts now.
export function parseCustomPeriod(customPeriod: string): number {
  return Math.max(1, parseInt(customPeriod) || 1)
}

type PeriodOption = NonNullable<DashboardSearchParams['period']>

// How long the built-in periods are, which a custom period would only repeat
const BUILT_IN_PERIOD_DAYS = { '7days': 7, pastYear: 365 } as const

export function isBuiltInPeriodLength(days: number): boolean {
  return Object.values(BUILT_IN_PERIOD_DAYS).includes(days as never)
}

// The period filter's options, shortest first. A custom period saved before
// the settings turned these lengths down stands in for the built-in one, as
// it's the default the filter falls back to.
export function getPeriodOptions(customPeriod: number): PeriodOption[] {
  const options: { value: PeriodOption; days: number }[] = [
    { value: '7days', days: BUILT_IN_PERIOD_DAYS['7days'] },
    { value: 'pastYear', days: BUILT_IN_PERIOD_DAYS.pastYear },
    { value: 'allTime', days: Infinity },
  ]

  return [
    { value: 'custom' as const, days: customPeriod },
    ...options.filter(({ days }) => days !== customPeriod),
  ]
    .sort((a, b) => a.days - b.days)
    .map(({ value }) => value)
}

export default function getPeriod(
  periodSearchParam: DashboardSearchParams['period'],
  settings: Settings,
): Period {
  const customPeriod = parseCustomPeriod(settings.dashboard.customPeriod)

  function getCustomPeriod() {
    const startDate = new Date(Date.now() - customPeriod * 24 * 60 * 60 * 1000)

    return createPeriodObject(startDate, customPeriod)
  }

  function getAllTimePeriod() {
    // Without a start date, all time reaches back past the first play
    const startDate = settings.dashboard.startDate
      ? new Date(settings.dashboard.startDate)
      : new Date(0)
    const daysAgo = Math.ceil(
      (Date.now() - startDate.getTime()) / (24 * 60 * 60 * 1000),
    )

    return createPeriodObject(startDate, daysAgo)
  }

  function createPeriodObject(date: Date, daysAgo: number) {
    return {
      date: date.toISOString(),
      string: date.toISOString().split('T')[0],
      daysAgo,
    }
  }

  function getPeriodFromKey(key: string): Period | undefined {
    switch (key) {
      case 'custom':
        return getCustomPeriod()
      case 'allTime':
        return getAllTimePeriod()
      case '7days':
      case 'pastYear':
        return getPeriods()[key]
      default:
        return undefined
    }
  }

  return (
    (periodSearchParam && getPeriodFromKey(periodSearchParam)) ||
    getCustomPeriod()
  )
}
