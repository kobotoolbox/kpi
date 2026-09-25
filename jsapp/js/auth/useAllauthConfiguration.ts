import type { AccountConfiguration } from '#/api/models/accountConfiguration'
import {
  getAllauthBrowserV1ConfigGetQueryKey,
  useAllauthBrowserV1ConfigGet,
} from '#/api/react-query/authentication-allauth-headless'

/**
 * How allauth is set up on this server - which credentials sign-in accepts, whether one-time codes are on.
 * Anonymous-safe, and the same settings allauth validates its own input against.
 */
export function useAllauthConfiguration() {
  // The generated hook hands back the whole response, so `select`'s type has to be spelled out.
  return useAllauthBrowserV1ConfigGet<AccountConfiguration | null>({
    query: {
      queryKey: getAllauthBrowserV1ConfigGetQueryKey(),
      // Server settings, so one request per page load is enough.
      staleTime: Number.POSITIVE_INFINITY,
      select: (response) => (response.status === 200 ? response.data.data.account : null),
    },
  })
}
