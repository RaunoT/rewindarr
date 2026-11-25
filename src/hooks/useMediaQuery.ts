import { useCallback, useSyncExternalStore } from 'react'

function getServerSnapshot() {
  return false
}

// Whether the query matches, false on the server. For what's only rendered
// after an interaction, as the first render in the browser can differ.
export default function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mediaQuery = window.matchMedia(query)

      mediaQuery.addEventListener('change', onChange)

      return () => mediaQuery.removeEventListener('change', onChange)
    },
    [query],
  )
  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query],
  )

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
