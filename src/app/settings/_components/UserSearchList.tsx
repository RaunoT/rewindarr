'use client'

import Avatar from '@/components/Avatar'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { FormEvent, ReactNode, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

type ListUser = {
  id: string
  name: string
  thumb: string | null
}

type Props<T extends ListUser> = {
  users: T[]
  searchLabel: string
  emptyLabel: string
  // The names of the columns, above the rows
  header?: ReactNode
  // What applies to the whole list, at its end
  footer?: ReactNode
  // What follows the user's picture and name in their row
  children: (user: T) => ReactNode
}

// How many rows show until the rest are asked for
const SHOWN_ROWS = 5
// The fewest rows worth a button to show them
const MIN_HIDDEN_ROWS = 2

// The users of a settings form in a card, which grows with the page rather
// than scrolling by itself. A container, so rows can lay out by its width. A long list starts with its first rows, and has a
// search. Rows that aren't shown are hidden rather than removed, so what's
// typed in them is still sent with the form.
export default function UserSearchList<T extends ListUser>({
  users,
  searchLabel,
  emptyLabel,
  header,
  footer,
  children,
}: Props<T>) {
  const t = useTranslations('Common')
  const [query, setQuery] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)
  const isLong = users.length >= SHOWN_ROWS + MIN_HIDDEN_ROWS
  const search = query.trim().toLocaleLowerCase()
  const found = users.filter((user) =>
    user.name.toLocaleLowerCase().includes(search),
  )
  // A search shows all it finds
  const shown =
    isLong && !isExpanded && !search ? found.slice(0, SHOWN_ROWS) : found
  const shownIds = new Set(shown.map((user) => user.id))
  const hiddenCount = found.length - shown.length
  const hasToggle = isLong && !search

  function toggle() {
    if (isExpanded) {
      setIsExpanded(false)

      return
    }

    // Drawn first, so the first of the new rows can take the focus, and Tab
    // goes on into it rather than past the whole list
    flushSync(() => setIsExpanded(true))

    const row = listRef.current?.children[SHOWN_ROWS]

    if (row instanceof HTMLElement) {
      row.focus({ preventScroll: true })
    }
  }

  // The browser can't point at a field that fails its check in a row that
  // isn't shown, and the save would just do nothing. Shows the row first.
  function showInvalid(event: FormEvent<HTMLUListElement>) {
    const field = event.target

    if (!(field instanceof HTMLInputElement) || field.offsetParent) {
      return
    }

    event.preventDefault()
    flushSync(() => {
      setQuery('')
      setIsExpanded(true)
    })
    // After the form's own check is done
    requestAnimationFrame(() => field.reportValidity())
  }

  return (
    <div className='@container rounded-2xl bg-white/5 ring-1 ring-white/10 ring-inset'>
      {isLong && (
        <div className='border-b border-white/10 p-2'>
          <input
            type='search'
            className='input text-sm'
            placeholder={searchLabel}
            aria-label={searchLabel}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Not a save of the form it's in
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          />
        </div>
      )}
      {/* Nothing for them to name or apply to when a search finds no one */}
      {!!shown.length && header}
      <ul
        ref={listRef}
        className={clsx(!shown.length && 'hidden')}
        onInvalidCapture={showInvalid}
      >
        {users.map((user) => (
          <li
            key={user.id}
            // For the focus after the rest are shown
            tabIndex={-1}
            className={clsx(
              'flex flex-wrap items-center gap-x-3 gap-y-2 border-white/10 px-3 py-2 outline-none',
              user.id !== shown[0]?.id && 'border-t',
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
      {!shown.length && (
        <p className='px-3 py-6 text-center text-sm text-neutral-400'>
          {emptyLabel}
        </p>
      )}
      {!!shown.length && (hasToggle || footer) && (
        <div className='flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/10 px-2 py-2'>
          {hasToggle && (
            <button
              type='button'
              className='show-more'
              onClick={toggle}
              aria-expanded={isExpanded}
            >
              {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
              {isExpanded
                ? t('showLess')
                : t('showMoreCount', { count: hiddenCount })}
            </button>
          )}
          {footer && (
            <div className='ml-auto flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-2'>
              {footer}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
