'use client'

import {
  GlobalContext,
  readStorage,
} from '@/app/_components/GlobalContextProvider'
import FilterSheet, { FilterGroup } from '@/components/filters/FilterSheet'
import SegmentedControl from '@/components/filters/SegmentedControl'
import { DashboardSearchParams } from '@/types/dashboard'
import { PublicSettings } from '@/types/settings'
import { getDashboardSort } from '@/utils/helpers'
import { BarsArrowDownIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useContext, useEffect } from 'react'
import PeriodFilter from './PeriodFilter'

type Props = {
  settings: PublicSettings
  personalFilter: boolean
}

// Saved filters are applied once per page load, when a dashboard is opened
// without any in its URL. After that the URL is the only source of truth, so
// Back and Forward keep working.
let hasRestoredSavedFilters = false

// Every title on a personal dashboard has the same one user
function getAvailableSort(
  personal: DashboardSearchParams['personal'],
  sort: DashboardSearchParams['sortBy'],
): DashboardSearchParams['sortBy'] {
  return personal === 'true' && sort === 'users' ? undefined : sort
}

// The period stays in sight. On wider screens the other filters sit across
// from it, on phones they're in a sheet.
export default function DashboardFilters({ settings, personalFilter }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isPersonal: DashboardSearchParams['personal'] =
    searchParams.get('personal') === 'true' ? 'true' : undefined
  const sortBy = getAvailableSort(
    isPersonal,
    getDashboardSort(searchParams.get('sortBy')),
  )
  const hasUrlFilters =
    searchParams.has('personal') || searchParams.has('sortBy')
  const {
    dashboard: { setIsPersonal, setSortBy },
  } = useContext(GlobalContext)
  const t = useTranslations('DashboardFilters')

  // eslint-disable-next-line @stylistic/padding-line-between-statements
  const getUrl = useCallback(
    (
      personal: DashboardSearchParams['personal'],
      sort: DashboardSearchParams['sortBy'],
    ) => {
      const params = new URLSearchParams(searchParams.toString())

      // A new list starts from its first rows again
      params.delete('limit')

      if (personal === 'true') {
        params.set('personal', 'true')
      } else {
        params.delete('personal')
      }

      const availableSort = getAvailableSort(personal, sort)

      if (availableSort) {
        params.set('sortBy', availableSort)
      } else {
        params.delete('sortBy')
      }

      const query = params.toString()

      return query ? `${pathname}?${query}` : pathname
    },
    [pathname, searchParams],
  )

  function handlePersonalChange(value: string) {
    router.push(getUrl(value === 'true' ? 'true' : undefined, sortBy))
  }

  function handleSortChange(value: string) {
    router.push(getUrl(isPersonal, getDashboardSort(value)))
  }

  // Back to the defaults, the period too
  function handleClear() {
    const params = new URLSearchParams(searchParams.toString())

    for (const name of ['period', 'personal', 'sortBy', 'limit']) {
      params.delete(name)
    }

    const query = params.toString()

    router.push(query ? `${pathname}?${query}` : pathname)
  }

  useEffect(() => {
    if (!hasRestoredSavedFilters) {
      hasRestoredSavedFilters = true

      const savedPersonal =
        personalFilter && readStorage('dashboardPersonal') === 'true'
          ? 'true'
          : undefined
      const savedSort = getDashboardSort(readStorage('dashboardSort'))

      if (!hasUrlFilters && (savedPersonal || savedSort)) {
        router.replace(getUrl(savedPersonal, savedSort))

        return
      }
    }

    // Remembered for the next visit and for the links on the home page
    setIsPersonal(isPersonal)
    setSortBy(sortBy)
  }, [
    getUrl,
    hasUrlFilters,
    isPersonal,
    personalFilter,
    router,
    setIsPersonal,
    setSortBy,
    sortBy,
  ])

  const tCommon = useTranslations('Common')
  const activeCount = Number(!!isPersonal) + Number(!!sortBy)
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
          ...(isPersonal ? [] : [{ value: 'users', label: tCommon('users') }]),
        ]}
        value={sortBy ?? 'plays'}
        onChange={handleSortChange}
        className='w-full'
      />
    )
  }

  return (
    <div className='mb-4 flex items-center gap-2'>
      <PeriodFilter settings={settings} className='max-sm:flex-1' />
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
