import { Divider, Stack } from '@mantine/core'
import type { SocialApp } from '#/api/models/socialApp'
import type { ButtonProps } from '#/components/common/ButtonNew'
import ProviderRedirectButton from './ProviderRedirectButton'
import { getProviderRedirectId } from './providerRedirect'

/** The design allows three at most. */
const MAX_PROVIDER_BUTTONS = 3

export interface ProviderLoginButtonsProps {
  /** `social_apps` from `/api/v2/environment/`, which lists the public providers only. */
  socialApps: SocialApp[] | undefined
  /** Primary on the login screen, secondary on signup. */
  variant: ButtonProps['variant']
}

/**
 * Single sign-on buttons, with an "or" divider under them. Used on both login and signup, since allauth's
 * `login` process also creates accounts.
 *
 * Nothing renders when there are none, so an instance without SSO gets no stray divider. Hidden providers
 * are absent from `social_apps` by design - those are reached through their own link, see
 * `ProviderLoginRoute`.
 */
export default function ProviderLoginButtons({ socialApps, variant }: ProviderLoginButtonsProps) {
  if (!socialApps?.length) {
    return null
  }

  return (
    <Stack gap='sm'>
      {/* First three, in server order */}
      {socialApps.slice(0, MAX_PROVIDER_BUTTONS).map((socialApp) => (
        <ProviderRedirectButton
          key={getProviderRedirectId(socialApp)}
          providerId={getProviderRedirectId(socialApp)}
          variant={variant}
          size='lg'
          fullWidth
        >
          {t('Continue with ##provider##').replace('##provider##', () => socialApp.name)}
        </ProviderRedirectButton>
      ))}

      <Divider label={t('or')} labelPosition='center' />
    </Stack>
  )
}
