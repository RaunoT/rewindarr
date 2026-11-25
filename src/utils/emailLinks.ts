import { Settings } from '@/types/settings'
import { createHmac, timingSafeEqual } from 'crypto'
import { getSiteUrl } from './constants'
import { getRewindSharePath } from './rewindShare'
import { normalizeUrl } from './url'

export const UNSUBSCRIBE_PATH = '/api/email/unsubscribe'

// 128 bits of the signature, so the links stay short
const KEY_BYTES = 16

// The address the emails link to: the one set for them, or the app's own.
// Null without either, as a link to the admin's localhost would lead nowhere.
export function getAppUrl(settings: Pick<Settings, 'email'>): string | null {
  const url = normalizeUrl(settings.email.appUrl || getSiteUrl())

  return isWebUrl(url) ? url : null
}

// Links in emails only work from an http or https address
export function isWebUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)

    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

export function toAppUrl(appUrl: string, path: string): string {
  return new URL(path, `${appUrl}/`).href
}

function signUnsubscribe(userId: string): Buffer | null {
  const secret = process.env.NEXTAUTH_SECRET

  if (!secret) {
    return null
  }

  return createHmac('sha256', secret)
    .update(`email-unsubscribe:${userId}`)
    .digest()
    .subarray(0, KEY_BYTES)
}

// Lets the user stop the newsletter without signing in
export function getUnsubscribeUrl(
  appUrl: string,
  userId: string,
): string | null {
  const key = signUnsubscribe(userId)

  if (!key) {
    return null
  }

  return toAppUrl(
    appUrl,
    `${UNSUBSCRIBE_PATH}?${new URLSearchParams({ userId, key: key.toString('base64url') })}`,
  )
}

export function isUnsubscribeKey(userId: unknown, key: unknown): boolean {
  if (typeof userId !== 'string' || typeof key !== 'string' || !userId) {
    return false
  }

  const signature = signUnsubscribe(userId)

  if (!signature) {
    return false
  }

  // As text, as decoding would accept other spellings of the last character
  const expected = Buffer.from(signature.toString('base64url'))
  const given = Buffer.from(key)

  return given.length === expected.length && timingSafeEqual(given, expected)
}

// Null while users can't open their own Rewind
export function getRewindShareUrl(
  settings: Settings,
  appUrl: string,
  userId: string,
): string | null {
  const path = getRewindSharePath(settings, userId)

  return path ? toAppUrl(appUrl, path) : null
}
