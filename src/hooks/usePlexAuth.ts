import { LoginErrorCode, toLoginErrorCode } from '@/lib/loginError'
import { createPlexAuthUrl, getPlexAuthToken } from '@/lib/plexAuth'
import { CALLBACK_URL_PARAM, getCallbackPath } from '@/utils/callbackUrl'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function usePlexAuth(siteUrl?: string) {
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<LoginErrorCode | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackPath = getCallbackPath(searchParams.get(CALLBACK_URL_PARAM))

  useEffect(() => {
    const plexPinId = searchParams.get('plexPinId')

    async function authUser(plexPinId: string) {
      setIsLoading(true)
      setError(null)

      // A PIN is only good once, so a reload shouldn't try it again. The page
      // to return to stays, for another try.
      const url = new URL(window.location.href)

      url.searchParams.delete('plexPinId')
      window.history.replaceState(null, '', url.pathname + url.search)

      try {
        const plexAuthToken = await getPlexAuthToken(plexPinId)

        if (!plexAuthToken) {
          setError('plexNotConfirmed')
          setIsLoading(false)

          return
        }

        // Without `redirect: false` a failed sign-in reloads the page and
        // the reason is lost.
        const res = await signIn('plex', {
          authToken: plexAuthToken,
          callbackUrl: callbackPath,
          redirect: false,
        })

        if (!res?.ok || res.error) {
          console.error('[AUTH] - Failed to sign in!', res?.error)
          setError(toLoginErrorCode(res?.error))
          setIsLoading(false)

          return
        }

        // A full load, as the layout also renders from the session. Replacing
        // keeps the used PIN out of the history. Not `res.url`, as that's on
        // next-auth's own idea of the address, which a proxy can change.
        window.location.replace(callbackPath)
      } catch (error) {
        console.error('[AUTH] - Error during sign-in!', error)
        setError('unknown')
        setIsLoading(false)
      }
    }

    if (plexPinId) {
      authUser(plexPinId)
    }
  }, [searchParams, callbackPath])

  const handleLogin = async () => {
    setError(null)

    try {
      const plexUrl = await createPlexAuthUrl(
        siteUrl ?? window.location.origin,
        callbackPath,
      )

      router.push(plexUrl)
    } catch {
      setError('plexUnavailable')
    }
  }

  return { isLoading, error, handleLogin }
}
