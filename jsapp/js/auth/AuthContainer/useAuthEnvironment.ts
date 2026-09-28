import type { environmentRetrieveResponse } from '#/api/react-query/configuration'
import { useEnvironmentQuery } from '#/api/useEnvironmentQuery'

/**
 * Everything the authentication screens need from `/environment`: how the server is dressed, not how it
 * authenticates. Anonymous-safe. Accepted credentials come from `useAllauthConfiguration` instead.
 */
export function useAuthEnvironment() {
  return useEnvironmentQuery({
    // `select` is based on the same query as `StandaloneUILanguageSelector` uses, so the frame and the language
    // dropdown share one request rather than making two.
    select: (response: environmentRetrieveResponse) => {
      return {
        authConfiguration: response.data.auth_configuration,
        termsOfServiceUrl: response.data.terms_of_service_url,
        privacyPolicyUrl: response.data.privacy_policy_url,
        /** Same constance setting allauth's `AccountAdapter.is_open_for_signup()` reads. */
        registrationOpen: response.data.registration_open,
        socialApps: response.data.social_apps,
        /** The `SUPPORT_EMAIL` constance setting, so private servers point people at their own team. */
        supportEmail: response.data.support_email,
      }
    },
  })
}
