import { Stack, Typography } from '@mantine/core'
import type { AuthConfiguration } from '#/api/models/authConfiguration'
import styles from './AuthAside.module.scss'

export interface AuthAsideProps {
  /** `auth_configuration.supporting_image_url` */
  imageUrl: string | null | undefined
  /** `auth_configuration.supporting_text` */
  text: string | undefined
}

/**
 * The supporting column beside an authentication form, entirely server configured:
 * - `login_supporting_image` above
 * - `welcome_message` sitewide message below --> HTML via markdownify, we trust Django sanitized it already
 *
 * No defaults, so a screen leaves out the whole column when neither is set - see {@link shouldRenderAuthAside}.
 */
export default function AuthAside({ imageUrl, text }: AuthAsideProps) {
  return (
    <Stack gap='lg'>
      {imageUrl && <img className={styles.image} src={imageUrl} alt='' />}

      {text && <Typography className={styles.text} fz='sm' dangerouslySetInnerHTML={{ __html: text }} />}
    </Stack>
  )
}

/**
 * Whether the server configured anything for the supporting column, so a screen can skip `AuthCard`'s
 * `aside` entirely.
 */
export function shouldRenderAuthAside(authConfiguration: AuthConfiguration | undefined): boolean {
  return Boolean(authConfiguration?.supporting_image_url || authConfiguration?.supporting_text)
}
