'use client'

import {
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useRef, useState, useTransition } from 'react'
import { SendActionResult, sendTestEmail } from '../_actions/sendEmails'

type Props = {
  // The signed-in admin's, where it goes unless they change it
  defaultAddress: string
}

// Sends an email with what's in the mail server's section of the form,
// without saving it
export default function EmailTest({ defaultAddress }: Props) {
  const t = useTranslations('Settings.Email')
  const tSettings = useTranslations('Settings')
  const ref = useRef<HTMLDivElement>(null)
  const [address, setAddress] = useState(defaultAddress)
  const [result, setResult] = useState<SendActionResult | null>(null)
  const [isPending, startTransition] = useTransition()

  function send() {
    const form = ref.current?.closest('form')

    if (!form) {
      return
    }

    const fields = Array.from(
      new FormData(form),
      ([name, value]) => [name, String(value)] as [string, string],
    )

    startTransition(async () => {
      setResult(
        await sendTestEmail(fields, address.trim()).catch(() => ({
          status: 'error' as const,
          message: tSettings('genericError'),
        })),
      )
    })
  }

  const isError = result?.status === 'error'
  const Icon = isError ? ExclamationCircleIcon : CheckCircleIcon

  return (
    <div ref={ref} className='input-wrapper'>
      <div className='flex min-w-0 flex-1 flex-col gap-2'>
        {/* Under the address on phones, where beside it would leave it too
            narrow to read */}
        <div className='flex flex-col items-start gap-2 sm:flex-row sm:items-center'>
          {/* Not a setting, so it has no name and isn't saved */}
          <input
            type='email'
            className='input min-w-0'
            value={address}
            onChange={(e) => {
              setAddress(e.target.value)
              setResult(null)
            }}
            // Not a save of the form it's in
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                send()
              }
            }}
            placeholder='you@example.com'
            aria-label={t('testAddress')}
          />
          <button
            type='button'
            className='button button-sm button--glass shrink-0'
            onClick={send}
            disabled={isPending || !address.trim()}
          >
            {isPending ? t('sending') : t('sendTest')}
          </button>
        </div>
        {/* Kept when empty, so screen readers announce what appears in it */}
        <p
          className={clsx(
            'flex items-start gap-1.5 text-sm empty:hidden',
            isError ? 'text-danger' : 'text-neutral-300',
          )}
          aria-live='polite'
        >
          {result && !isPending && (
            <>
              <Icon
                className={clsx(
                  'mt-0.5 size-4 shrink-0',
                  !isError && 'text-success',
                )}
                aria-hidden='true'
              />
              {result.message}
            </>
          )}
        </p>
      </div>
      <span className='label'>
        <span className='label-wrapper'>{t('testEmail')}</span>
      </span>
    </div>
  )
}
