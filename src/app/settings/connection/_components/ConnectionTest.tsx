'use client'

import {
  ConnectionTestResult,
  MediaServerType,
  TestedService,
} from '@/types/settings'
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
} from 'react'

type Props = {
  service: TestedService
  // Tells the buttons apart for screen readers
  serviceName: string
  mediaServerType: MediaServerType
  // A saved connection is tested when the page opens, and again after each
  // save. A failed save leaves values in the form that weren't saved.
  isSaved: boolean
  checkOn?: { status: string }
}

type Result = ConnectionTestResult & {
  // A media server result is only about the server it was tested as
  mediaServerType: MediaServerType
}

async function requestTest(
  service: TestedService,
  form: HTMLFormElement,
  mediaServerType: MediaServerType,
): Promise<ConnectionTestResult | null> {
  const response = await fetch('/api/settings/connection-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service,
      mediaServerType,
      fields: Array.from(new FormData(form), ([name, value]) => [
        name,
        String(value),
      ]),
    }),
  })

  return response.ok ? response.json() : null
}

// Tests a service with what's in its section of the form, without saving it
export default function ConnectionTest({
  service,
  serviceName,
  mediaServerType,
  isSaved,
  checkOn,
}: Props) {
  const t = useTranslations('Settings.Connection')
  const tSettings = useTranslations('Settings')
  const ref = useRef<HTMLDivElement>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [isPending, startTransition] = useTransition()
  // Only the latest test's result is shown
  const testId = useRef(0)

  function test() {
    const form = ref.current?.closest('form')

    if (!form) {
      return
    }

    const id = ++testId.current
    const testedType = mediaServerType

    startTransition(async () => {
      const nextResult = await requestTest(service, form, testedType).catch(
        () => ({
          status: 'error' as const,
          message: tSettings('genericError'),
        }),
      )

      if (id === testId.current) {
        setResult(nextResult && { ...nextResult, mediaServerType: testedType })
      }
    })
  }

  const testSaved = useEffectEvent(() => {
    if (isSaved && checkOn?.status !== 'error') {
      test()
    }
  })

  useEffect(() => {
    testSaved()
  }, [checkOn])

  // A result is about the values it was tested with, so it goes once one of
  // them changes
  useEffect(() => {
    const section = ref.current?.closest('section')

    if (!section) {
      return
    }

    function clear(event: Event) {
      if (ref.current?.contains(event.target as Node)) {
        return
      }

      testId.current++
      setResult(null)
    }

    section.addEventListener('input', clear)
    section.addEventListener('change', clear)

    return () => {
      section.removeEventListener('input', clear)
      section.removeEventListener('change', clear)
    }
  }, [])

  const shownResult =
    service === 'mediaServer' && result?.mediaServerType !== mediaServerType
      ? null
      : result
  const isError = shownResult?.status === 'error'
  const Icon = isError ? ExclamationCircleIcon : CheckCircleIcon

  return (
    <div ref={ref} className='flex flex-col items-start sm:pl-50'>
      {/* Under the inputs it's about, closer to them than the next row. Kept
          when empty, so screen readers announce what appears in it. */}
      <p
        className={clsx(
          'flex items-start gap-1.5 text-sm',
          isError ? 'text-danger' : 'text-neutral-300',
          (isPending || shownResult) && '-mt-2 mb-3',
        )}
        aria-live='polite'
      >
        {isPending ? (
          t('testing')
        ) : shownResult ? (
          <>
            <Icon
              className={clsx(
                'mt-0.5 size-4 shrink-0',
                !isError && 'text-success',
              )}
              aria-hidden='true'
            />
            {shownResult.message}
          </>
        ) : null}
      </p>
      <button
        type='button'
        className='button button-sm button--glass'
        onClick={test}
        disabled={isPending}
        aria-label={t('testService', { service: serviceName })}
      >
        {t('test')}
      </button>
    </div>
  )
}
