import { EmailSettings } from '@/types/settings'
import {
  EmailSecurity,
  NewsletterFrequency,
  NewsletterSection,
} from '@/utils/constants'
import type { MailServer } from '@/utils/mailer'
import { normalizeUrl } from '@/utils/url'

// Each user's address and subscription are sent under their ID
export const ADDRESS_FIELD_PREFIX = 'address:'
export const SUBSCRIBED_FIELD = 'subscribed'
// The users the form listed, so the ones it couldn't keep their settings
export const LISTED_USERS_FIELD = 'listedUsers'

function readText(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim()
}

export function readMailServerForm(formData: FormData): MailServer {
  return {
    smtpHost: readText(formData, 'smtpHost'),
    smtpPort: Number(readText(formData, 'smtpPort')),
    smtpSecurity: readText(formData, 'smtpSecurity') as EmailSecurity,
    smtpUser: readText(formData, 'smtpUser'),
    // Spaces can be part of a password
    smtpPassword: String(formData.get('smtpPassword') ?? ''),
    fromAddress: readText(formData, 'fromAddress'),
    fromName: readText(formData, 'fromName'),
  }
}

// The email settings form as sent, before the saved password is restored.
// What's hidden is left out, so the saved values stay.
export function readEmailForm(
  formData: FormData,
  saved: EmailSettings,
): Partial<EmailSettings> {
  const isNewsletterActive = formData.get('isNewsletterActive') === 'on'
  const data: Partial<EmailSettings> = {
    ...readMailServerForm(formData),
    appUrl: normalizeUrl(readText(formData, 'appUrl')),
    locale: readText(formData, 'locale'),
    isNewsletterActive,
    complete: true,
  }

  if (isNewsletterActive) {
    data.newsletterFrequency = readText(
      formData,
      'newsletterFrequency',
    ) as NewsletterFrequency
    data.newsletterHour = Number(readText(formData, 'newsletterHour'))
    data.newsletterSections = formData.getAll(
      'newsletterSections',
    ) as NewsletterSection[]

    // Monthly ones go out on the 1st, so they keep the weekday for later
    if (data.newsletterFrequency === 'weekly') {
      data.newsletterWeekday = Number(readText(formData, 'newsletterWeekday'))
    }
  }

  const listedUsers = formData.getAll(LISTED_USERS_FIELD).map(String)

  if (listedUsers.length) {
    const subscribed = new Set(formData.getAll(SUBSCRIBED_FIELD).map(String))
    const addresses = { ...saved.addresses }

    for (const userId of listedUsers) {
      const address = readText(formData, `${ADDRESS_FIELD_PREFIX}${userId}`)

      if (address) {
        addresses[userId] = address
      } else {
        delete addresses[userId]
      }
    }

    data.addresses = addresses
    data.unsubscribed = [
      ...saved.unsubscribed.filter((userId) => !listedUsers.includes(userId)),
      ...listedUsers.filter((userId) => !subscribed.has(userId)),
    ]
  }

  return data
}
