// The page a logged-out visitor asked for, which the proxy passes to the home
// page so the login can return to it
export const CALLBACK_URL_PARAM = 'callbackUrl'

const BASE = 'http://callback.invalid'

// Only a path on this site, so a link can't send someone elsewhere once they
// have logged in
export function getCallbackPath(value: string | null | undefined): string {
  if (!value?.startsWith('/')) {
    return '/'
  }

  const url = new URL(value, BASE)

  return url.origin === BASE ? url.pathname + url.search + url.hash : '/'
}
