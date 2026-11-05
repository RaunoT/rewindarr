import { randomBytes } from 'crypto'
import fs from 'fs'
import path from 'path'

export const SECRET_PATH = path.join(process.cwd(), 'config/auth-secret')

function createSecret(): string {
  return randomBytes(32).toString('base64')
}

function getErrorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error
    ? String(error.code)
    : undefined
}

// The secret signs every session, so only the app's user may read it. A file
// that was already there keeps its mode, so it's tightened every start.
function makeSecretPrivate() {
  try {
    if ((fs.statSync(SECRET_PATH).mode & 0o077) !== 0) {
      fs.chmodSync(SECRET_PATH, 0o600)
    }
  } catch (error) {
    console.warn(
      `[AUTH] - Unable to make ${SECRET_PATH} readable by Rewindarr only.`,
      error,
    )
  }
}

function readOrCreateSecret(): string {
  try {
    const saved = fs.readFileSync(SECRET_PATH, 'utf-8').trim()

    if (saved) {
      makeSecretPrivate()

      return saved
    }
  } catch (error) {
    if (getErrorCode(error) !== 'ENOENT') {
      throw error
    }
  }

  const secret = createSecret()

  fs.mkdirSync(path.dirname(SECRET_PATH), { recursive: true })
  fs.writeFileSync(SECRET_PATH, secret, { mode: 0o600 })
  makeSecretPrivate()
  console.log(`[AUTH] - Saved a new secret to ${SECRET_PATH}.`)

  return secret
}

// next-auth reads its secret and address from the environment on every
// request, in the route handler, the proxy and getServerSession alike, so
// filling in the ones left out once at start covers all of them.
export function prepareAuthEnv() {
  const env = process.env

  if (!env.NEXTAUTH_SECRET) {
    try {
      env.NEXTAUTH_SECRET = env.AUTH_SECRET || readOrCreateSecret()
    } catch (error) {
      console.error(
        `[AUTH] - Unable to read or save ${SECRET_PATH}, everyone will have to sign in again after a restart!`,
        error,
      )
      env.NEXTAUTH_SECRET = createSecret()
    }
  }

  // Both used to be required, always with the same address
  if (!env.NEXTAUTH_URL && env.NEXT_PUBLIC_SITE_URL) {
    env.NEXTAUTH_URL = env.NEXT_PUBLIC_SITE_URL
  }

  // Without an address next-auth assumes http://localhost:3000, so it takes
  // the one the browser asked for instead. An empty one wouldn't parse.
  if (!env.NEXTAUTH_URL) {
    delete env.NEXTAUTH_URL
    env.AUTH_TRUST_HOST ??= 'true'
  }
}
