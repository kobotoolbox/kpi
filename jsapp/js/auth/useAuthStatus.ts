import {
  getAllauthBrowserV1AuthSessionGetQueryKey,
  useAllauthBrowserV1AuthSessionGet,
} from '#/api/react-query/authentication-allauth-headless'
import { FeatureFlag, useFeatureFlag } from '#/featureFlags'
import { type AuthStatus, getAuthStatus } from './authStatus'

// Who is signed in, according to allauth - the live answer (something `profileStore.isLoggedIn` fails to be).
// Anonymous-safe. All three of the endpoint's answers are normal and `fetchAllauth` hands the two non-2xx ones back as
// data, so a rejection here means a 5xx or a dead connection - never "nobody is signed in".

/** The key everything shares, so one request covers every guard on a page */
const getAuthStatusQueryKey = getAllauthBrowserV1AuthSessionGetQueryKey

const AUTH_STATUS_STALE_TIME = 60 * 1000

export function useAuthStatus() {
  // TODO: DEV-1868 delete along with `FeatureFlag.authRedesignEnabled`. With the flag off nothing reads this, so there
  // is no reason to pay for a request per page load.
  const isAuthRedesignEnabled = useFeatureFlag(FeatureFlag.authRedesignEnabled)

  return useAllauthBrowserV1AuthSessionGet<AuthStatus>({
    query: {
      queryKey: getAuthStatusQueryKey(),
      enabled: isAuthRedesignEnabled,
      select: getAuthStatus,
      staleTime: AUTH_STATUS_STALE_TIME,
      // `'always'`, not `true`: `true` skips a query still inside `staleTime`, hiding a sign-out from another tab
      refetchOnWindowFocus: 'always',
      // Overrides `onErrorDefaultHandler`, as each guard already has an answer for a session it could not check
      throwOnError: false,
    },
  })
}
