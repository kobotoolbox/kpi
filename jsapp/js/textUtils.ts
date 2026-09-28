import envStore from '#/envStore'

const ORIGINAL_SUPPORT_EMAILS = ['help@kobotoolbox.org', 'support@kobotoolbox.org', 'soporte@data.umsa.bo']

/**
 * Replaces the hardcoded email string with
 * the one from the `/environment` endpoint or default DataUMSA support email.
 */
export function replaceSupportEmail(str: string): string {
  const targetEmail =
    typeof envStore.data.support_email === 'string' && envStore.data.support_email.length !== 0
      ? envStore.data.support_email
      : 'soporte@data.umsa.bo'

  let result = str
  for (const email of ORIGINAL_SUPPORT_EMAILS) {
    result = result.replace(email, targetEmail)
  }
  return result
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
