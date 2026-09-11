import type { FailResponse } from '#/dataInterface'
import { flattenErrorBody } from './flattenErrorBody'
import { getDisplayableErrorText } from './getDisplayableErrorText'

/**
 * The message to show the user for a legacy (jQuery) fail response, or `null` when it carries none - callers then use
 * their own copy. jQuery parses the body for us when it's JSON, so that is preferred over re-parsing the text.
 */
export function getFailResponseMessage(response: FailResponse): string | null {
  return (
    flattenErrorBody(response.responseJSON) ||
    flattenErrorBody(getDisplayableErrorText(response.responseText, response.status))
  )
}
