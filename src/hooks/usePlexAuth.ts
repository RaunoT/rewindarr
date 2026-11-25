import { LoginErrorCode, toLoginErrorCode } from '@/lib/loginError'
import { createPlexAuthUrl, getPlexAuthToken } from '@/lib/plexAuth'
import { CALLBACK_URL_PARAM, getCallbackPath } from '@/utils/callbackUrl'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export default function usePlexAuth(siteUrl?: string) {
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<LoginErrorCode | null>(null)
  const searchParams = useSearchParams()
  const callbackPath = getCallbackPath(searchParams.get(CALLBACK_URL_PARAM))
  const authAttemptRef = useRef(0)

  useEffect(() => {
    return () => {
      // Cancel any in-flight sign-in if the hook unmounts (or Strict Mode
      // re-runs effects), without cancelling when replaceState removes plexPinId.
      authAttemptRef.current += 1
    }
  }, [])

  // Navigating back from Plex via bfcache can restore the loading state
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        setIsLoading(false)
      }
    }

    window.addEventListener('pageshow', handlePageShow)

    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  useEffect(() => {
    const plexPinId = searchParams.get('plexPinId')

    if (!plexPinId) {
      return
    }

    const attemptId = ++authAttemptRef.current

    async function authUser(pinId: string) {
      setIsLoading(true)
      setError(null)

      try {
        const plexAuthToken = await getPlexAuthToken(pinId)

        if (authAttemptRef.current !== attemptId) {
          return
        }

        // A PIN is only good once, so a reload shouldn't try it again. The page
        // to return to stays, for another try.
        const url = new URL(window.location.href)

        url.searchParams.delete('plexPinId')
        window.history.replaceState(null, '', url.pathname + url.search)

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

        if (authAttemptRef.current !== attemptId) {
          return
        }

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
        if (authAttemptRef.current !== attemptId) {
          return
        }

        console.error('[AUTH] - Error during sign-in!', error)
        setError('unknown')
        setIsLoading(false)
      }
    }

    authUser(plexPinId)
  }, [searchParams, callbackPath])

  const handleLogin = async () => {
    if (isLoading) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const plexUrl = await createPlexAuthUrl(
        siteUrl ?? window.location.origin,
        callbackPath,
      )

      window.location.assign(plexUrl)
    } catch {
      setError('plexUnavailable')
      setIsLoading(false)
    }
  }

  return { isLoading, error, handleLogin }
}
