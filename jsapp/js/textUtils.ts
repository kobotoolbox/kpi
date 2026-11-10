import envStore from '#/envStore'

const ORIGINAL_SUPPORT_EMAIL = 'help@kobotoolbox.org'

/**
 * Replaces the hardcoded email string (coming from transifex translation) with
 * the one from the `/environment` endpoint.
 *
 * `supportEmail` is for callers holding that address already, from their own `/environment` query: the store
 * fetches on import and starts out empty, so a caller that waited for its own copy would otherwise fall back
 * to the KoboToolbox address while the store is still in flight.
 */
export function replaceSupportEmail(str: string, supportEmail?: string | null): string {
  const address = supportEmail || envStore.data.support_email
  if (typeof address === 'string' && address.length !== 0) {
    return str.replace(ORIGINAL_SUPPORT_EMAIL, address)
  } else {
    return str
  }
}

/**
 * Returns an HTML string where [bracket] notation is replaced with a hyperlink
 */
export function replaceBracketsWithLink(str: string, url?: string): string {
  const bracketRegex = /\[([^\]]+)\]/g
  if (!url) {
    return str.replace(bracketRegex, '$1')
  }
  const linkHtml = `<a href="${url}" target="_blank">$1</a>`
  return str.replace(bracketRegex, linkHtml)
}

export function addRequiredToLabel(label: string, isRequired = true): string {
  if (!isRequired) {
    return label
  }
  const requiredTemplate = t('##field_label## (required)')
  return requiredTemplate.replace('##field_label##', label)
}

export function hasLongWords(text: string, limit = 25): boolean {
  const textArr = text.split(' ')
  const maxLength = Math.max(...textArr.map((el) => el.length))
  return maxLength >= limit
}

export function toTitleCase(str: string): string {
  return str.replace(/(^|\s)\S/g, (t) => t.toUpperCase())
}
