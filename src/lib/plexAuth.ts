import { CALLBACK_URL_PARAM } from '../utils/callbackUrl'
import { PLEX_API_ENDPOINT, PLEX_PRODUCT_NAME } from '../utils/constants'

function generateClientId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // Browsers omit crypto.randomUUID on plain HTTP origins
  const bytes = crypto.getRandomValues(new Uint8Array(16))

  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// Runs in the browser: the Plex PIN flow happens client-side and only the
// resulting token is sent to the server for sign-in.
function getClientIdentifier(): string {
  const clientId = localStorage.getItem('plexClientId') || generateClientId()

  localStorage.setItem('plexClientId', clientId)

  return clientId
}

type PlexPinResponse = {
  id: number
  code: string
}

async function fetchPlexPins(): Promise<PlexPinResponse> {
  const clientIdentifier = getClientIdentifier()

  try {
    const res = await fetch(`${PLEX_API_ENDPOINT}/pins?strong=true`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-Plex-Product': PLEX_PRODUCT_NAME,
        'X-Plex-Client-Identifier': clientIdentifier,
      },
    })

    if (!res.ok) {
      throw new Error(`Plex PIN generation failed with status ${res.status}`)
    }

    return await res.json()
  } catch (error) {
    console.error('[AUTH] - Error generating Plex PIN!', error)
    throw error
  }
}

// Plex returns to the forward URL, which carries the page to open after the
// login
export async function createPlexAuthUrl(siteUrl: string, callbackPath = '/') {
  const { id, code } = await fetchPlexPins()
  const forwardParams = new URLSearchParams({ plexPinId: String(id) })

  if (callbackPath !== '/') {
    forwardParams.set(CALLBACK_URL_PARAM, callbackPath)
  }

  const forwardUrl = `${siteUrl}?${forwardParams.toString().replace(/\+/g, '%20')}`
  const clientIdentifier = getClientIdentifier()

  if (!forwardUrl) {
    console.error('[AUTH] - Base url is not configured!')
  }

  const authAppParams = new URLSearchParams({
    clientID: clientIdentifier,
    code,
    forwardUrl,
    'context[device][product]': PLEX_PRODUCT_NAME,
  })
  const authAppUrl = `https://app.plex.tv/auth#?${authAppParams.toString().replace(/\+/g, '%20')}`

  return authAppUrl
}

export async function getPlexAuthToken(pinId: string): Promise<string | null> {
  const clientIdentifier = getClientIdentifier()

  try {
    const res = await fetch(
      `${PLEX_API_ENDPOINT}/pins/${encodeURIComponent(pinId)}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Plex-Client-Identifier': clientIdentifier,
        },
      },
    )

    if (!res.ok) {
      console.error(
        '[AUTH] - Getting Plex auth token failed!',
        res.status,
        res.statusText,
      )

      return null
    }

    const data = await res.json()

    return data?.authToken || null
  } catch (error) {
    console.error('[AUTH] - Error getting Plex auth token!', error)

    return null
  }
}
