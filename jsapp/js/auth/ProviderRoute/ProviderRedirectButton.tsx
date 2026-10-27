import { useLocation } from 'react-router-dom'
import { Process } from '#/api/models/process'
import { getAllauthBrowserV1AuthProviderRedirectPostUrl } from '#/api/react-query/authentication-allauth-headless'
import ButtonNew, { type ButtonProps } from '#/components/common/ButtonNew'
import { ROOT_URL } from '#/constants'
import { getCsrfToken } from '#/utils'
import { getProviderCallbackUrl } from './providerRedirect'

export interface ProviderRedirectButtonProps extends ButtonProps {
  /** `provider_id` of the `SocialApp` to hand the browser over to. */
  providerId: string
  /**
   * What allauth does with the provider account it gets back - `login` (signup too) creates the account, `connect`
   * attaches it to the account already signed in.
   */
  process?: Process
  /** Where allauth returns the browser. Defaults to the screen that finishes a sign-on login. */
  callbackUrl?: string
  children: React.ReactNode
}

/** Starts a single sign-on handshake. */
export default function ProviderRedirectButton({
  providerId,
  process = Process.login,
  callbackUrl,
  children,
  ...buttonProps
}: ProviderRedirectButtonProps) {
  const { search } = useLocation()

  return (
    <form method='post' action={`${ROOT_URL}${getAllauthBrowserV1AuthProviderRedirectPostUrl()}`}>
      <input type='hidden' name='provider' value={providerId} />
      <input
        type='hidden'
        name='callback_url'
        value={callbackUrl ?? getProviderCallbackUrl(window.location.search, search)}
      />
      <input type='hidden' name='process' value={process} />
      {/* In the body, not the `X-CSRFToken` header a native form submit cannot set. Django reads either. */}
      <input type='hidden' name='csrfmiddlewaretoken' value={getCsrfToken() ?? ''} />

      <ButtonNew type='submit' {...buttonProps}>
        {children}
      </ButtonNew>
    </form>
  )
}
