/**
 * The client side checks the authentication screens have in common. The backend is authoritative everywhere, so these
 * only save a round trip.
 */

/**
 * One wording for every empty field on these screens, kept in a function so it is translated at render time rather than
 * at module load.
 */
export const getRequiredFieldMessage = () => t('Required field')

/** Loose on purpose - rejecting a deliverable address is worse than letting the server say no. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * A field the form cannot be submitted without. Whitespace does not count as an answer - except in a password, which is
 * why that check is spelled out at each call site instead.
 */
export function validateRequiredField(value: string): string | null {
  return value.trim() ? null : getRequiredFieldMessage()
}

/** Filled in, and shaped like an address. Screens with extra rules, like registration's SSO check, build on this. */
export function validateEmailFormat(value: string): string | null {
  if (!value.trim()) {
    return getRequiredFieldMessage()
  }
  if (!EMAIL_PATTERN.test(value.trim())) {
    return t('Please enter a valid email address')
  }
  return null
}

export function validatePassword(value: string): string | null {
  // No complexity rules: every `AUTH_PASSWORD_VALIDATORS` entry is gated on a constance setting that
  // defaults to off, so the server decides. Untrimmed, since all spaces is a valid password.
  // TODO: strength meter in DEV-1866.
  return value ? null : getRequiredFieldMessage()
}

export function validatePasswordConfirm(value: string, password: string): string | null {
  if (!value) {
    return getRequiredFieldMessage()
  }
  if (value !== password) {
    return t('You must type the same password each time.')
  }
  return null
}
