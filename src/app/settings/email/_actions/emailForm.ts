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
// Who was subscribed when the form was opened, so a save only changes the
// ones the admin switched, and not someone who unsubscribed since
export const WAS_SUBSCRIBED_FIELD = 'wasSubscribed'
// The users each list showed, so the ones it couldn't keep their settings.
// The newsletter's list only shows while it's on.
export const ADDRESS_USERS_FIELD = 'addressUsers'
export const SUBSCRIPTION_USERS_FIELD = 'subscriptionUsers'

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

    // Only one of them shows, and the other keeps its day for later
    if (data.newsletterFrequency === 'weekly') {
      data.newsletterWeekday = Number(readText(formData, 'newsletterWeekday'))
    } else {
      data.newsletterMonthDay = Number(readText(formData, 'newsletterMonthDay'))
    }
  }

  const addressUsers = formData.getAll(ADDRESS_USERS_FIELD).map(String)

  if (addressUsers.length) {
    const addresses = { ...saved.addresses }

    for (const userId of addressUsers) {
      const address = readText(formData, `${ADDRESS_FIELD_PREFIX}${userId}`)

      if (address) {
        addresses[userId] = address
      } else {
        delete addresses[userId]
      }
    }

    data.addresses = addresses
  }

  const subscriptionUsers = formData
    .getAll(SUBSCRIPTION_USERS_FIELD)
    .map(String)

  if (subscriptionUsers.length) {
    const subscribed = new Set(formData.getAll(SUBSCRIBED_FIELD).map(String))
    const wasSubscribed = new Set(
      formData.getAll(WAS_SUBSCRIBED_FIELD).map(String),
    )
    const unsubscribed = new Set(saved.unsubscribed)

    for (const userId of subscriptionUsers) {
      const isSubscribed = subscribed.has(userId)

      if (isSubscribed === wasSubscribed.has(userId)) {
        continue
      }

      if (isSubscribed) {
        unsubscribed.delete(userId)
      } else {
        unsubscribed.add(userId)
      }
    }

    data.unsubscribed = [...unsubscribed]
  }

  return data
}
