import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FeatureFlag, useFeatureFlag } from '#/featureFlags'
import { redirectToLogin } from '#/router/routerUtils'
import { getLoginRouteWithNext } from './nextUrl'

/**
 * Sends somebody to the login screen with the current route as `next`, so they land back on it after signing in.
 * Both ways of getting there live here, as only one of them outlives the flag.
 */
export function useGoToLogin() {
  const isAuthRedesignEnabled = useFeatureFlag(FeatureFlag.authRedesignEnabled)
  const navigate = useNavigate()
  const { pathname, search } = useLocation()

  return useCallback(() => {
    if (isAuthRedesignEnabled) {
      // `replace`, so Back does not return to the route that just turned them away
      navigate(getLoginRouteWithNext(pathname + search), { replace: true })
    } else {
      // TODO: DEV-1868 delete with `FeatureFlag.authRedesignEnabled` - without it there is no SPA login screen.
      redirectToLogin()
    }
  }, [isAuthRedesignEnabled, navigate, pathname, search])
}
