import { Typography, type TypographyProps } from '@mantine/core'
import cx from 'classnames'
import styles from './InjectedHtml.module.scss'

export interface InjectedHtmlProps extends Omit<TypographyProps, 'children'> {
  /** Django Admin's HTML rendered from markdown. We assume it is already sanitized. */
  html: string
}

/** Renders HTML in Mantine `Typography`. */
export default function InjectedHtml({ html, className, ...props }: InjectedHtmlProps) {
  return <Typography {...props} className={cx(styles.root, className)} dangerouslySetInnerHTML={{ __html: html }} />
}
