import React from 'react'
import { Link } from 'react-router-dom'

interface TextWithInternalLinkProps {
  /** Translation string with [bracketed text] that becomes the link */
  text: string
  /** Internal path to navigate to (react-router path, not external URL) */
  path: string
}

/**
 * Component that replaces [bracketed text] in a translation string with a
 * react-router Link component for internal navigation.
 *
 * Example:
 * ```tsx
 * <TextWithInternalLink
 *   text={t('[Click here] to view details')}
 *   path="/account/settings"
 * />
 * ```
 *
 * Output: "Click here to view details" where "Click here" is a Link to /account/settings
 */
export default function TextWithInternalLink(props: TextWithInternalLinkProps) {
  const bracketRegex = /\[([^\]]+)\]/

  // Split text on the first [bracketed] match
  const match = props.text.match(bracketRegex)

  if (!match) {
    // No brackets found, return plain text
    return <>{props.text}</>
  }

  const beforeLink = props.text.substring(0, match.index)
  const linkText = match[1]
  const afterLink = props.text.substring(match.index! + match[0].length)

  return (
    <>
      {beforeLink}
      <Link to={props.path}>{linkText}</Link>
      {afterLink}
    </>
  )
}
