import type { SocialApp } from '#/api/models/socialApp'
import { getRequiredFieldMessage, validateRequiredField } from '#/auth/authValidation'

/**
 * Client side validation for the registration form. The backend is authoritative, so this only saves a
 * round trip. The checks shared with the sign-in form live in `#/auth/authValidation`.
 */

/** Loose on purpose - rejecting a deliverable address is worse than letting the server say no. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Same as in `kobo/apps/accounts/validators.py` */
const USERNAME_PATTERN = /^[a-z][a-z0-9_]+$/
const USERNAME_MAX_LENGTH = 30

/** Nothing to check past it being filled in: names are free form, and deliberately so. */
export const validateFullName = validateRequiredField

export function validateUsername(value: string): string | null {
  if (!value.trim()) {
    return getRequiredFieldMessage()
  }
  if (!USERNAME_PATTERN.test(value) || value.length > USERNAME_MAX_LENGTH) {
    return t(
      'Usernames must be between 2 and 30 characters in length, and may only consist of lowercase letters, numbers, and underscores, where the first character must be a letter.',
    )
  }
  return null
}

export function validatePassword(value: string): string | null {
  // No length or complexity rules: every validator in `AUTH_PASSWORD_VALIDATORS` is gated behind a
  // constance setting that defaults to off, so the server decides.
  // TODO: strength meter in DEV-1866.
  // Untrimmed: a password of nothing but spaces is a valid one, however unwise.
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

export function validateTermsOfService(value: boolean): string | null {
  return value ? null : getRequiredFieldMessage()
}

function getEmailDomain(email: string): string | null {
  const domain = email.trim().toLowerCase().split('@')[1]
  return domain || null
}

/**
 * The managed single sign-on provider that owns this address' domain, if any.
 *
 * Best effort: `/environment` only lists providers flagged public, so a managed domain behind a
 * non-public one slips past.
 */
export function findManagedSsoProvider(email: string, socialApps: SocialApp[] | undefined): SocialApp | undefined {
  const domain = getEmailDomain(email)
  if (!domain) {
    return undefined
  }
  return socialApps?.find((app) => app.managed && app.domains?.some((appDomain) => appDomain.toLowerCase() === domain))
}

export function validateEmail(value: string, socialApps: SocialApp[] | undefined): string | null {
  if (!value.trim()) {
    return getRequiredFieldMessage()
  }
  if (!EMAIL_PATTERN.test(value.trim())) {
    return t('Please enter a valid email address')
  }
  if (findManagedSsoProvider(value, socialApps)) {
    // Verbatim from `KoboSignupMixin.clean_email`, which the headless endpoint never runs.
    return t('Your organization has restricted the use of passwords. Please sign up using SSO instead.')
  }
  return null
}
