import {
  type environmentRetrieveResponse,
  getEnvironmentRetrieveQueryKey,
  useEnvironmentRetrieve,
} from '#/api/react-query/configuration'

/**
 * Everything the authentication page frame needs from `/environment`: the server's branding and the
 * footer links.
 *
 * Anonymous-safe, which is the point - `fetchWithAuth` only adds a CSRF token to non-GET requests,
 * and the endpoint itself is public.
 *
 * `select`s off the same query key `StandaloneUILanguageSelector` uses, so the frame and the language
 * dropdown share one request rather than making two.
 *
 * Later auth screens will read `logo_url`, `supporting_text`, `supporting_image_url`,
 * `allow_login_with_username` and `registration_open` from here too.
 */
export function useAuthConfiguration() {
  return useEnvironmentRetrieve({
    query: {
      queryKey: getEnvironmentRetrieveQueryKey(),
      select: (response: environmentRetrieveResponse) => {
        return {
          authConfiguration: response.data.auth_configuration,
          termsOfServiceUrl: response.data.terms_of_service_url,
          privacyPolicyUrl: response.data.privacy_policy_url,
        }
      },
    },
  })
}
