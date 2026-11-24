import { createFormatter, createTranslator } from 'next-intl'
import { DEFAULT_LOCALE, LOCALES } from './constants'

// The emails go out without a request, often from the schedule, so their
// language is the one in the settings rather than the reader's browser's
export async function getEmailIntl(locale: string) {
  const emailLocale = LOCALES.includes(locale) ? locale : DEFAULT_LOCALE
  const messages = (await import(`../../messages/${emailLocale}.json`)).default
  // The server's, which the schedule also keeps to
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return {
    locale: emailLocale,
    timeZone,
    t: createTranslator({ locale: emailLocale, messages }),
    format: createFormatter({ locale: emailLocale, timeZone }),
  }
}

export type EmailIntl = Awaited<ReturnType<typeof getEmailIntl>>
