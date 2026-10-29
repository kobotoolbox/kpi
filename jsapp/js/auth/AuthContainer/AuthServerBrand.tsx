import { Box, Image, Pill, type PillProps } from '@mantine/core'
import type { AuthConfiguration } from '#/api/models/authConfiguration'
import { AuthServerTagEnum } from '#/api/models/authServerTagEnum'

/**
 * Pill look for each server tag, using the palette shades closest to Figma.
 * Labels are functions, so `t()` runs at render.
 */
const SERVER_TAGS: Record<AuthServerTagEnum, { label: () => string; variant: PillProps['variant']; border: string }> = {
  [AuthServerTagEnum.global]: {
    label: () => t('Global server'),
    variant: 'blue-light',
    border: 'var(--mantine-color-blue-3)',
  },
  [AuthServerTagEnum.eu]: {
    label: () => t('EU server'),
    variant: 'teal-light',
    border: 'var(--mantine-color-teal-2)',
  },
}

export interface AuthServerBrandProps {
  authConfiguration: AuthConfiguration | undefined
}

/**
 * Top of the login and signup cards: the server tag, else the organization logo, else nothing.
 * The tag wins over the logo, as the backend documents.
 */
export default function AuthServerBrand({ authConfiguration }: AuthServerBrandProps) {
  const serverTag = authConfiguration?.server_tag
  if (serverTag) {
    const { label, variant, border } = SERVER_TAGS[serverTag]
    return (
      // Pill is inline, so the spacing goes on a block wrapper.
      <Box mb='xl'>
        <Pill variant={variant} size='md' bd={`1px solid ${border}`}>
          {label()}
        </Pill>
      </Box>
    )
  }

  if (authConfiguration?.logo_url) {
    // No organization name to describe it with, so it's decorative.
    return <Image src={authConfiguration.logo_url} alt='' h={40} w='auto' maw='100%' fit='contain' mb='xl' />
  }

  return null
}
