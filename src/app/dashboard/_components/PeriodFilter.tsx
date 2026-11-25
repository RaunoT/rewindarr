'use client'

import { GlobalContext } from '@/app/_components/GlobalContextProvider'
import SegmentedControl from '@/components/filters/SegmentedControl'
import useFilterParams, { FilterParams } from '@/hooks/useFilterParams'
import { DashboardSearchParams } from '@/types/dashboard'
import { PublicSettings } from '@/types/settings'
import { setPeriodFilter } from '@/utils/dashboardFilters'
import { parseCustomPeriod } from '@/utils/getPeriod'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { useContext, useEffect } from 'react'

type Props = {
  settings: PublicSettings
  // The other filters', when there are any next to it
  filterParams?: FilterParams
  className?: string
}

function getPeriodValue(period: string, customPeriod: number): number {
  switch (period) {
    case '7days':
      return 7
    case 'pastYear':
      return 365
    case 'allTime':
      return Infinity
    case 'custom':
      return customPeriod
    default:
      return 0
  }
}

// Always in sight, as every number on the page depends on it
export default function PeriodFilter({
  settings,
  filterParams,
  className,
}: Props) {
  const t = useTranslations('PeriodSelectContent')
  const tFilters = useTranslations('Filters')
  const pathname = usePathname()
  const ownFilterParams = useFilterParams()
  const { searchParams, committedSearchParams, navigate } =
    filterParams ?? ownFilterParams
  const {
    dashboard: { setPeriod },
  } = useContext(GlobalContext)
  const periodParam = searchParams.get('period')
  const customPeriod = parseCustomPeriod(settings.dashboard.customPeriod)
  const periodOptions = [
    { label: t('7days'), value: '7days' },
    { label: t('days', { count: customPeriod }), value: 'custom' },
    { label: t('pastYear'), value: 'pastYear' },
    { label: t('allTime'), value: 'allTime' },
  ]
  const validPeriodValues = periodOptions.map((option) => option.value)
  const isValidPeriod = periodParam && validPeriodValues.includes(periodParam)
  const committedPeriodParam = committedSearchParams.get('period')
  const savedPeriod =
    committedPeriodParam && validPeriodValues.includes(committedPeriodParam)
      ? (committedPeriodParam as DashboardSearchParams['period'])
      : undefined

  // Sort period options by value
  periodOptions.sort((a, b) => {
    return (
      getPeriodValue(a.value, customPeriod) -
      getPeriodValue(b.value, customPeriod)
    )
  })

  function handleChange(value: string) {
    navigate((params) =>
      setPeriodFilter(params, value === 'custom' ? '' : value),
    )
  }

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  // Saved once the URL has it, as a change still loading can be canceled
  useEffect(() => {
    setPeriod(savedPeriod)
  }, [savedPeriod, setPeriod])

  return (
    <SegmentedControl
      label={tFilters('period')}
      options={periodOptions}
      value={isValidPeriod ? periodParam : 'custom'}
      onChange={handleChange}
      className={className}
    />
  )
}
