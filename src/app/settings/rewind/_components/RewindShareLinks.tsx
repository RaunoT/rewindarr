'use client'

import Avatar from '@/components/Avatar'
import { toastQueue } from '@/components/Toasts'
import {
  ArrowUpOnSquareIcon,
  CheckIcon,
  LinkIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  Suspense,
  use,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react'
import resetShareLinks from '../_actions/resetShareLinks'

export type ShareUser = {
  id: string
  name: string
  thumb: string | null
  // Signed by the server
  path: string
}

type Props = {
  // Read while the rest of the form shows. Null when they couldn't be read.
  users: Promise<ShareUser[] | null>
}

// Up to this many, the list is short enough to scan without a search
const SEARCH_FROM = 5
const COPIED_MS = 2000

// Phones and tablets send it on with their share sheet. Desktops copy it, as
// their share menus are less used than pasting.
function hasShareSheet(): boolean {
  return (
    typeof navigator.share === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  )
}

function subscribe() {
  return () => {}
}

// The clipboard API needs HTTPS or localhost, which a server on the local
// network often isn't
async function copyText(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)

    return
  }

  const textarea = document.createElement('textarea')

  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.append(textarea)
  textarea.select()

  try {
    if (!document.execCommand('copy')) {
      throw new Error('Copy failed')
    }
  } finally {
    textarea.remove()
  }
}

type ButtonProps = {
  user: ShareUser
  // While the links are reset, as these would stop working
  isDisabled: boolean
}

function ShareLinkButton({ user, isDisabled }: ButtonProps) {
  const t = useTranslations('Settings.Rewind')
  const isSheet = useSyncExternalStore(subscribe, hasShareSheet, () => false)
  const [isCopied, setIsCopied] = useState(false)
  const Icon = isSheet ? ArrowUpOnSquareIcon : LinkIcon

  useEffect(() => {
    if (!isCopied) {
      return
    }

    const timeout = setTimeout(() => setIsCopied(false), COPIED_MS)

    return () => clearTimeout(timeout)
  }, [isCopied])

  async function share() {
    // The address the admin uses, which the user can reach too
    const url = new URL(user.path, window.location.origin).href

    if (isSheet) {
      try {
        await navigator.share({ url })

        return
      } catch (error) {
        // Closed without sending
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
      }
    }

    try {
      await copyText(url)
      setIsCopied(true)
    } catch {
      // Errors stay until dismissed, so the link can be copied from it
      toastQueue.add({ message: t('copyError', { url }), status: 'error' })
    }
  }

  return (
    <>
      <button
        type='button'
        className='button-card disabled:opacity-50'
        onClick={share}
        disabled={isDisabled}
        aria-label={t(isSheet ? 'shareLabel' : 'copyLinkLabel', {
          name: user.name,
        })}
      >
        {isCopied ? <CheckIcon className='text-success' /> : <Icon />}
        {/* Both labels take the same room, so the button keeps its width */}
        <span className='grid'>
          <span
            className={clsx('col-start-1 row-start-1', isCopied && 'invisible')}
          >
            {isSheet ? t('share') : t('copyLink')}
          </span>
          <span
            className={clsx(
              'col-start-1 row-start-1',
              !isCopied && 'invisible',
            )}
          >
            {t('copied')}
          </span>
        </span>
      </button>
      <output className='sr-only'>{isCopied ? t('copied') : ''}</output>
    </>
  )
}

type ListProps = {
  users: Promise<ShareUser[] | null>
  isDisabled: boolean
}

function ShareLinkList({ users: usersRequest, isDisabled }: ListProps) {
  const t = useTranslations('Settings.Rewind')
  const users = use(usersRequest)
  const [query, setQuery] = useState('')
  const listRef = useRef<HTMLUListElement>(null)
  const [hasMoreBelow, setHasMoreBelow] = useState(false)
  const search = query.trim().toLocaleLowerCase()
  const shownUsers = users?.filter((user) =>
    user.name.toLocaleLowerCase().includes(search),
  )

  function updateHasMoreBelow() {
    const list = listRef.current

    setHasMoreBelow(
      !!list && list.scrollHeight - list.scrollTop - list.clientHeight > 1,
    )
  }

  // A search can leave the list too short to scroll
  useLayoutEffect(updateHasMoreBelow, [shownUsers?.length])

  if (!users || !shownUsers) {
    return (
      <p className='text-danger text-xs' role='alert'>
        {t('shareLinksError')}
      </p>
    )
  }

  return (
    <div className='grid gap-2'>
      {users.length > SEARCH_FROM && (
        <input
          type='search'
          className='input'
          placeholder={t('shareLinksSearch')}
          aria-label={t('shareLinksSearch')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // Not a save of the form it's in
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
        />
      )}
      {shownUsers.length ? (
        // Half a row shows at the end while it scrolls, fading out while
        // there's more below. The focus rings stay inside the scrolled area.
        <ul
          ref={listRef}
          onScroll={updateHasMoreBelow}
          className={clsx(
            '-mx-1 max-h-68 overflow-y-auto px-1',
            hasMoreBelow && 'mask-b-from-80%',
          )}
        >
          {shownUsers.map((user) => (
            <li
              key={user.id}
              className='flex items-center gap-3 py-2 not-first:border-t not-first:border-white/10'
            >
              <div className='relative size-8 shrink-0 overflow-hidden rounded-full'>
                <Avatar src={user.thumb} name={user.name} sizes='2rem' />
              </div>
              <span className='min-w-0 flex-1 truncate text-sm'>
                {user.name}
              </span>
              <ShareLinkButton user={user} isDisabled={isDisabled} />
            </li>
          ))}
        </ul>
      ) : (
        <p className='py-2 text-sm text-neutral-400'>
          {t('shareLinksNoUsers')}
        </p>
      )}
    </div>
  )
}

// In the form, though copying a link or resetting them saves nothing in it,
// like the background track
export default function RewindShareLinks({ users }: Props) {
  const t = useTranslations('Settings.Rewind')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function reset() {
    startTransition(async () => {
      const isReset = await resetShareLinks()

      toastQueue.add(
        isReset
          ? { message: t('shareLinksResetDone'), status: 'success' }
          : { message: t('shareLinksResetError'), status: 'error' },
        // Errors stay until dismissed, so they can be read
        isReset ? { timeout: 5000 } : undefined,
      )

      // For the new links
      if (isReset) {
        router.refresh()
      }
    })
  }

  return (
    <section className='group-settings group'>
      <h2 className='heading-settings'>{t('shareLinks')}</h2>
      {/* What to know before sending one, where the other settings say what
          they do */}
      <div className='input-wrapper'>
        <div className='min-w-0 flex-1'>
          <Suspense>
            <ShareLinkList users={users} isDisabled={isPending} />
          </Suspense>
        </div>
        <span className='label label--start'>
          <span className='label-wrapper'>{t('shareLinksUsers')}</span>
          <small>{t('shareLinksDescription')}</small>
        </span>
      </div>
      <div className='input-wrapper'>
        <div className='flex min-w-0 flex-1 items-start'>
          <button
            type='button'
            className='button button-sm'
            onClick={reset}
            disabled={isPending}
          >
            {t('shareLinksResetButton')}
          </button>
        </div>
        <span className='label label--start'>
          <span className='label-wrapper'>{t('shareLinksReset')}</span>
          <small>{t('shareLinksResetDescription')}</small>
        </span>
      </div>
    </section>
  )
}
