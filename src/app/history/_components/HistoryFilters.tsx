'use client'

import PeriodFilter from '@/app/dashboard/_components/PeriodFilter'
import ChipGroup from '@/components/filters/ChipGroup'
import FilterSheet, { FilterGroup } from '@/components/filters/FilterSheet'
import SearchPill from '@/components/filters/SearchPill'
import SegmentedControl from '@/components/filters/SegmentedControl'
import { UserList } from '@/components/filters/UserPicker'
import { MediaIcon, STAT_ICONS } from '@/components/icons'
import { PublicSettings } from '@/types/settings'
import { PlayIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ToggleButton } from 'react-aria-components'

// How long typing pauses before the search runs
const SEARCH_DELAY = 400

export type FilterOption = {
  value: string
  label: string
  // A library's section type, for its icon
  type?: string
  // A user's profile picture
  avatar?: string
}

type Props = {
  settings: PublicSettings
  libraries: FilterOption[]
  // Only the viewer's own when the server is anonymized
  users: FilterOption[]
  // Whether requests can be told apart from plays, which takes Seerr
  hasRequests: boolean
}

// The search and the period stay in sight, the rest are behind the filters
// button. The filters live in the URL, so a
// filtered page can be shared and Back undoes a filter. Each new filter starts
// again from the first page.
export default function HistoryFilters({
  settings,
  libraries,
  users,
  hasRequests,
}: Props) {
  const t = useTranslations('History')
  const tRoot = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParam = searchParams.get('q') ?? ''
  const [search, setSearch] = useState(searchParam)
  // Back and the other filters change the URL too
  const [shownSearchParam, setShownSearchParam] = useState(searchParam)
  // Ones in the URL that aren't among the options don't count
  const pickedLibraries = getPicked('library', libraries)
  const pickedUsers = getPicked('user', users)
  const kindParam = searchParams.get('kind')
  const kind =
    hasRequests && (kindParam === 'play' || kindParam === 'request')
      ? kindParam
      : 'all'
  const activeCount =
    Number(kind !== 'all') +
    Number(pickedLibraries.length > 0) +
    Number(pickedUsers.length > 0)
  const canClear =
    activeCount > 0 || !!searchParam || searchParams.has('period')
  const hasMoreFilters = hasRequests || libraries.length > 1 || users.length > 0

  if (searchParam !== shownSearchParam) {
    setShownSearchParam(searchParam)
    setSearch(searchParam)
  }

  function getPicked(name: string, options: FilterOption[]) {
    return searchParams
      .getAll(name)
      .filter((value) => options.some((option) => option.value === value))
  }

  // Each value in a parameter of its own, none for all of them
  function setParam(name: string, values: string[]) {
    const params = new URLSearchParams(searchParams.toString())

    params.delete('page')
    params.delete(name)

    for (const value of values) {
      params.append(name, value)
    }

    router.push(params.size ? `${pathname}?${params.toString()}` : pathname)
  }

  // Back to the defaults, keeping only the rows per page
  function handleClear() {
    const rows = searchParams.get('rows')

    setSearch('')
    router.push(rows ? `${pathname}?rows=${rows}` : pathname)
  }

  useEffect(() => {
    const value = search.trim()

    if (value === shownSearchParam) {
      return
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search)

      params.delete('page')

      if (value) {
        params.set('q', value)
      } else {
        params.delete('q')
      }

      // Each letter typed doesn't need a step in the browser's history
      router.replace(
        params.size ? `${pathname}?${params.toString()}` : pathname,
        { scroll: false },
      )
    }, SEARCH_DELAY)

    return () => clearTimeout(timer)
  }, [search, shownSearchParam, pathname, router])

  function getKind() {
    return (
      <SegmentedControl
        label={t('kindLabel')}
        options={[
          { value: 'all', label: tRoot('Filters.all') },
          { value: 'play', label: t('plays'), icon: <PlayIcon /> },
          {
            value: 'request',
            label: t('requests'),
            icon: <STAT_ICONS.requests />,
          },
        ]}
        value={kind}
        onChange={(value) => setParam('kind', value === 'all' ? [] : [value])}
        className='w-full'
      />
    )
  }

  function getLibraries() {
    return (
      <ChipGroup
        label={t('libraryLabel')}
        allLabel={tRoot('Filters.all')}
        options={libraries.map((library) => ({
          ...library,
          icon: library.type && <MediaIcon type={library.type} />,
        }))}
        value={pickedLibraries}
        onChange={(values) => setParam('library', values)}
      />
    )
  }

  // Anonymized servers only offer your own, which is a switch
  function getOnlyMine() {
    const [user] = users

    return (
      <ToggleButton
        isSelected={pickedUsers.length > 0}
        onChange={(isSelected) =>
          setParam('user', isSelected ? [user.value] : [])
        }
        className='chip w-fit'
      >
        <STAT_ICONS.users />
        {user.label}
      </ToggleButton>
    )
  }

  return (
    // On phones the period takes a row of its own under the search
    <div className='mb-4 flex flex-wrap items-center gap-2'>
      <SearchPill
        label={t('search')}
        value={search}
        onChange={setSearch}
        clearLabel={t('clearSearch')}
        className='min-w-40 flex-1'
      />
      <PeriodFilter
        settings={settings}
        className='max-sm:order-last max-sm:w-full'
      />
      {hasMoreFilters && (
        <FilterSheet
          count={activeCount}
          canClear={canClear}
          onClear={handleClear}
        >
          {hasRequests && (
            <FilterGroup label={t('kindLabel')}>{getKind()}</FilterGroup>
          )}
          {libraries.length > 1 && (
            <FilterGroup label={t('libraryLabel')}>
              {getLibraries()}
            </FilterGroup>
          )}
          {users.length === 1 ? (
            <FilterGroup label={tRoot('Common.users')}>
              {getOnlyMine()}
            </FilterGroup>
          ) : (
            users.length > 1 && (
              <FilterGroup label={tRoot('Common.users')}>
                <UserList
                  label={tRoot('Common.users')}
                  options={users}
                  selectionMode='multiple'
                  value={pickedUsers}
                  onChange={(values) => setParam('user', values)}
                  className='-mx-1.5'
                />
              </FilterGroup>
            )
          )}
        </FilterSheet>
      )}
    </div>
  )
}
