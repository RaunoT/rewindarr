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
    // Laid out like the connection tests: the result and the button go under
    // the field
    <div className='input-with-test'>
      <label className='input-wrapper'>
        {/* Not a setting, so it has no name and isn't saved */}
        <input
          type='email'
          className='input'
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
        <span className='label'>
          <span className='label-wrapper'>{t('testEmail')}</span>
        </span>
      </label>
      <div ref={ref} className='input-test flex flex-col items-start'>
        {/* Kept when empty, so screen readers announce what appears in it */}
        <p
          className={clsx(
            'flex items-start gap-1.5 text-sm',
            isError ? 'text-danger' : 'text-neutral-300',
            (isPending || result) && 'mb-3',
          )}
          aria-live='polite'
        >
          {isPending ? (
            t('sending')
          ) : result ? (
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
          ) : null}
        </p>
        <button
          type='button'
          className={clsx(
            'button button-sm button--glass',
            !isPending && !result && 'mt-2',
          )}
          onClick={send}
          disabled={isPending || !address.trim()}
        >
          {t('sendTest')}
        </button>
      </div>
    </div>
  )
}
