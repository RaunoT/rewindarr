'use client'

import {
  GlobalContext,
  readStorage,
} from '@/app/_components/GlobalContextProvider'
import FilterSheet, { FilterGroup } from '@/components/filters/FilterSheet'
import SegmentedControl from '@/components/filters/SegmentedControl'
import useFilterParams from '@/hooks/useFilterParams'
import { DashboardSearchParams } from '@/types/dashboard'
import { PublicSettings } from '@/types/settings'
import {
  clearDashboardFilters,
  getAvailableSort,
  getDashboardFilters,
  setDashboardFilters,
} from '@/utils/dashboardFilters'
import { getDashboardSort } from '@/utils/helpers'
import { BarsArrowDownIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useContext, useEffect, useRef } from 'react'
import PeriodFilter from './PeriodFilter'

type Props = {
  settings: PublicSettings
  personalFilter: boolean
  // Only the viewer's own stats, whatever the URL asks for
  isOwnOnly?: boolean
}

// Saved filters are applied once per page load, when a dashboard is opened
// without any in its URL. After that the URL is the only source of truth, so
// Back and Forward keep working.
let hasRestoredSavedFilters = false

// The period stays in sight. On wider screens the other filters sit across
// from it, on phones they're in a sheet.
export default function DashboardFilters({
  settings,
  personalFilter,
  isOwnOnly = false,
}: Props) {
  // Shared with the period, so a change to either builds on the other's
  const filterParams = useFilterParams()
  const { searchParams, committedSearchParams, navigate } = filterParams
  const isPersonal: DashboardSearchParams['personal'] =
    searchParams.get('personal') === 'true' ? 'true' : undefined
  const sortBy = getAvailableSort(
    isOwnOnly ? 'true' : isPersonal,
    getDashboardSort(searchParams.get('sortBy')),
  )
  const committed = getDashboardFilters(committedSearchParams)
  const committedPersonal = committed.personal
  const committedSort = getAvailableSort(
    isOwnOnly ? 'true' : committedPersonal,
    committed.sortBy,
  )
  const hasUrlFilters =
    committedSearchParams.has('personal') || committedSearchParams.has('sortBy')
  const {
    dashboard: { setIsPersonal, setSortBy },
  } = useContext(GlobalContext)
  const t = useTranslations('DashboardFilters')
  const isRestoringRef = useRef(false)

  function handlePersonalChange(value: string) {
    isRestoringRef.current = false
    navigate((params) =>
      setDashboardFilters(
        params,
        { personal: value === 'true' ? 'true' : undefined },
        isOwnOnly,
      ),
    )
  }

  function handleSortChange(value: string) {
    isRestoringRef.current = false
    navigate((params) =>
      setDashboardFilters(
        params,
        { sortBy: getDashboardSort(value) },
        isOwnOnly,
      ),
    )
  }

  function handleClear() {
    isRestoringRef.current = false
    navigate(clearDashboardFilters)
  }

  useEffect(() => {
    if (hasRestoredSavedFilters) {
      return
    }

    hasRestoredSavedFilters = true

    const savedPersonal =
      personalFilter && readStorage('dashboardPersonal') === 'true'
        ? 'true'
        : undefined
    const savedSort = getAvailableSort(
      isOwnOnly ? 'true' : savedPersonal,
      getDashboardSort(readStorage('dashboardSort')),
    )

    if (!hasUrlFilters && (savedPersonal || savedSort)) {
      isRestoringRef.current = true
      navigate(
        (params) =>
          setDashboardFilters(
            params,
            { personal: savedPersonal, sortBy: savedSort },
            isOwnOnly,
          ),
        { replace: true },
      )
    }
  }, [hasUrlFilters, isOwnOnly, navigate, personalFilter])

  // Remembered for the next visit and for the links on the home page, once
  // the URL has them
  useEffect(() => {
    if (isRestoringRef.current) {
      if (!hasUrlFilters) {
        return
      }

      isRestoringRef.current = false
    }

    setIsPersonal(committedPersonal)
    setSortBy(committedSort)
  }, [
    committedPersonal,
    committedSort,
    hasUrlFilters,
    setIsPersonal,
    setSortBy,
  ])

  const tCommon = useTranslations('Common')
  const activeCount = Number(personalFilter && !!isPersonal) + Number(!!sortBy)
  const canClear = activeCount > 0 || searchParams.has('period')

  function getAudience() {
    return (
      <SegmentedControl
        label={t('type')}
        options={[
          { value: 'everyone', label: t('general') },
          { value: 'me', label: t('personal') },
        ]}
        value={isPersonal ? 'me' : 'everyone'}
        onChange={(value) => handlePersonalChange(value === 'me' ? 'true' : '')}
        className='w-full'
      />
    )
  }

  function getSort() {
    return (
      <SegmentedControl
        label={t('sortByLabel')}
        icon={<BarsArrowDownIcon aria-hidden='true' />}
        options={[
          { value: 'plays', label: tCommon('plays') },
          { value: 'duration', label: tCommon('duration') },
          ...(isPersonal || isOwnOnly
            ? []
            : [{ value: 'users', label: tCommon('users') }]),
        ]}
        value={sortBy ?? 'plays'}
        onChange={handleSortChange}
        className='w-full'
      />
    )
  }

  return (
    <div className='mb-4 flex items-center gap-2'>
      <PeriodFilter
        settings={settings}
        filterParams={filterParams}
        className='max-sm:flex-1'
      />
      <FilterSheet
        count={activeCount}
        canClear={canClear}
        onClear={handleClear}
        className='ml-auto'
      >
        {personalFilter && (
          <FilterGroup label={t('type')}>{getAudience()}</FilterGroup>
        )}
        <FilterGroup label={t('sort')}>{getSort()}</FilterGroup>
      </FilterSheet>
    </div>
  )
}
