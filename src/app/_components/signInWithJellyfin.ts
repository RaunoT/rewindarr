import { LoginErrorCode, toLoginErrorCode } from '@/lib/loginError'
import { CALLBACK_URL_PARAM, getCallbackPath } from '@/utils/callbackUrl'
import { signIn } from 'next-auth/react'

type Provider = 'jellyfin' | 'jellyfin-quick-connect'

// Resolves with the reason a sign-in failed. A successful one loads the page
// the visitor asked for, or the home page, in full, as the layout also renders
// from the session.
export default async function signInWithJellyfin(
  provider: Provider,
  credentials: Record<string, FormDataEntryValue | null>,
): Promise<LoginErrorCode> {
  const callbackPath = getCallbackPath(
    new URLSearchParams(window.location.search).get(CALLBACK_URL_PARAM),
  )

  try {
    // Without `redirect: false` a failed sign-in reloads the page and the
    // reason is lost.
    const res = await signIn(provider, {
      ...credentials,
      callbackUrl: callbackPath,
      redirect: false,
    })

    if (!res?.ok || res.error) {
      return toLoginErrorCode(res?.error)
    }

    // Not `res.url`, as that's on next-auth's own idea of the address, which
    // a proxy can change
    window.location.replace(callbackPath)

    // The page is on its way out, so the form stays as it is meanwhile
    return new Promise(() => {})
  } catch (error) {
    console.error('[AUTH] - Error during sign-in!', error)

    return 'unknown'
  }
}
