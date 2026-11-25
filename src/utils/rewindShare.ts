import { Settings } from '@/types/settings'
import { createHmac, timingSafeEqual } from 'crypto'

// Lets a shared Rewind's music through the routes that stream it, which a
// visitor who isn't signed in can't reach otherwise
export const REWIND_SHARE_COOKIE = 'rewind-share'
// The user whose shared Rewind the proxy found in the URL, for the layout
export const REWIND_SHARE_HEADER = 'x-rewind-share'

// 128 bits of the signature, so the links stay short
const KEY_BYTES = 16

type ShareSettings = Pick<Settings, 'rewind' | 'general'>

// Signed with the version, so resetting the links stops the old ones working
function signUser(settings: ShareSettings, userId: string): Buffer | null {
  const secret = process.env.NEXTAUTH_SECRET

  if (!secret) {
    return null
  }

  return createHmac('sha256', secret)
    .update(`rewind-share:${settings.rewind.shareVersion}:${userId}`)
    .digest()
    .subarray(0, KEY_BYTES)
}

// Shared Rewinds open as long as users can see their own
export function canShareRewind(settings: ShareSettings): boolean {
  return settings.rewind.isActive && !settings.rewind.isAdminOnly
}

// Opens the user's Rewind for anyone who has it, signed in or not
export function getRewindSharePath(
  settings: ShareSettings,
  userId: string,
): string | null {
  const key = canShareRewind(settings) && signUser(settings, userId)

  if (!key) {
    return null
  }

  return `/rewind?${new URLSearchParams({ userId, key: key.toString('base64url') })}`
}

export function isRewindShareKey(
  settings: ShareSettings,
  userId: unknown,
  key: unknown,
): boolean {
  // A repeated search param is a list
  if (
    typeof userId !== 'string' ||
    typeof key !== 'string' ||
    !userId ||
    !canShareRewind(settings) ||
    // Their Rewind isn't open to anyone, as it isn't to admins
    settings.general.excludedUsers.includes(userId)
  ) {
    return false
  }

  const signature = signUser(settings, userId)

  if (!signature) {
    return false
  }

  // As text, as decoding would accept other spellings of the last character
  const expected = Buffer.from(signature.toString('base64url'))
  const given = Buffer.from(key)

  return given.length === expected.length && timingSafeEqual(given, expected)
}

export function toShareCookie(userId: string, key: string): string {
  return `${userId}:${key}`
}

// The key has no colons, so the user ID is everything before the last one
export function isRewindShareCookie(
  settings: ShareSettings,
  value: string | null | undefined,
): boolean {
  const separator = value?.lastIndexOf(':') ?? -1

  return (
    !!value &&
    separator > 0 &&
    isRewindShareKey(
      settings,
      value.slice(0, separator),
      value.slice(separator + 1),
    )
  )
}
