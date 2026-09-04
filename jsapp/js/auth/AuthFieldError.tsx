import { IconAlertTriangleFilled } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import KoboIcon from '#/components/common/KoboIcon'
import styles from './AuthFieldError.module.scss'

/**
 * A warning icon in front of an input's error message. Mantine's `error` prop takes any node, so passing
 * one of these keeps the input's default invalid styling.
 */
export default function AuthFieldError({ children }: { children: ReactNode }) {
  return (
    <span className={styles.fieldError}>
      <KoboIcon className={styles.icon} icon={IconAlertTriangleFilled} size='xs' />
      <span>{children}</span>
    </span>
  )
}

/**
 * Wraps `form.getInputProps()` so a Mantine input on these screens gets the icon:
 *
 * ```
 * <TextInput {...withAuthFieldError(form.getInputProps('email'))} />
 * ```
 */
export function withAuthFieldError<Props extends { error?: ReactNode }>(props: Props) {
  return { ...props, error: props.error ? <AuthFieldError>{props.error}</AuthFieldError> : undefined }
}
