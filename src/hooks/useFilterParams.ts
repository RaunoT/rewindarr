import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { startTransition, useCallback, useMemo, useOptimistic } from 'react'

export type FilterParams = {
  // The URL's, or the last change to them while its page loads
  searchParams: URLSearchParams
  navigate: (
    update: (params: URLSearchParams) => void,
    options?: { replace?: boolean },
  ) => void
}

// useSearchParams() only changes once a new page has loaded, so a filter
// changed while one loads would start from the old URL and undo the change
// before it. This shows a change at once, and the next one builds on it.
export default function useFilterParams(): FilterParams {
  const router = useRouter()
  const pathname = usePathname()
  const urlSearchParams = useSearchParams()
  const [query, setQuery] = useOptimistic(urlSearchParams.toString())
  const searchParams = useMemo(() => new URLSearchParams(query), [query])
  const navigate = useCallback<FilterParams['navigate']>(
    (update, { replace = false } = {}) => {
      const params = new URLSearchParams(query)

      update(params)

      const nextQuery = params.toString()
      const url = nextQuery ? `${pathname}?${nextQuery}` : pathname

      // Shown until the page for the latest change has loaded
      startTransition(() => {
        setQuery(nextQuery)

        if (replace) {
          router.replace(url)
        } else {
          router.push(url)
        }
      })
    },
    [pathname, query, router, setQuery],
  )

  return { searchParams, navigate }
}
