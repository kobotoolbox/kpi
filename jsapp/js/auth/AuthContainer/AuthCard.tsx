import { Box, Divider, Paper } from '@mantine/core'
import cx from 'classnames'
import styles from './AuthCard.module.scss'

export interface AuthCardProps {
  children: React.ReactNode
  /** Optional second column: supporting content beside the form on a wide card, below it on a narrow one. */
  aside?: React.ReactNode
}

/**
 * The white card at the centre of every authentication screen. Put a form in `children`; pass `aside`
 * to get the two column variant, which stacks into one column when the card is too narrow for both.
 *
 * Mantine gives us the card surface and the divider; the stylesheet covers what Mantine can't express
 * (the Figma box-shadow, the flex row, and the container query that drives the responsive padding and
 * the stacking).
 */
export default function AuthCard({ children, aside }: AuthCardProps) {
  return (
    // The container query in the stylesheet can't be written against the element that declares
    // `container-type`, so the card is a child of this wrapper rather than being the wrapper itself.
    <div className={cx(styles.container, { [styles['container--twoColumns']]: aside })}>
      {/* `bd='none'` beats the theme's unconditional `Paper` border with an inline style, no
          `!important` needed. `p={0}` because the padding belongs to the columns, so the divider can
          run the card's full height - and because a container query can't override an inline style. */}
      <Paper component='section' radius={16} p={0} bd='none' className={styles.card}>
        <Box className={styles.column}>{children}</Box>

        {aside && (
          <>
            <Divider orientation='vertical' className={styles.divider} />
            <Box className={styles.column}>{aside}</Box>
          </>
        )}
      </Paper>
    </div>
  )
}
