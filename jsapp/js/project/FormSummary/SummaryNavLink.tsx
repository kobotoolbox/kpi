import { NavLink } from '@mantine/core'
import React from 'react'
import { Link } from 'react-router-dom'
import Icon from '#/components/common/icon'
import styles from './FormSummary.module.scss'

interface SummaryNavLinkProps {
  label: string
  /** Icon class names, e.g. `k-icon k-icon-edit`. */
  icon: string
  /** Route to go to. Without it, this is a button. */
  to?: string
  onClick?: () => void
  disabled?: boolean
}

// No background on hover, only the color changes. Inline, so Mantine's own CSS can't win.
const navLinkVars = () => ({ root: { '--nl-hover': 'transparent' }, children: {} })

/** A row in the summary page link lists. */
export default function SummaryNavLink(props: SummaryNavLinkProps) {
  const sharedProps = {
    label: props.label,
    leftSection: <i className={props.icon} />,
    rightSection: <Icon name='angle-right' size='s' />,
    disabled: props.disabled,
    classNames: { root: styles.navLink, section: styles.navLinkIcon, label: styles.navLinkLabel },
    vars: navLinkVars,
  }

  if (props.to) {
    return <NavLink component={Link} to={props.to} {...sharedProps} />
  }

  return <NavLink component='button' type='button' onClick={props.onClick} {...sharedProps} />
}
