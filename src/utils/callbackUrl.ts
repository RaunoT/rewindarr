// The page a logged-out visitor asked for, which the proxy passes to the home
// page so the login can return to it
export const CALLBACK_URL_PARAM = 'callbackUrl'

const BASE = 'http://callback.invalid'

// Not URL.canParse, which older Safari doesn't have
function parse(path: string): URL | null {
  try {
    return new URL(path, BASE)
  } catch {
    return null
  }
}

// Only a path on this site, so a link can't send someone elsewhere once they
// have logged in. The cleaned-up path is checked too, as `/a/..//host` becomes
// `//host`.
export function getCallbackPath(value: string | null | undefined): string {
  const url = value?.startsWith('/') ? parse(value) : null

  if (url?.origin !== BASE) {
    return '/'
  }

  const path = url.pathname + url.search + url.hash

  return parse(path)?.origin === BASE ? path : '/'
}
