import { APP_NAME } from '../utils/constants'
import { normalizeJellyfinId } from '../utils/mediaServer'
import { LoginError } from './loginError'

const REQUEST_TIMEOUT_MS = 15_000

type JellyfinAuthResponse = {
  User?: {
    Id?: string
    Name?: string
    Policy?: { IsAdministrator?: boolean }
  }
  AccessToken?: string
}

export type JellyfinUser = {
  id: string
  name: string
  isAdmin: boolean
}

// Jellyfin names the client in every request, and the token once signed in
function getAuthorization(token?: string): string {
  const version = process.env.NEXT_PUBLIC_VERSION_TAG || 'dev'
  const fields = [
    `Client="${APP_NAME}"`,
    `Device="${APP_NAME}"`,
    `DeviceId="${APP_NAME.toLowerCase()}"`,
    `Version="${version}"`,
    ...(token ? [`Token="${token}"`] : []),
  ]

  return `MediaBrowser ${fields.join(', ')}`
}

// Only the user is needed, so the session Jellyfin starts is ended straight
// away rather than left in its devices list.
async function logOut(url: string, token: string): Promise<void> {
  try {
    await fetch(`${url}/Sessions/Logout`, {
      method: 'POST',
      headers: { Authorization: getAuthorization(token) },
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    console.warn("[AUTH] - Couldn't end the Jellyfin session!", error)
  }
}

type QuickConnectResponse = {
  Secret?: string
  Code?: string
  Authenticated?: boolean
}

export type QuickConnectRequest = {
  code: string
  secret: string
}

export type QuickConnectState = 'waiting' | 'authorized' | 'expired'

// The path is left out of the log, as the Quick Connect status path holds
// the secret
async function request(
  url: string,
  path: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetch(`${url}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: getAuthorization(),
        ...init.headers,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    console.error(`[AUTH] - Couldn't reach Jellyfin at ${url}!`, error)

    throw new LoginError('jellyfinUnavailable')
  }
}

function failUnexpected(res: Response): never {
  console.error('[AUTH] - Jellyfin sign-in failed!', res.status, res.statusText)

  throw new LoginError('jellyfinUnavailable')
}

// Jellyfin starts a session for each sign-in, which is ended once the user
// is read from it
async function readUser(
  url: string,
  res: Response,
  fallbackName: string,
): Promise<JellyfinUser> {
  const data: JellyfinAuthResponse | null = await res.json().catch(() => null)

  if (data?.AccessToken) {
    await logOut(url, data.AccessToken)
  }

  if (!data?.User?.Id) {
    console.error('[AUTH] - Jellyfin sent no user!')

    throw new LoginError('jellyfinUnavailable')
  }

  return {
    id: normalizeJellyfinId(data.User.Id),
    name: data.User.Name || fallbackName,
    isAdmin: !!data.User.Policy?.IsAdministrator,
  }
}

export async function authenticateJellyfinUser(
  url: string,
  username: string,
  password: string,
): Promise<JellyfinUser> {
  const res = await request(url, '/Users/AuthenticateByName', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Username: username, Pw: password }),
  })

  // Jellyfin answers a wrong password with 401, and a disabled user with 403
  if (res.status === 401 || res.status === 403) {
    throw new LoginError('jellyfinCredentials')
  }

  if (!res.ok) {
    failUnexpected(res)
  }

  return readUser(url, res, username)
}

// Quick Connect shows a code that the user enters in a Jellyfin app they're
// already signed in to. Jellyfin answers 401 while it's turned off.
export async function startQuickConnect(
  url: string,
): Promise<QuickConnectRequest> {
  const res = await request(url, '/QuickConnect/Initiate', { method: 'POST' })

  if (res.status === 401) {
    throw new LoginError('jellyfinQuickConnectDisabled')
  }

  if (!res.ok) {
    failUnexpected(res)
  }

  const data: QuickConnectResponse | null = await res.json().catch(() => null)

  if (!data?.Code || !data.Secret) {
    console.error('[AUTH] - Jellyfin sent no Quick Connect code!')

    throw new LoginError('jellyfinUnavailable')
  }

  return { code: data.Code, secret: data.Secret }
}

// Jellyfin forgets a request 10 minutes after it starts
export async function getQuickConnectState(
  url: string,
  secret: string,
): Promise<QuickConnectState> {
  const res = await request(
    url,
    `/QuickConnect/Connect?secret=${encodeURIComponent(secret)}`,
    { method: 'GET' },
  )

  if (res.status === 404) {
    return 'expired'
  }

  if (res.status === 401) {
    throw new LoginError('jellyfinQuickConnectDisabled')
  }

  if (!res.ok) {
    failUnexpected(res)
  }

  const data: QuickConnectResponse | null = await res.json().catch(() => null)

  return data?.Authenticated ? 'authorized' : 'waiting'
}

export async function authenticateJellyfinQuickConnect(
  url: string,
  secret: string,
): Promise<JellyfinUser> {
  const res = await request(url, '/Users/AuthenticateWithQuickConnect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Secret: secret }),
  })

  // An unknown or expired secret is a 404, one that isn't authorized yet too
  if (res.status === 400 || res.status === 404) {
    throw new LoginError('jellyfinQuickConnectExpired')
  }

  if (res.status === 401) {
    throw new LoginError('jellyfinQuickConnectDisabled')
  }

  if (!res.ok) {
    failUnexpected(res)
  }

  return readUser(url, res, '')
}
