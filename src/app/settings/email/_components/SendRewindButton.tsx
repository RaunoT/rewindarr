'use client'

import { toastQueue } from '@/components/Toasts'
import { CheckIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { sendRewind } from '../_actions/sendEmails'

type SendUser = {
  id: string
  name: string
  // The saved one their emails go to, empty when there's nowhere
  address: string
}

type SendState = 'pending' | 'sent'

// Emails a user the invite to their Rewind straight away, apart from the
// form's save
export function useRewindSends() {
  const t = useTranslations('Settings.Rewind')
  const tEmail = useTranslations('Settings.Email')
  const tSettings = useTranslations('Settings')
  const [states, setStates] = useState<Partial<Record<string, SendState>>>({})

  function setState(user: SendUser, state?: SendState) {
    setStates((states) => ({ ...states, [user.id]: state }))
  }

  // Not in a transition, so a send to one user doesn't wait for another's
  async function send(user: SendUser) {
    setState(user, 'pending')

    const result = await sendRewind([user.id]).catch(() => ({
      status: 'error' as const,
      message: tSettings('genericError'),
      outcomes: undefined,
    }))
    const outcome = result.outcomes?.find(({ userId }) => userId === user.id)

    if (outcome?.status === 'sent') {
      setState(user, 'sent')

      return
    }

    setState(user, undefined)

    const reason = outcome?.reason
      ? outcome.status === 'skipped'
        ? tEmail(`skipReasons.${outcome.reason}`)
        : tEmail(outcome.reason)
      : // Removed or excluded since the page was opened
        result.outcomes && !outcome
        ? tEmail('previewNoUser')
        : result.message

    // Errors stay until dismissed, so they can be read
    toastQueue.add({
      message: t('emailError', { name: user.name, reason }),
      status: 'error',
    })
  }

  return { states, send }
}

type Props = {
  user: SendUser
  state?: SendState
  onSend: () => void
}

export default function SendRewindButton({ user, state, onSend }: Props) {
  const t = useTranslations('Settings.Rewind')
  const tEmail = useTranslations('Settings.Email')
  const isPending = state === 'pending'
  const isSent = state === 'sent'

  function send() {
    // Still focusable and pressable, so the reason reaches touch and
    // keyboard users too
    if (!user.address) {
      toastQueue.add(
        {
          message: t('emailError', {
            name: user.name,
            reason: tEmail('skipReasons.noAddress'),
          }),
          status: 'error',
        },
        { timeout: 5000 },
      )

      return
    }

    onSend()
  }

  return (
    <>
      <button
        type='button'
        className='button-card shrink-0 disabled:opacity-50 aria-disabled:opacity-50'
        onClick={send}
        disabled={isPending}
        aria-disabled={!user.address || undefined}
        title={user.address ? undefined : tEmail('noAddress')}
        aria-label={t('emailLabel', { name: user.name })}
      >
        {isSent ? (
          <CheckIcon className='text-success' />
        ) : (
          <PaperAirplaneIcon className={clsx(isPending && 'animate-pulse')} />
        )}
        {/* Only the icon while the address needs the room. Labels stacked in
            one cell, so the button keeps the width of the longer one. */}
        <span className='grid @max-md:hidden'>
          {[t('sendNow'), t('sent')].map((label, index) => (
            <span
              key={index}
              className={clsx(
                'col-start-1 row-start-1',
                label !== (isSent ? t('sent') : t('sendNow')) && 'invisible',
              )}
            >
              {label}
            </span>
          ))}
        </span>
      </button>
      <output className='sr-only'>{isSent ? t('sent') : ''}</output>
    </>
  )
}
