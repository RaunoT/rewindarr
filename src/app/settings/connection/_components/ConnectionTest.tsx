'use client'

import { MediaServerType } from '@/types/settings'
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
import {
  ConnectionTestResult,
  testConnection,
  TestedService,
} from '../_actions/testConnection'

type Props = {
  service: TestedService
  mediaServerType: MediaServerType
  // A saved connection is tested when the page opens, and again whenever
  // this changes, such as on a save
  isSaved: boolean
  checkOn?: unknown
}

// Tests a service with what's in its section of the form, without saving it
export default function ConnectionTest({
  service,
  mediaServerType,
  isSaved,
  checkOn,
}: Props) {
  const t = useTranslations('Settings.Connection')
  const ref = useRef<HTMLDivElement>(null)
  const [result, setResult] = useState<ConnectionTestResult | null>(null)
  const [isPending, startTransition] = useTransition()
  // Only the latest test's result is shown
  const testId = useRef(0)

  function test() {
    const form = ref.current?.closest('form')

    if (!form) {
      return
    }

    const id = ++testId.current
    const formData = new FormData(form)

    startTransition(async () => {
      const nextResult = await testConnection(
        service,
        formData,
        mediaServerType,
      )

      if (id === testId.current) {
        setResult(nextResult)
      }
    })
  }

  const testSaved = useEffectEvent(() => {
    if (isSaved) {
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

  const isError = result?.status === 'error'
  const Icon = isError ? ExclamationCircleIcon : CheckCircleIcon

  return (
    <div ref={ref} className='flex flex-col items-start sm:pl-50'>
      {/* Under the inputs it's about, closer to them than the next row. Kept
          when empty, so screen readers announce what appears in it. */}
      <p
        className={clsx(
          'flex items-start gap-1.5 text-sm',
          isError ? 'text-danger' : 'text-neutral-300',
          (isPending || result) && '-mt-2 mb-3',
        )}
        aria-live='polite'
      >
        {isPending ? (
          t('testing')
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
        className='button button-sm button--glass'
        onClick={test}
        disabled={isPending}
      >
        {t('test')}
      </button>
    </div>
  )
}
