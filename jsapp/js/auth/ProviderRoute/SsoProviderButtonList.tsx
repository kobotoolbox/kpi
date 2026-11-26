import { Divider, Stack } from '@mantine/core'
import type { SocialApp } from '#/api/models/socialApp'
import ProviderRedirectButton from './ProviderRedirectButton'
import { getProviderRedirectId } from './providerRedirect'

/** The design allows three at most. */
const MAX_PROVIDER_BUTTONS = 3

export interface SsoProviderButtonListProps {
  /** `social_apps` from `/api/v2/environment/`, which lists the public providers only. */
  socialApps: SocialApp[] | undefined
  /** Side of the buttons the "or" divider goes on, facing the password form. */
  dividerPosition: 'top' | 'bottom'
}

/**
 * Single sign-on buttons, with an "or" divider between them and the password form. Used on both login and
 * signup, since allauth's `login` process also creates accounts.
 *
 * Nothing renders when there are none, so an instance without SSO gets no stray divider. Hidden providers
 * are absent from `social_apps` by design - those are reached through their own link, see
 * `ProviderLoginRoute`.
 */
export default function SsoProviderButtonList({ socialApps, dividerPosition }: SsoProviderButtonListProps) {
  if (!socialApps?.length) {
    return null
  }

  const divider = <Divider label={t('or')} labelPosition='center' color='gray.5' />

  // `lg` around the divider, the same gap parents put next to the form
  return (
    <Stack gap='lg'>
      {dividerPosition === 'top' && divider}

      <Stack gap='sm'>
        {/* First three, in server order */}
        {socialApps.slice(0, MAX_PROVIDER_BUTTONS).map((socialApp) => (
          <ProviderRedirectButton
            key={getProviderRedirectId(socialApp)}
            providerId={getProviderRedirectId(socialApp)}
            variant='light'
            size='lg'
            fullWidth
          >
            {t('Continue with ##provider##').replace('##provider##', () => socialApp.name)}
          </ProviderRedirectButton>
        ))}
      </Stack>

      {dividerPosition === 'bottom' && divider}
    </Stack>
  )
}
