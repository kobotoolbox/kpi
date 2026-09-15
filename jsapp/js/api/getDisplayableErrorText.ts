/**
 * Keeps response bodies that aren't messages out of the UI.
 */

/**
 * An allowlist, because real messages contain angle brackets, like `'must be < 5'`. A tag name has to end the way one
 * does in markup, or an address such as `<a@b.com>` would read as a link.
 */
const HTML_TAG_REGEX =
  /<\/?(?:!doctype|html|head|body|title|meta|link|script|style|div|span|p|h[1-6]|a|img|br|hr|table|thead|tbody|tr|td|th|ul|ol|li|dl|dt|dd|pre|code|form|input|button|label|iframe|section|article|header|footer|main|nav|strong|em|b|i|small|font|center|blockquote|textarea)(?=[\s/>])[^>]*>/i

/** Whether `text` is page output rather than a message. */
export function containsHtmlMarkup(text: string): boolean {
  return HTML_TAG_REGEX.test(text)
}

/**
 * The body when it's fit to show a user, or `null` when it's error-page output and the caller should fall back to its
 * own message. Pass the *raw* body only - structured errors go through `flattenErrorBody`.
 */
export function getDisplayableErrorText(body: unknown, status?: number): string | null {
  if (typeof body !== 'string') {
    return null
  }

  const text = body.trim()

  if (!text) {
    return null
  }

  if (status !== undefined && status >= 500) {
    return null
  }

  if (containsHtmlMarkup(text)) {
    return null
  }

  return text
}
