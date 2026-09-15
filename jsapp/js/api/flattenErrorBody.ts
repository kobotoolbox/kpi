/**
 * Turns a Django error body into one line fit for a toast.
 */

/** These cover the whole request, so labelling them with the key would be noise. */
const UNLABELLED_KEYS = ['detail', 'error', 'non_field_errors', '__all__']

/** Real bodies nest a level or two; the cap is only so an odd shape can't run away. */
const MAX_DEPTH = 4

/** Toasts don't set `white-space: pre-wrap`, so a newline would collapse to a space. */
const SEPARATOR = ' '

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Drops branches that held no message, so empty values don't leave blank gaps. */
function joinParts(parts: (string | null)[]): string | null {
  const messages = parts.filter((part): part is string => part !== null)
  return messages.length > 0 ? messages.join(SEPARATOR) : null
}

function flatten(value: unknown, depth: number): string | null {
  if (depth > MAX_DEPTH) {
    return null
  }

  if (typeof value === 'string') {
    return value.trim() || null
  }

  // Retry delays and limits come through as numbers.
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return joinParts(value.map((item) => flatten(item, depth + 1)))
  }

  if (isPlainObject(value)) {
    return joinParts(
      Object.entries(value).map(([key, item]) => {
        const message = flatten(item, depth + 1)
        if (message === null) {
          return null
        }
        // Label once per field, not per message: flattening first keeps two errors on one field from reading
        // "name: too short. name: too common.".
        return UNLABELLED_KEYS.includes(key) ? message : `${key}: ${message}`
      }),
    )
  }

  return null
}

/**
 * Turns an error body into one line of text for the user, or `null` when there is no message in it.
 * The `body` is either parsed JSON or the raw response text.
 */
export function flattenErrorBody(body: unknown): string | null {
  let parsedBody = body

  if (typeof body === 'string') {
    const text = body.trim()
    if (!text) {
      return null
    }
    try {
      parsedBody = JSON.parse(text)
    } catch {
      return text
    }
  }

  if (isPlainObject(parsedBody)) {
    for (const key of ['error', 'detail'] as const) {
      const value = parsedBody[key]
      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    }
  }

  return flatten(parsedBody, 0)
}
