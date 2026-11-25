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
import { useContext, useEffect } from 'react'
import PeriodFilter from './PeriodFilter'

type Props = {
  settings: PublicSettings
  personalFilter: boolean
  // Only the viewer's own stats, whatever the URL asks for
  isOwnOnly?: boolean
}

// Saved filters are applied once per page load, when a dashboard is opened
// without any in its URL. After that the links to the dashboards carry them,
// and the URL is the only source of truth, so Back and Forward keep working.
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
  const { searchParams, committedSearchParams, isChangeLoaded, navigate } =
    filterParams
  // Only for a viewer who has the choice, as the server ignores it otherwise
  const isPersonal: DashboardSearchParams['personal'] =
    personalFilter && searchParams.get('personal') === 'true'
      ? 'true'
      : undefined
  const sortBy = getAvailableSort(
    isOwnOnly ? 'true' : isPersonal,
    getDashboardSort(searchParams.get('sortBy')),
  )
  const committed = getDashboardFilters(committedSearchParams)
  const committedPersonal = personalFilter ? committed.personal : undefined
  const committedSort = getAvailableSort(
    isOwnOnly ? 'true' : committedPersonal,
    committed.sortBy,
  )
  const hasUrlFilters =
    (personalFilter && committedSearchParams.has('personal')) ||
    committedSearchParams.has('sortBy')
  const {
    dashboard: { setIsPersonal, setSortBy },
  } = useContext(GlobalContext)
  const t = useTranslations('DashboardFilters')

  function handlePersonalChange(value: string) {
    navigate((params) =>
      setDashboardFilters(
        params,
        { personal: value === 'true' ? 'true' : undefined },
        isOwnOnly,
      ),
    )
  }

  function handleSortChange(value: string) {
    navigate((params) =>
      setDashboardFilters(
        params,
        {
          sortBy: getDashboardSort(value),
          // One in the URL that the viewer can't use goes
          ...(!personalFilter && { personal: undefined }),
        },
        isOwnOnly,
      ),
    )
  }

  function handleClear() {
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

  // Remembered for the next visit and for the links to the dashboards. Only a
  // change made here is, not the filters of a link or of Back and Forward, and
  // only once its page has loaded, as Back or a link can cancel it.
  useEffect(() => {
    if (!isChangeLoaded) {
      return
    }

    if (personalFilter) {
      setIsPersonal(committedPersonal)
    }

    // The period, which Clear all resets too, is saved by its own filter
    setSortBy(committedSort)
  }, [
    committedPersonal,
    committedSort,
    isChangeLoaded,
    personalFilter,
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
