import { getNextFilterUrl } from '@/utils/dashboardFilters'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { startTransition, useCallback, useMemo, useOptimistic } from 'react'

export type FilterParams = {
  // The URL's, or the last change to them while its page loads
  searchParams: URLSearchParams
  // Only the URL's. A change still loading can be canceled, by Back or
  // another link, so it's what's saved.
  committedSearchParams: URLSearchParams
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
  const committedQuery = urlSearchParams.toString()
  const [query, setQuery] = useOptimistic(committedQuery)
  const searchParams = useMemo(() => new URLSearchParams(query), [query])
  const committedSearchParams = useMemo(
    () => new URLSearchParams(committedQuery),
    [committedQuery],
  )
  const navigate = useCallback<FilterParams['navigate']>(
    (update, { replace = false } = {}) => {
      const { query: nextQuery, url } = getNextFilterUrl(
        pathname,
        query,
        update,
      )

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

  return { searchParams, committedSearchParams, navigate }
}
