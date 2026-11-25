'use client'

import StatusMessage from '@/components/StatusMessage'
import { isLocale, matchLocale } from '@/i18n/matchLocale'
import '@/styles/globals.css'
import { DEFAULT_LOCALE, Locale, LOCALE_COOKIE_NAME } from '@/utils/constants'
import { getCookie } from '@/utils/cookies'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import {
  AbstractIntlMessages,
  NextIntlClientProvider,
  useTranslations,
} from 'next-intl'
import { useEffect, useState, useSyncExternalStore } from 'react'

type Props = {
  error: Error
}

// Other locales load on demand, so they don't add to every page's bundle.
const ENGLISH_MESSAGES: AbstractIntlMessages = {
  Error: {
    title: 'Uh oh. Something went wrong!',
    cta: 'Try again',
  },
}

function subscribe() {
  return () => {}
}

// The root layout, and with it the locale provider, is gone, so the locale
// cookie and browser languages are read directly.
function getLocale(): Locale {
  const locale = getCookie(LOCALE_COOKIE_NAME)

  if (isLocale(locale)) {
    return locale
  }

  const browserLanguages =
    typeof navigator !== 'undefined'
      ? navigator.languages?.length
        ? navigator.languages
        : navigator.language
          ? [navigator.language]
          : []
      : []

  return matchLocale(browserLanguages) ?? DEFAULT_LOCALE
}

function ErrorContent({ error }: Props) {
  const t = useTranslations('Error')

  useEffect(() => {
    console.error('[APP] - ', error)
  }, [error])

  return (
    <main className='flex min-h-dvh flex-col px-4 py-6'>
      <StatusMessage
        icon={ExclamationTriangleIcon}
        title={t('title')}
        as='h1'
        action={
          <button
            type='button'
            className='button w-full'
            onClick={() => window.location.reload()}
          >
            {t('cta')}
          </button>
        }
      />
    </main>
  )
}

export default function GlobalError({ error }: Props) {
  const locale = useSyncExternalStore(
    subscribe,
    getLocale,
    () => DEFAULT_LOCALE,
  )
  const [messages, setMessages] = useState(ENGLISH_MESSAGES)

  useEffect(() => {
    if (locale.startsWith('en-')) {
      return
    }

    import(`../../messages/${locale}.json`)
      .then((module) => setMessages({ Error: module.default.Error }))
      .catch((importError) =>
        console.error('[APP] - Failed to load translations!', importError),
      )
  }, [locale])

  return (
    <html lang={locale}>
      <body className='h-full min-h-dvh bg-black text-white'>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ErrorContent error={error} />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
