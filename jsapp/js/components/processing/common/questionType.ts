/** Kept out of `./utils` because of circular dependency problem */

import type { DataResponse } from '#/api/models/dataResponse'
import { findRowByXpath } from '#/assetUtils'
import {
  findAttachmentByQuestionXpath,
  inferAttachmentQuestionType,
} from '#/components/submissions/submissionMediaUtils'
import { QUESTION_TYPES } from '#/constants'
import type { AnyRowTypeName } from '#/constants'
import type { AssetResponse } from '#/dataInterface'

/** The type of the question a processing route was opened at */
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
