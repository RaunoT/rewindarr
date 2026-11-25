import { Settings } from '@/types/settings'
import { SourceUser } from '@/types/statsSource'
import { fetchSeerrEmails } from './fetchSeerr'
import { normalizeJellyfinId } from './mediaServer'
import { getActiveUsers } from './statsSource'

export type EmailRecipient = {
  id: string
  name: string
  thumb: string | null
  // The one the admin set, empty without one
  customAddress: string
  // The statistics source's, or else Seerr's
  foundAddress: string
  // Where their emails go, empty when there's nowhere
  address: string
  isSubscribed: boolean
}

// Loose on purpose: the mail server is the one to tell what it can deliver to.
// Without the characters that would make it a list or a named address, so
// it's always one mailbox.
const EMAIL_PATTERN = /^[^\s@,;<>()"]+@[^\s@,;<>()"]+\.[^\s@,;<>()"]+$/

export function isEmailAddress(value: string): boolean {
  return EMAIL_PATTERN.test(value)
}

// Seerr knows a user by the ID they sign in with, which for Jellyfin is
// written without dashes
function getSeerrKey(settings: Settings, userId: string): string {
  return settings.connection.mediaServerType === 'jellyfin'
    ? normalizeJellyfinId(userId)
    : userId
}

export function toEmailRecipient(
  settings: Settings,
  user: SourceUser,
  seerrEmails: Map<string, string> | null,
): EmailRecipient {
  const id = String(user.user_id)
  const customAddress = settings.email.addresses[id]?.trim() ?? ''
  const foundAddress =
    [user.email, seerrEmails?.get(getSeerrKey(settings, id))]
      .map((address) => address?.trim() ?? '')
      .find(isEmailAddress) ?? ''

  return {
    id,
    name: user.friendly_name,
    thumb: user.user_thumb || user.thumb || null,
    customAddress,
    foundAddress,
    address: customAddress || foundAddress,
    isSubscribed: !settings.email.unsubscribed.includes(id),
  }
}

// Every user who isn't excluded, by name, with or without an address
export async function getEmailRecipients(
  settings: Settings,
): Promise<EmailRecipient[]> {
  const [users, seerrEmails] = await Promise.all([
    getActiveUsers(settings),
    fetchSeerrEmails(),
  ])

  return users
    .map((user) => toEmailRecipient(settings, user, seerrEmails))
    .sort((a, b) => a.name.localeCompare(b.name))
}
