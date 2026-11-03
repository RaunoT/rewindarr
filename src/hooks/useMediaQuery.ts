import { useSyncExternalStore } from 'react'

// Whether the query matches, false on the server. For what's only rendered
// after an interaction, as the first render in the browser can differ.
export default function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mediaQuery = window.matchMedia(query)

      mediaQuery.addEventListener('change', onChange)

      return () => mediaQuery.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
