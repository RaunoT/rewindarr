'use client'

import { toastQueue } from '@/components/Toasts'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import type { SendActionResult } from '../_actions/sendEmails'

type Props = {
  previewHref: string
  // Sends the admin their own, with the saved settings
  send: () => Promise<SendActionResult>
}

// A preview and a copy for the admin, apart from the form's save
export default function EmailTryIt({ previewHref, send }: Props) {
  const t = useTranslations('Settings.Email')
  const tSettings = useTranslations('Settings')
  const [isSending, startSending] = useTransition()

  function sendToMe() {
    startSending(async () => {
      const result = await send().catch(() => ({
        status: 'error' as const,
        message: tSettings('genericError'),
      }))

      toastQueue.add(
        { message: result.message, status: result.status },
        // Errors stay until dismissed, so they can be read
        result.status === 'success' ? { timeout: 5000 } : undefined,
      )
    })
  }

  return (
    <div className='flex flex-wrap gap-2'>
      <a
        href={previewHref}
        target='_blank'
        className='button button-sm button--glass'
      >
        {t('preview')}
      </a>
      <button
        type='button'
        className='button button-sm button--glass'
        onClick={sendToMe}
        disabled={isSending}
      >
        {isSending ? t('sending') : t('sendToMe')}
      </button>
    </div>
  )
}
