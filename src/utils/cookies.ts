// For the browser. A cookie is kept for a year, and dropped without a value.
export function setCookie(name: string, value: string | null | undefined) {
  document.cookie = `${name}=${value ?? ''}; path=/; max-age=${value ? 31536000 : 0}; samesite=lax`
}

export function getCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.split('=')[1]
}
