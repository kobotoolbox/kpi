/**
 * Renders a tag name as a `q` search value, in a form that won't break the API call. See tests for examples
 */
export function formatTagValue(tagName: string) {
  if (!tagName.includes('"')) {
    return `"${tagName}"`
  }
  if (!tagName.includes("'")) {
    return `'${tagName}'`
  }
  if (!/^["']|[\s():]/.test(tagName)) {
    return tagName
  }
  return '""'
}
