import { EmailSettings } from '@/types/settings'
import {
  EmailSecurity,
  NewsletterFrequency,
  NewsletterSection,
} from '@/utils/constants'
import type { MailServer } from '@/utils/mailer'
import { normalizeUrl } from '@/utils/url'

// Each user's address and subscriptions are sent under their ID
export const ADDRESS_FIELD_PREFIX = 'address:'
export const SUBSCRIBED_FIELD = 'subscribed'
export const INVITED_FIELD = 'invited'
// Who was subscribed when the form was opened, so a save only changes the
// ones the admin switched, and not someone who unsubscribed since
export const WAS_SUBSCRIBED_FIELD = 'wasSubscribed'
export const WAS_INVITED_FIELD = 'wasInvited'
// The users each list showed, so the ones it couldn't keep their settings.
// The newsletter's and the invites' lists only show while they're on.
export const ADDRESS_USERS_FIELD = 'addressUsers'
export const SUBSCRIPTION_USERS_FIELD = 'subscriptionUsers'
export const INVITE_USERS_FIELD = 'inviteUsers'
// Sent while the form offers the Rewind invites' switch, so a save without it
// doesn't turn them off
export const INVITE_OFFERED_FIELD = 'isInviteOffered'

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

// Who doesn't get an email after a save: the ones saved, with the switches
// the admin turned changed. Undefined when the list wasn't shown.
function readUnsubscribed(
  formData: FormData,
  saved: string[],
  fields: { users: string; isOn: string; wasOn: string },
): string[] | undefined {
  const userIds = formData.getAll(fields.users).map(String)

  if (!userIds.length) {
    return undefined
  }

  const isOn = new Set(formData.getAll(fields.isOn).map(String))
  const wasOn = new Set(formData.getAll(fields.wasOn).map(String))
  const unsubscribed = new Set(saved)

  for (const userId of userIds) {
    if (isOn.has(userId) === wasOn.has(userId)) {
      continue
    }

    if (isOn.has(userId)) {
      unsubscribed.delete(userId)
    } else {
      unsubscribed.add(userId)
    }
  }

  return [...unsubscribed]
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

  const unsubscribed = readUnsubscribed(formData, saved.unsubscribed, {
    users: SUBSCRIPTION_USERS_FIELD,
    isOn: SUBSCRIBED_FIELD,
    wasOn: WAS_SUBSCRIBED_FIELD,
  })
  const inviteUnsubscribed = readUnsubscribed(
    formData,
    saved.inviteUnsubscribed,
    {
      users: INVITE_USERS_FIELD,
      isOn: INVITED_FIELD,
      wasOn: WAS_INVITED_FIELD,
    },
  )

  if (unsubscribed) {
    data.unsubscribed = unsubscribed
  }

  if (inviteUnsubscribed) {
    data.inviteUnsubscribed = inviteUnsubscribed
  }

  return data
}
