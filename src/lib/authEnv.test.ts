import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const AUTH_ENV = [
  'NEXTAUTH_SECRET',
  'AUTH_SECRET',
  'NEXTAUTH_URL',
  'NEXT_PUBLIC_SITE_URL',
  'AUTH_TRUST_HOST',
]

let directory: string
let secretPath: string

async function loadModule(): Promise<typeof import('./authEnv')> {
  vi.resetModules()

  // The secret's path is built from the working directory when the module loads
  const cwd = vi.spyOn(process, 'cwd').mockReturnValue(directory)

  try {
    return await import('./authEnv')
  } finally {
    cwd.mockRestore()
  }
}

async function prepare() {
  const { prepareAuthEnv } = await loadModule()

  prepareAuthEnv()
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rewindarr-auth-'))
  secretPath = path.join(directory, 'config/auth-secret')

  for (const name of AUTH_ENV) {
    vi.stubEnv(name, undefined)
  }

  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  fs.rmSync(directory, { recursive: true, force: true })
})

describe('prepareAuthEnv', () => {
  it('keeps a secret that was set', async () => {
    vi.stubEnv('NEXTAUTH_SECRET', 'set-secret')

    await prepare()

    expect(process.env.NEXTAUTH_SECRET).toBe('set-secret')
    expect(fs.existsSync(secretPath)).toBe(false)
  })

  it("uses next-auth's other name for the secret", async () => {
    vi.stubEnv('AUTH_SECRET', 'other-secret')

    await prepare()

    expect(process.env.NEXTAUTH_SECRET).toBe('other-secret')
    expect(fs.existsSync(secretPath)).toBe(false)
  })

  it('saves a new secret on first start, also for an empty variable', async () => {
    vi.stubEnv('NEXTAUTH_SECRET', '')

    await prepare()

    const secret = process.env.NEXTAUTH_SECRET

    expect(secret).toHaveLength(44)
    expect(fs.readFileSync(secretPath, 'utf-8')).toBe(secret)
    expect(fs.statSync(secretPath).mode & 0o777).toBe(0o600)
  })

  it('reuses the saved secret after a restart', async () => {
    await prepare()

    const first = process.env.NEXTAUTH_SECRET

    vi.stubEnv('NEXTAUTH_SECRET', undefined)
    await prepare()

    expect(process.env.NEXTAUTH_SECRET).toBe(first)
  })

  it('replaces an empty secret file, readable by its owner only', async () => {
    fs.mkdirSync(path.dirname(secretPath))
    fs.writeFileSync(secretPath, '\n', { mode: 0o644 })

    await prepare()

    expect(process.env.NEXTAUTH_SECRET).toHaveLength(44)
    expect(fs.readFileSync(secretPath, 'utf-8')).toBe(
      process.env.NEXTAUTH_SECRET,
    )
    expect(fs.statSync(secretPath).mode & 0o777).toBe(0o600)
  })

  it('makes a saved secret readable by its owner only', async () => {
    fs.mkdirSync(path.dirname(secretPath))
    fs.writeFileSync(secretPath, 'saved-secret\n', { mode: 0o644 })

    await prepare()

    expect(process.env.NEXTAUTH_SECRET).toBe('saved-secret')
    expect(fs.statSync(secretPath).mode & 0o777).toBe(0o600)
  })

  it('still uses a saved secret it cannot make private', async () => {
    fs.mkdirSync(path.dirname(secretPath))
    fs.writeFileSync(secretPath, 'saved-secret', { mode: 0o644 })
    vi.spyOn(fs, 'chmodSync').mockImplementation(() => {
      throw Object.assign(new Error('EPERM: not permitted'), { code: 'EPERM' })
    })

    await prepare()

    expect(process.env.NEXTAUTH_SECRET).toBe('saved-secret')
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('still has a secret when it cannot be saved', async () => {
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw Object.assign(new Error('EROFS: read-only'), { code: 'EROFS' })
    })

    await prepare()

    expect(process.env.NEXTAUTH_SECRET).toHaveLength(44)
    expect(console.error).toHaveBeenCalledTimes(1)
  })

  it('keeps an address that was set', async () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://auth.example.com')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://site.example.com')

    await prepare()

    expect(process.env.NEXTAUTH_URL).toBe('https://auth.example.com')
    expect(process.env.AUTH_TRUST_HOST).toBeUndefined()
  })

  it('takes the address from NEXT_PUBLIC_SITE_URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://site.example.com')

    await prepare()

    expect(process.env.NEXTAUTH_URL).toBe('https://site.example.com')
    expect(process.env.AUTH_TRUST_HOST).toBeUndefined()
  })

  it("takes the request's address without one", async () => {
    vi.stubEnv('NEXTAUTH_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')

    await prepare()

    expect('NEXTAUTH_URL' in process.env).toBe(false)
    expect(process.env.AUTH_TRUST_HOST).toBe('true')
  })
})
