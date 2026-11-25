'use client'

import Avatar from '@/components/Avatar'
import clsx from 'clsx'
import { ReactNode, useLayoutEffect, useRef, useState } from 'react'

type ListUser = {
  id: string
  name: string
  thumb: string | null
}

type Props<T extends ListUser> = {
  users: T[]
  searchLabel: string
  emptyLabel: string
  // What follows the user's picture and name in their row
  children: (user: T) => ReactNode
}

// Up to this many, the list is short enough to scan without a search
const SEARCH_FROM = 5
// How many rows show before it scrolls. The half row shows there's more.
const SHOWN_ROWS = 3.5

// The users of a settings form, with a search once there are more than a few.
// Rows the search leaves out are hidden rather than removed, so what's typed
// in them is still sent with the form.
export default function UserSearchList<T extends ListUser>({
  users,
  searchLabel,
  emptyLabel,
  children,
}: Props<T>) {
  const [query, setQuery] = useState('')
  const listRef = useRef<HTMLUListElement>(null)
  const [hasMoreBelow, setHasMoreBelow] = useState(false)
  // Each list's rows are as tall as what follows the names, and taller on
  // phones, where it wraps under them
  const [rowHeight, setRowHeight] = useState<number | null>(null)
  const search = query.trim().toLocaleLowerCase()
  const shownIds = new Set(
    users
      .filter((user) => user.name.toLocaleLowerCase().includes(search))
      .map((user) => user.id),
  )

  function updateHasMoreBelow() {
    const list = listRef.current

    setHasMoreBelow(
      !!list && list.scrollHeight - list.scrollTop - list.clientHeight > 1,
    )
  }

  useLayoutEffect(() => {
    const list = listRef.current

    if (!list) {
      return
    }

    function measure() {
      const row = [...(list?.children ?? [])].find(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && child.offsetHeight > 0,
      )

      if (row) {
        setRowHeight(row.offsetHeight)
      }
    }

    measure()

    // A new width or search can change which row is first, or its height
    const observer = new ResizeObserver(measure)

    observer.observe(list)

    return () => observer.disconnect()
  }, [])

  // A search or a new height can leave the list too short to scroll
  useLayoutEffect(updateHasMoreBelow, [shownIds.size, rowHeight])

  return (
    <div className='grid gap-2'>
      {users.length > SEARCH_FROM && (
        <input
          type='search'
          className='input'
          placeholder={searchLabel}
          aria-label={searchLabel}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // Not a save of the form it's in
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
        />
      )}
      {/* Half a row shows at the end while it scrolls, fading out while
          there's more below. The focus rings stay inside the scrolled area. */}
      <ul
        ref={listRef}
        onScroll={updateHasMoreBelow}
        style={rowHeight ? { maxHeight: rowHeight * SHOWN_ROWS } : undefined}
        className={clsx(
          // Until a row is measured
          '-mx-1 max-h-60 overflow-y-auto px-1',
          hasMoreBelow && 'mask-b-from-80%',
          !shownIds.size && 'hidden',
        )}
      >
        {users.map((user) => (
          <li
            key={user.id}
            className={clsx(
              'flex flex-wrap items-center gap-x-3 gap-y-2 border-white/10 py-2 not-first:border-t',
              !shownIds.has(user.id) && 'hidden',
            )}
          >
            <div className='relative size-8 shrink-0 overflow-hidden rounded-full'>
              <Avatar src={user.thumb} name={user.name} sizes='2rem' />
            </div>
            <span className='min-w-0 flex-1 truncate text-sm'>{user.name}</span>
            {children(user)}
          </li>
        ))}
      </ul>
      {!shownIds.size && (
        <p className='py-2 text-sm text-neutral-400'>{emptyLabel}</p>
      )}
    </div>
  )
}
