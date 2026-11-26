// eslint-disable-next-line no-restricted-imports -- This file is the Kobo wrapper for the component
import { Checkbox as CheckboxMantine, Text } from '@mantine/core'
import type { CheckboxProps as CheckboxPropsMantine } from '@mantine/core'
import cx from 'classnames'
import styles from './CheckboxNew.module.css'

export interface CheckboxProps extends CheckboxPropsMantine {
  /** Shows or hides the asterisk regardless of `required`, like on Mantine inputs. */
  withAsterisk?: boolean
}

/**
 * Mantine's checkbox with a smaller box, and the red asterisk Mantine inputs get on their label when required. Named
 * `New` because the deprecated `checkbox.tsx` already takes the name.
 */
export default function CheckboxNew({ label, required, withAsterisk = required, className, ...props }: CheckboxProps) {
  return (
    <CheckboxMantine
      className={cx(styles.root, className)}
      required={required}
      label={
        label && (
          <>
            {label}
            {/* Hidden from screen readers, which announce the input's `required` instead */}
            {withAsterisk && (
              <Text span inherit c='var(--mantine-color-error)' aria-hidden>
                {' *'}
              </Text>
            )}
          </>
        )
      }
      {...props}
    />
  )
}
