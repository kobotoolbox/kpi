import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { readNextParam, resolveNextRoute } from './nextUrl'

/** Which route `?next=` says to go to, checked for safety - or `null` when it names nothing this app can reach */
export function useNextRoute(): string | null {
  const { search } = useLocation()

  // `window.location` is read inside rather than taken as a dependency: it does not trigger renders, and the only part
  // of it that can change without a page load is the fragment, which is `search` above
  return useMemo(() => resolveNextRoute(readNextParam(window.location.search, search), window.location), [search])
}
