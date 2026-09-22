/**
 * Kept out of `./utils` because this needs `#/assetUtils`, and that file reaches back into
 * `./utils` through `bulkProcessingUtils` - importing it there closes the circle.
 */

import type { DataResponse } from '#/api/models/dataResponse'
import { findRowByXpath } from '#/assetUtils'
import {
  findAttachmentByQuestionXpath,
  inferAttachmentQuestionType,
} from '#/components/submissions/submissionMediaUtils'
import { QUESTION_TYPES } from '#/constants'
import type { AnyRowTypeName } from '#/constants'
import type { AssetResponse } from '#/dataInterface'

/**
 * The type of the question a processing route was opened at.
 *
 * The form is asked first, so the type is there before the submission loads. With no row for
 * the path - renamed, moved or removed since - an attachment's mimetype says which kind of
 * media, and a plain string with no file says text. Paths are matched exactly; leaf names pick
 * the wrong question's type sooner or later.
 */
export function getProcessingQuestionType(
  asset: AssetResponse,
  xpath: string,
  submission?: DataResponse,
): AnyRowTypeName | undefined {
  const row = asset.content && findRowByXpath(asset.content, xpath)
  if (row) {
    return row.type
  }

  if (!submission) {
    return undefined
  }

  const attachment = findAttachmentByQuestionXpath(submission, xpath)
  if (attachment) {
    return inferAttachmentQuestionType(attachment)
  }

  return typeof submission[xpath] === 'string' ? QUESTION_TYPES.text.id : undefined
}
