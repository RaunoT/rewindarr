import { Settings } from '@/types/settings'
import { createHmac, timingSafeEqual } from 'crypto'
import { getSiteUrl } from './constants'
import { getImageProxyUrl } from './imageProxy'
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

// Names that only resolve at home or on a tailnet
const PRIVATE_SUFFIXES = [
  '.localhost',
  '.local',
  '.lan',
  '.home',
  '.internal',
  '.home.arpa',
  '.ts.net',
]

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map(Number)

  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false
  }

  const [a, b] = parts

  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    // Carrier-grade NAT, which Tailscale uses
    (a === 100 && b >= 64 && b <= 127)
  )
}

// Whether the address looks reachable from the internet, so mail apps that
// load pictures through their own servers, like Gmail, can load the app's.
// A domain that only resolves at home still looks public.
export function isPublicUrl(url: string): boolean {
  if (!URL.canParse(url)) {
    return false
  }

  const host = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, '')

  if (host.includes(':')) {
    return !(host === '::1' || /^f[cd]/.test(host) || host.startsWith('fe80'))
  }

  return (
    host.includes('.') &&
    host !== 'localhost' &&
    !PRIVATE_SUFFIXES.some((suffix) => host.endsWith(suffix)) &&
    !isPrivateIpv4(host)
  )
}

// A picture as the app shows it: TMDB's as it is, and the rest through the
// app's image route
export function toAppImageUrl(
  appUrl: string,
  image: string | null | undefined,
): string | null {
  if (!image) {
    return null
  }

  if (image.startsWith('https://image.tmdb.org')) {
    return image
  }

  return toAppUrl(
    appUrl,
    image.startsWith('/api/image') ? image : getImageProxyUrl(image),
  )
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
