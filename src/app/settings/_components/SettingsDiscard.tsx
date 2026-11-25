'use client'

import { useRouter } from 'next/navigation'
import {
  createContext,
  Fragment,
  ReactNode,
  use,
  useCallback,
  useRef,
  useState,
  useTransition,
} from 'react'

type Discard = {
  discard: () => void
  isDiscarding: boolean
  // True once, for the form that mounts after a discard
  takeIsDiscarded: () => boolean
}

const DiscardContext = createContext<Discard | null>(null)

export function useDiscard() {
  return use(DiscardContext)
}

type Props = {
  children: ReactNode
}

// Puts a settings page back to its saved values. The forms keep some of
// their values in their own state, so the page starts over rather than
// resetting its fields, from settings read again in case a save changed them.
export default function SettingsDiscard({ children }: Props) {
  const router = useRouter()
  const [version, setVersion] = useState(0)
  const [isWaiting, setIsWaiting] = useState(false)
  const [isRefreshing, startTransition] = useTransition()
  const isDiscardedRef = useRef(false)

  // The page starts over once the refresh is in, so it doesn't wait for the
  // page's data with its loading skeleton
  if (isWaiting && !isRefreshing) {
    setIsWaiting(false)
    setVersion(version + 1)
  }

  function discard() {
    isDiscardedRef.current = true
    setIsWaiting(true)
    startTransition(() => router.refresh())
  }

  // Stable, so a form only asks for it when it mounts
  const takeIsDiscarded = useCallback(() => {
    const isDiscarded = isDiscardedRef.current

    isDiscardedRef.current = false

    return isDiscarded
  }, [])

  return (
    <DiscardContext
      value={{
        discard,
        isDiscarding: isWaiting || isRefreshing,
        takeIsDiscarded,
      }}
    >
      <Fragment key={version}>{children}</Fragment>
    </DiscardContext>
  )
}
