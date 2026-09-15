import { Stack, Typography } from '@mantine/core'
import styles from './RegisterAside.module.scss'

export interface RegisterAsideProps {
  /** `auth_configuration.supporting_image_url` */
  imageUrl: string | null | undefined
  /** `auth_configuration.supporting_text` */
  text: string | undefined
}

/**
 * The supporting column beside the registration form, entirely server configured:
 * - `login_supporting_image` above
 * - `welcome_message` sitewide message below --> HTML via markdownify, we trust Django sanitized it already
 *
 * No defaults, so `RegisterRoute` leaves out the whole column when neither is set.
 */
export default function RegisterAside({ imageUrl, text }: RegisterAsideProps) {
  return (
    <Stack gap='lg'>
      {imageUrl && <img className={styles.image} src={imageUrl} alt='' />}

      {text && <Typography className={styles.text} fz='sm' dangerouslySetInnerHTML={{ __html: text }} />}
    </Stack>
  )
}
