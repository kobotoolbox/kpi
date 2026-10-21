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
        /** The `USER_METADATA_FIELDS` constance setting: which profile fields this server asks for, and how. */
        userMetadataFields: response.data.user_metadata_fields,
        /** The `SUPPORT_EMAIL` constance setting, so private servers point people at their own team. */
        supportEmail: response.data.support_email,
        /**
         * The `MFA_CODE_LENGTH` setting, for copy that has to name how long a token is. It comes from here
         * rather than from allauth's own configuration, which never mentions the length.
         */
        mfaCodeLength: response.data.mfa_code_length,
        /**
         * The `MFA_LOCALIZED_HELP_TEXT` constance setting in the user's language, as HTML rendered from markdown,
         * with `SUPPORT_EMAIL` already filled in.
         */
        mfaHelpText: response.data.mfa_localized_help_text,
      }
    },
  })
}
