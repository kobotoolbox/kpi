/** Always this many asterisks, so the mask does not give away how long the address really is. */
const MASK = '*'.repeat(6)

/**
 * Keeps the first character of the local part and hides the rest: `kobo.person@gmail.com` becomes
 * `k******@gmail.com`. The domain stays readable on purpose.
 */
export function maskEmail(email: string): string {
  // `lastIndexOf`, since a quoted local part may legally contain an `@` of its own.
  const separator = email.lastIndexOf('@')
  const localPart = separator === -1 ? email : email.slice(0, separator)
  const domain = separator === -1 ? '' : email.slice(separator)
  // No first character to keep, so there is nothing to mask around: hand back what we were given.
  if (!localPart) {
    return email
  }
  return `${localPart[0]}${MASK}${domain}`
}
