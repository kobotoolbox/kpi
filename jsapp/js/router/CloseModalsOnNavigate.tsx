import { useEffect, useRef } from 'react'

import { modals } from '@mantine/modals'
import { useLocation } from 'react-router-dom'
import pageState from '#/pageState.store'

/**
 * Closes all open modals whenever the page changes (e.g. when the user presses the browser Back button).
 *
 * Modals opened via `modals.open()` render inside `ModalsProvider`, above the routes, so nothing else unmounts them on
 * navigation. Same goes for the legacy `BigModal`. A query-string-only change is not a page change, so it keeps
 * modals open.
 *
 * A modal with unsaved changes should block the navigation itself (see `useBlocker`) - this runs only after the
 * navigation has happened.
 */
export default function CloseModalsOnNavigate() {
  const { pathname } = useLocation()
  const previousPathname = useRef(pathname)

  useEffect(() => {
    if (pathname === previousPathname.current) {
      return
    }
    previousPathname.current = pathname

    modals.closeAll()
    // Not a new `pageState` use: this closes `BigModal` for callers that haven't migrated yet. Remove along with
    // `BigModal`.
    if (pageState.state.modal) {
      pageState.hideModal()
    }
  }, [pathname])

  return null
}
