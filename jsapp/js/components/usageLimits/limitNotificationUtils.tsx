import type { UsageLimitTypes } from '#/account/stripe.types'

/*
 * Returns a formatted string of usage types for use in notifications for users
 * nearing or exceeding their usage limits
 */
export function getAllLimitsText(limits: UsageLimitTypes[]) {
  if (limits.length === 0) {
    return ''
  }
  if (limits.length === 1) {
    return `${limits[0]}`
  }
  return `${limits.slice(0, -1).join(', ')} ${t('and')} ${limits.slice(-1)[0]}`
}

// TODO: Find a better way to handle this common translation scenario
/*
 * Returns a translated string of appropriately plural or singular 'limit'
 */
export function pluralizeLimit(count: number) {
  return count > 1 ? t('limits') : t('limit')
}
