import { Process } from '#/api/models/process'
import { getAllauthBrowserV1AuthProviderRedirectPostUrl } from '#/api/react-query/authentication-allauth-headless'
import ButtonNew, { type ButtonProps } from '#/components/common/ButtonNew'
import { getCsrfToken } from '#/utils'
import { getProviderCallbackUrl } from './providerRedirect'

export interface ProviderRedirectButtonProps extends ButtonProps {
  /** `provider_id` of the `SocialApp` to hand the browser over to. */
  providerId: string
  children: React.ReactNode
}

/**
 * Starts a single sign-on handshake: a real form POST to allauth's provider redirect endpoint.
 *
 * Deliberately a native form rather than the generated mutation hook. allauth answers this endpoint with a
 * 302 to the provider, so `fetch` would follow it cross-origin and return an opaque response with the
 * browser still sitting here.
 */
export default function ProviderRedirectButton({ providerId, children, ...buttonProps }: ProviderRedirectButtonProps) {
  return (
    <form method='post' action={getAllauthBrowserV1AuthProviderRedirectPostUrl()}>
      <input type='hidden' name='provider' value={providerId} />
      <input type='hidden' name='callback_url' value={getProviderCallbackUrl()} />
      {/* `login` covers signing up too: allauth creates the account when the provider account is new. */}
      <input type='hidden' name='process' value={Process.login} />
      {/* In the body, not the `X-CSRFToken` header a native form submit cannot set. Django reads either. */}
      <input type='hidden' name='csrfmiddlewaretoken' value={getCsrfToken() ?? ''} />

      <ButtonNew type='submit' {...buttonProps}>
        {children}
      </ButtonNew>
    </form>
  )
}
