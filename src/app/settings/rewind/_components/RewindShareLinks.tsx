'use client'

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
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react'
import UserSearchList from '../../_components/UserSearchList'
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

// Labels stacked in one cell, so the button keeps the width of the longest
function StackedLabels({
  labels,
  shown,
  className = 'grid',
}: {
  labels: string[]
  shown: string
  className?: string
}) {
  return (
    <span className={className}>
      {labels.map((label, index) => (
        <span
          key={index}
          className={clsx(
            'col-start-1 row-start-1',
            label !== shown && 'invisible',
          )}
        >
          {label}
        </span>
      ))}
    </span>
  )
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
        <StackedLabels
          labels={[isSheet ? t('share') : t('copyLink'), t('copied')]}
          shown={isCopied ? t('copied') : isSheet ? t('share') : t('copyLink')}
        />
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

  if (!users) {
    return (
      <p className='text-danger text-xs' role='alert'>
        {t('shareLinksError')}
      </p>
    )
  }

  return (
    <UserSearchList
      users={users}
      searchLabel={t('shareLinksSearch')}
      emptyLabel={t('shareLinksNoUsers')}
    >
      {(user) => <ShareLinkButton user={user} isDisabled={isDisabled} />}
    </UserSearchList>
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
    <div className='input-wrapper'>
      <div className='grid min-w-0 flex-1 gap-3'>
        <Suspense>
          <ShareLinkList users={users} isDisabled={isPending} />
        </Suspense>
        {/* Under the list it applies to, with what it does beside it */}
        <div className='flex flex-wrap items-center gap-x-3 gap-y-2'>
          <button
            type='button'
            className='button button-sm button--glass'
            onClick={reset}
            disabled={isPending}
          >
            {t('shareLinksReset')}
          </button>
          <p className='text-xs text-neutral-400'>
            {t('shareLinksResetDescription')}
          </p>
        </div>
      </div>
      <span className='label label--start'>
        <span className='label-wrapper'>{t('shareLinksUsers')}</span>
        <small>{t('shareLinksDescription')}</small>
      </span>
    </div>
  )
}
