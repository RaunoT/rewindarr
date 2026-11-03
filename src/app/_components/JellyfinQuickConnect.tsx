'use client'

import {
  checkJellyfinQuickConnect,
  startJellyfinQuickConnect,
} from '@/app/_actions/jellyfinQuickConnect'
import Loader from '@/components/Loader'
import { LoginErrorCode } from '@/lib/loginError'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import signInWithJellyfin from './signInWithJellyfin'

// How often Jellyfin is asked whether the code has been entered
const POLL_INTERVAL_MS = 3000

type Status =
  | { step: 'starting' }
  | { step: 'waiting'; code: string }
  | { step: 'failed'; error: LoginErrorCode }

type Props = {
  onCancel: () => void
}

export default function JellyfinQuickConnect({ onCancel }: Props) {
  const t = useTranslations('Home')
  const [status, setStatus] = useState<Status>({ step: 'starting' })
  // Bumped to ask for a new code
  const [attempt, setAttempt] = useState<number>(0)

  useEffect(() => {
    let isCancelled = false
    let timeout: ReturnType<typeof setTimeout> | undefined

    function fail(error: LoginErrorCode) {
      if (!isCancelled) {
        setStatus({ step: 'failed', error })
      }
    }

    async function poll(secret: string) {
      const res = await checkJellyfinQuickConnect(secret).catch(() => null)

      if (isCancelled) {
        return
      }

      if (!res) {
        fail('unknown')

        return
      }

      if (!res.ok) {
        fail(res.error)

        return
      }

      if (res.value === 'expired') {
        fail('jellyfinQuickConnectExpired')

        return
      }

      if (res.value === 'waiting') {
        timeout = setTimeout(() => poll(secret), POLL_INTERVAL_MS)

        return
      }

      fail(await signInWithJellyfin('jellyfin-quick-connect', { secret }))
    }

    async function start() {
      const res = await startJellyfinQuickConnect().catch(() => null)

      if (isCancelled) {
        return
      }

      if (!res) {
        fail('unknown')

        return
      }

      if (!res.ok) {
        fail(res.error)

        return
      }

      setStatus({ step: 'waiting', code: res.value.code })
      timeout = setTimeout(() => poll(res.value.secret), POLL_INTERVAL_MS)
    }

    start()

    return () => {
      isCancelled = true
      clearTimeout(timeout)
    }
  }, [attempt])

  function handleRetry() {
    setStatus({ step: 'starting' })
    setAttempt((value) => value + 1)
  }

  return (
    <div className='flex w-full flex-col items-center gap-3 text-center'>
      {status.step === 'starting' && (
        <div className='py-4'>
          <Loader size={6} />
        </div>
      )}
      {status.step === 'waiting' && (
        <>
          <p className='text-sm text-neutral-300'>
            {t('quickConnectDescription')}
          </p>
          {/* Spaced out for screen readers, which would read it as a number */}
          <p
            className='font-mono text-4xl font-bold tracking-[0.2em] tabular-nums'
            aria-label={status.code.split('').join(' ')}
          >
            {status.code}
          </p>
          <p role='status' className='text-sm text-neutral-400'>
            {t('quickConnectWaiting')}
          </p>
        </>
      )}
      {status.step === 'failed' && (
        <>
          <p role='alert' className='text-danger text-sm'>
            {t(`loginError.${status.error}`)}
          </p>
          {status.error !== 'jellyfinQuickConnectDisabled' && (
            <button
              type='button'
              className='button button--jellyfin w-full'
              onClick={handleRetry}
            >
              {t('quickConnectRetry')}
            </button>
          )}
        </>
      )}
      <button type='button' className='link text-sm' onClick={onCancel}>
        {t('usePassword')}
      </button>
    </div>
  )
}
