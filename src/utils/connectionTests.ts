import { MediaServerType } from '@/types/settings'
import { TracearrServer, TracearrServersResponse } from '@/types/tracearr'
import {
  ConnectionError,
  getFetchError,
  getStatusError,
  getTautulliResultError,
} from './connectionErrors'
import { toServerOptions } from './fetchTracearr'
import { isGatewayError, markHostUp } from './hostBackoff'
import { getIdentityPath, readServerId } from './mediaServer'
import { getMediaServerName } from './mediaServerName'

const TEST_TIMEOUT_MS = 15_000

type TestResult =
  | { response: Response; error?: never }
  | { response?: never; error: ConnectionError }

async function testRequest(
  service: string,
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<TestResult> {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
    })

    // The service answers again, so its requests needn't wait for a check
    if (!isGatewayError(response.status)) {
      markHostUp(baseUrl)
    }

    return { response }
  } catch (error) {
    console.error(`[CONFIG] - Error testing ${service} connection!`, error)

    return { error: getFetchError(error) }
  }
}

function getResponseError(
  service: string,
  response: Response,
): ConnectionError | null {
  if (response.ok) {
    return null
  }

  console.error(
    `[CONFIG] - Error testing ${service} connection!`,
    response.status,
    response.statusText,
  )

  return getStatusError(response.status)
}

function getMissingError(url: string, key: string): ConnectionError | null {
  if (!url) {
    return { key: 'enterUrl' }
  }

  return key ? null : { key: 'enterApiKey' }
}

export async function testTautulli(
  url: string,
  apiKey: string,
): Promise<ConnectionError | null> {
  const missing = getMissingError(url, apiKey)

  if (missing) {
    return missing
  }

  const { response, error } = await testRequest(
    'Tautulli',
    url,
    `/api/v2?apikey=${encodeURIComponent(apiKey)}&cmd=status`,
  )

  if (error) {
    return error
  }

  const responseError = getResponseError('Tautulli', response)

  if (responseError) {
    return responseError
  }

  const resultError = getTautulliResultError(
    await response.json().catch(() => null),
    response.status,
  )

  if (resultError) {
    console.error(
      '[CONFIG] - Error testing Tautulli connection!',
      resultError.key,
    )
  }

  return resultError
}

// The servers Tracearr tracks, of which at least one is Plex or Jellyfin
export async function testTracearr(
  url: string,
  apiKey: string,
): Promise<
  | { servers: TracearrServer[]; error?: never }
  | { servers?: never; error: ConnectionError }
> {
  const missing = getMissingError(url, apiKey)

  if (missing) {
    return { error: missing }
  }

  const { response, error } = await testRequest(
    'Tracearr',
    url,
    '/api/v2/public/servers',
    { headers: { Authorization: `Bearer ${apiKey}` } },
  )

  if (error) {
    return { error }
  }

  const responseError = getResponseError('Tracearr', response)

  if (responseError) {
    return { error: responseError }
  }

  const body: TracearrServersResponse | null = await response
    .json()
    .catch(() => null)

  if (!Array.isArray(body?.data)) {
    return { error: getStatusError(response.status) }
  }

  if (!toServerOptions(body.data).length) {
    return { error: { key: 'noMediaServer' } }
  }

  return { servers: body.data }
}

export async function testSeerr(
  url: string,
  apiKey: string,
): Promise<ConnectionError | null> {
  const missing = getMissingError(url, apiKey)

  if (missing) {
    return missing
  }

  // Unlike Authorization, fetch keeps a custom header on a redirect to
  // another host, so a redirect isn't followed
  const { response, error } = await testRequest('Seerr', url, '/api/v1/user', {
    headers: { 'X-API-KEY': apiKey },
    redirect: 'manual',
  })

  if (error) {
    return error
  }

  const responseError = getResponseError('Seerr', response)

  if (responseError) {
    return responseError
  }

  // A proxy's sign-in page can answer too, but not with Seerr's users
  const body = await response.json().catch(() => null)

  return Array.isArray((body as { results?: unknown } | null)?.results)
    ? null
    : { key: 'notMediaServer', values: { server: 'Seerr' } }
}

// Both answer without a token, so this only checks that the URL is the server
export async function testMediaServerUrl(
  type: MediaServerType,
  url: string,
): Promise<ConnectionError | null> {
  const serverName = getMediaServerName(type)
  const { response, error } = await testRequest(
    serverName,
    url,
    getIdentityPath(type),
    { headers: { Accept: 'application/json' } },
  )

  if (error) {
    return error
  }

  const responseError = getResponseError(serverName, response)

  if (responseError) {
    return responseError
  }

  // Another service at the URL can answer too, but not with an ID
  return readServerId(type, await response.json().catch(() => null))
    ? null
    : { key: 'notMediaServer', values: { server: serverName } }
}

export async function testPlexToken(
  url: string,
  token: string,
): Promise<ConnectionError | null> {
  if (!url) {
    return { key: 'tokenNeedsUrl' }
  }

  // A redirect isn't followed, as the token would go with it
  const { response, error } = await testRequest(
    'Plex',
    url,
    '/library/sections',
    {
      headers: { 'X-Plex-Token': token },
      redirect: 'manual',
    },
  )

  if (error) {
    return error
  }

  if (response.status === 401 || response.status === 403) {
    return { key: 'invalidToken' }
  }

  return getResponseError('Plex', response)
}
