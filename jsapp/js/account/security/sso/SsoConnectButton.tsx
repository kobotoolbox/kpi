import { ACCOUNT_ROUTES } from '#/account/routes.constants'
import { Process } from '#/api/models/process'
import ProviderRedirectButton, { type ProviderRedirectButtonProps } from '#/auth/ProviderRoute/ProviderRedirectButton'
import { getAbsoluteHashUrl } from '#/auth/ProviderRoute/providerRedirect'

export type SsoConnectButtonProps = Omit<ProviderRedirectButtonProps, 'process' | 'callbackUrl'>

/** Attaches a single sign-on provider to the current account, and comes back to the security settings. */
export default function SsoConnectButton(props: SsoConnectButtonProps) {
  return (
    <ProviderRedirectButton
      process={Process.connect}
      callbackUrl={getAbsoluteHashUrl(ACCOUNT_ROUTES.SECURITY)}
      {...props}
    />
  )
}
