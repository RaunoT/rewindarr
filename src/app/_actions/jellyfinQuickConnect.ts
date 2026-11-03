'use server'

import { getJellyfinUrl } from '@/lib/auth'
import {
  getQuickConnectState,
  QuickConnectRequest,
  QuickConnectState,
  startQuickConnect,
} from '@/lib/jellyfinAuth'
import { LoginError, LoginErrorCode } from '@/lib/loginError'

type Result<T> = { ok: true; value: T } | { ok: false; error: LoginErrorCode }

// Jellyfin's secrets are hex
const SECRET_PATTERN = /^[0-9a-f]{1,128}$/i

// Actions can't throw a reason to the browser, so it's returned instead
async function run<T>(action: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await action() }
  } catch (error) {
    if (error instanceof LoginError) {
      return { ok: false, error: error.message as LoginErrorCode }
    }

    console.error('[AUTH] - Error with Jellyfin Quick Connect!', error)

    return { ok: false, error: 'unknown' }
  }
}

// Asked before signing in, so open to anyone, like Jellyfin's own endpoints
export async function startJellyfinQuickConnect(): Promise<
  Result<QuickConnectRequest>
> {
  return run(() => startQuickConnect(getJellyfinUrl()))
}

export async function checkJellyfinQuickConnect(
  secret: string,
): Promise<Result<QuickConnectState>> {
  if (typeof secret !== 'string' || !SECRET_PATTERN.test(secret)) {
    return { ok: true, value: 'expired' }
  }

  return run(() => getQuickConnectState(getJellyfinUrl(), secret))
}
