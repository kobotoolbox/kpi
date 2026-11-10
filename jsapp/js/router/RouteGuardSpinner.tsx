import { createContext, useContext, useLayoutEffect } from 'react'
import LoadingSpinner from '#/components/common/loadingSpinner'

/** Tells `App` whether a route guard is still deciding */
export const RouteGuardPendingContext = createContext<(isPending: boolean) => void>(() => {})

/**
 * The spinner of a route guard that has not let the user in yet. For an anonymous user `App` hides the main layout, so
 * it doesn't flash before the login screen.
 */
export default function RouteGuardSpinner() {
  const setIsGuardPending = useContext(RouteGuardPendingContext)

  // Layout effect, so the header is gone before the first paint
  useLayoutEffect(() => {
    setIsGuardPending(true)
    return () => setIsGuardPending(false)
  }, [setIsGuardPending])

  return <LoadingSpinner />
}
