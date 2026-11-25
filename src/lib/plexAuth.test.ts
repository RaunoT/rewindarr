import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlexAuthUrl, getPlexAuthToken } from './plexAuth'

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const storage = new Map<string, string>()
const fetchMock = vi.fn()

beforeEach(() => {
  storage.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
  })
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  fetchMock.mockReset()
})

describe('createPlexAuthUrl', () => {
  it('generates a UUIDv4 client ID and formats nested device params cleanly', async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 99, code: 'ABCD' }))

    const url = await createPlexAuthUrl('https://rewind.example', '/history')
    const clientId = storage.get('plexClientId')

    expect(clientId).toMatch(UUID_V4)
    expect(url).toBe(
      `https://app.plex.tv/auth#?clientID=${clientId}&code=ABCD&forwardUrl=https%3A%2F%2Frewind.example%3FplexPinId%3D99%26callbackUrl%3D%252Fhistory&context%5Bdevice%5D%5Bproduct%5D=Rewindarr`,
    )
  })

  it('omits the callback query parameter for the home route', async () => {
    storage.set('plexClientId', 'existing-id')
    fetchMock.mockResolvedValue(Response.json({ id: 42, code: 'WXYZ' }))

    const url = await createPlexAuthUrl('https://rewind.example')

    expect(url).toContain(
      'forwardUrl=https%3A%2F%2Frewind.example%3FplexPinId%3D42&',
    )
  })

  it('falls back to crypto.getRandomValues when randomUUID is unavailable on plain HTTP', async () => {
    vi.stubGlobal('crypto', {
      getRandomValues: crypto.getRandomValues.bind(crypto),
    })
    fetchMock.mockResolvedValue(Response.json({ id: 7, code: 'HTTP' }))

    const url = await createPlexAuthUrl('http://192.168.1.10:3000')
    const clientId = storage.get('plexClientId')

    expect(clientId).toMatch(UUID_V4)
    expect(url).toContain(`clientID=${clientId}`)
  })
})

describe('getPlexAuthToken', () => {
  it('returns the auth token using the persisted client identifier', async () => {
    storage.set('plexClientId', 'existing-id')
    fetchMock.mockResolvedValue(Response.json({ authToken: 'secret-token' }))

    await expect(getPlexAuthToken('42')).resolves.toBe('secret-token')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://plex.tv/api/v2/pins/42',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Plex-Client-Identifier': 'existing-id',
        }),
      }),
    )
  })
})
