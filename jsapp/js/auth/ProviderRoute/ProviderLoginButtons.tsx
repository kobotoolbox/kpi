import { Divider, Stack } from '@mantine/core'
import type { SocialApp } from '#/api/models/socialApp'
import ProviderRedirectButton from './ProviderRedirectButton'
import { getProviderRedirectId } from './providerRedirect'

export interface ProviderLoginButtonsProps {
  /** `social_apps` from `/api/v2/environment/`, which lists the public providers only. */
  socialApps: SocialApp[] | undefined
}

/**
 * One button per single sign-on provider the server advertises, under the credentials on the login screen.
 *
 * Nothing renders when there are none, so an instance without SSO gets no stray divider. Hidden providers
 * are absent from `social_apps` by design - those are reached through their own link, see
 * `ProviderLoginRoute`.
 */
export default function ProviderLoginButtons({ socialApps }: ProviderLoginButtonsProps) {
  if (!socialApps?.length) {
    return null
  }

  return (
    <Stack gap='sm'>
      <Divider label={t('or')} labelPosition='center' />

      {socialApps.map((socialApp) => (
        <ProviderRedirectButton
          key={getProviderRedirectId(socialApp)}
          providerId={getProviderRedirectId(socialApp)}
          variant='outline'
          size='lg'
          fullWidth
        >
          {t('Log in with ##provider##').replace('##provider##', () => socialApp.name)}
        </ProviderRedirectButton>
      ))}
    </Stack>
  )
}
