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
  ReactNode,
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
  // The last field it tests, which the result goes under
  children: ReactNode
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
  children,
}: Props) {
  const t = useTranslations('Settings.Connection')
  const tSettings = useTranslations('Settings')
  const ref = useRef<HTMLDivElement>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [isPending, startTransition] = useTransition()
  // The button stays hidden while a saved connection is checked, so it doesn't
  // flash up before the check says it's connected
  const [isChecking, setIsChecking] = useState(
    isSaved && checkOn?.status !== 'error',
  )
  // Only the latest test's result is shown
  const testId = useRef(0)

  function test(isCheck = false) {
    const form = ref.current?.closest('form')

    if (!form) {
      return
    }

    const id = ++testId.current
    const testedType = mediaServerType

    setIsChecking(isCheck)
    startTransition(async () => {
      const nextResult = await requestTest(service, form, testedType).catch(
        () => ({
          status: 'error' as const,
          message: tSettings('genericError'),
        }),
      )

      if (id === testId.current) {
        setResult(nextResult && { ...nextResult, mediaServerType: testedType })
        setIsChecking(false)
      }
    })
  }

  const testSaved = useEffectEvent(() => {
    if (isSaved && checkOn?.status !== 'error') {
      test(true)
    }
  })

  useEffect(() => {
    testSaved()
  }, [checkOn])

  // A result is about the values it was tested with, so it goes once one of
  // them changes. Those are the section's fields above it, not ones below
  // such as Tracearr's server choice.
  useEffect(() => {
    const section = ref.current?.closest('section')

    if (!section) {
      return
    }

    function clear(event: Event) {
      const field = event.target as Node

      if (
        !ref.current ||
        !(
          ref.current.compareDocumentPosition(field) &
          Node.DOCUMENT_POSITION_PRECEDING
        )
      ) {
        return
      }

      testId.current++
      setResult(null)
      setIsChecking(false)
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
  // Testing the same values again would say the same, so the button comes
  // back once one of them changes
  const hasButton = !isChecking && shownResult?.status !== 'success'

  return (
    <div className='input-with-test'>
      {children}
      <div ref={ref} className='input-test flex flex-col items-start'>
        {/* Kept when empty, so screen readers announce what appears in it */}
        <p
          className={clsx(
            'flex items-start gap-1.5 text-sm',
            isError ? 'text-danger' : 'text-neutral-300',
            (isPending || shownResult) && hasButton && 'mb-3',
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
        {hasButton && (
          <button
            type='button'
            className={clsx(
              'button button-sm button--glass',
              !isPending && !shownResult && 'mt-2',
            )}
            onClick={() => test()}
            disabled={isPending}
            aria-label={t('testService', { service: serviceName })}
          >
            {t('test')}
          </button>
        )}
      </div>
    </div>
  )
}
