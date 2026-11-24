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

  // A search can leave the list too short to scroll
  useLayoutEffect(updateHasMoreBelow, [shownIds.size])

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
        className={clsx(
          '-mx-1 max-h-80 overflow-y-auto px-1',
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
