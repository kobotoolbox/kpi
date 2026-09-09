import {
  type environmentRetrieveResponse,
  getEnvironmentRetrieveQueryKey,
  useEnvironmentRetrieve,
} from '#/api/react-query/configuration'

/**
 * Everything the authentication page frame needs from `/environment`. Anonymous-safe.
 *
 * Later auth screens will read `logo_url`, `supporting_text`, `supporting_image_url`,
 * `allow_login_with_username` and `registration_open` from here too.
 */
export function useAuthConfiguration() {
  return useEnvironmentRetrieve({
    query: {
      // `select` is based on the same query as `StandaloneUILanguageSelector` uses, so the frame and the language
      // dropdown share one request rather than making two.
      queryKey: getEnvironmentRetrieveQueryKey(),
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
    },
  })
}
