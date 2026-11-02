'use client'

import PeriodSelect from '@/app/dashboard/_components/PeriodSelect'
import { PublicSettings } from '@/types/settings'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

// How long typing pauses before the search runs
const SEARCH_DELAY = 400

export type FilterOption = {
  value: string
  label: string
}

type Props = {
  settings: PublicSettings
  libraries: FilterOption[]
  users: FilterOption[]
  // Whether requests can be told apart from plays, which takes Seerr
  hasRequests: boolean
}

// The filters live in the URL, so a filtered page can be shared and Back
// undoes a filter. Each new filter starts again from the first page.
export default function HistoryFilters({
  settings,
  libraries,
  users,
  hasRequests,
}: Props) {
  const t = useTranslations('History')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParam = searchParams.get('q') ?? ''
  const [search, setSearch] = useState(searchParam)
  // Back and the other filters change the URL too
  const [shownSearchParam, setShownSearchParam] = useState(searchParam)

  if (searchParam !== shownSearchParam) {
    setShownSearchParam(searchParam)
    setSearch(searchParam)
  }

  function getHref(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())

    params.delete('page')

    if (value) {
      params.set(name, value)
    } else {
      params.delete(name)
    }

    return params.size ? `${pathname}?${params.toString()}` : pathname
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

  return (
    // The search takes a row and the selects share the next evenly, two to a
    // row on phones with an odd one out across the whole row
    <div className='mb-4 flex flex-col gap-2'>
      <label className='relative'>
        <span className='sr-only'>{t('search')}</span>
        <MagnifyingGlassIcon
          className='pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-neutral-400'
          aria-hidden='true'
        />
        <input
          type='search'
          className='input input--small pl-8!'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search')}
        />
      </label>
      <div className='grid grid-cols-2 gap-2 sm:flex sm:*:flex-1 [&>:last-child:nth-child(odd)]:max-sm:col-span-2'>
        <PeriodSelect settings={settings} />
        {hasRequests && (
          <FilterSelect
            name='kind'
            label={t('kindLabel')}
            allLabel={t('allKinds')}
            options={[
              { value: 'play', label: t('plays') },
              { value: 'request', label: t('requests') },
            ]}
            onChange={(value) => router.push(getHref('kind', value))}
          />
        )}
        {libraries.length > 1 && (
          <FilterSelect
            name='library'
            label={t('libraryLabel')}
            allLabel={t('allLibraries')}
            options={libraries}
            onChange={(value) => router.push(getHref('library', value))}
          />
        )}
        {users.length > 0 && (
          <FilterSelect
            name='user'
            label={t('userLabel')}
            allLabel={t('allUsers')}
            options={users}
            onChange={(value) => router.push(getHref('user', value))}
          />
        )}
      </div>
    </div>
  )
}

type FilterSelectProps = {
  name: string
  label: string
  allLabel: string
  options: FilterOption[]
  onChange: (value: string) => void
}

function FilterSelect({
  name,
  label,
  allLabel,
  options,
  onChange,
}: FilterSelectProps) {
  const searchParams = useSearchParams()
  const param = searchParams.get(name)
  // A value in the URL that isn't one of the options shows them all
  const value = options.find((option) => option.value === param)?.value ?? ''

  return (
    <div className='input-wrapper'>
      <div className='select-wrapper'>
        <select
          className='input input--small'
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        >
          <option value=''>{allLabel}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
