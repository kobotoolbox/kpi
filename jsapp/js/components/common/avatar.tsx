import React from 'react'

import cx from 'classnames'
import styles from './avatar.module.scss'

export type AvatarSize = 's' | 'm'

/**
 * A simple function that generates hsl color from given string. Saturation and
 * lightness is not random, just the hue.
 */
function stringToHSL(string: string, saturation: number, lightness: number) {
  let hash = 0
  for (let i = 0; i < string.length; i++) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash
  }
  return `hsl(${hash % 360}, ${saturation}%, ${lightness}%)`
}

interface AvatarProps {
  /**
   * It is not recommended to display full name or email with `s` size.
   */
  size: AvatarSize
  /**
   * First letter of the username would be used as avatar. Whole username would
   * be used to generate the color of the avatar. If `isUsernameVisible` is
   * being used, username will be displayed next to the avatar.
   */
  username: string
  /** Username is required, but will not be displayed by default. */
  isUsernameVisible?: boolean
  fullName?: string
  email?: string
  isEmpty?: boolean
}

/**
 * Displays an avatar (a letter in a circle) and optionally also username, full
 * name and email.
 */
export default function Avatar(props: AvatarProps) {
  const isAnyTextBeingDisplayed = props.isUsernameVisible || props.fullName !== undefined || props.email !== undefined

  return (
    <div className={cx(styles.avatar, styles[`avatar-size-${props.size}`])}>
      {props.isEmpty ? (
        <div className={cx(styles.initials, styles.empty)}>
          &nbsp; {/* Empty space to keep the div from shifting sizes for being empty */}
          <svg viewBox='0 0 24 24'>
            <circle cx='12' cy='12' r='11' />
          </svg>
        </div>
      ) : (
        <div className={styles.initials} style={{ backgroundColor: `${stringToHSL(props.username, 80, 40)}` }}>
          {props.username.charAt(0)}
        </div>
      )}

      {isAnyTextBeingDisplayed && (
        <div
          className={cx(styles.text, {
            [styles.hasFullName]: props.fullName !== undefined,
          })}
        >
          {props.fullName !== undefined && <span className={styles.fullName}>{props.fullName}</span>}

          {/* Sometimes will be prefixed with "@" symbol */}
          {props.isUsernameVisible && <span className={styles.username}>{props.username}</span>}

          {props.email !== undefined && <div className={styles.email}>{props.email}</div>}
        </div>
      )}
    </div>
  )
}
