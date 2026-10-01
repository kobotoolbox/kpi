/** Kept out of `./utils` because of circular dependency problem */

import type { DataResponse } from '#/api/models/dataResponse'
import { findRowByXpath, getRowName } from '#/assetUtils'
import {
  findAttachmentByQuestionXpath,
  inferAttachmentQuestionType,
} from '#/components/submissions/submissionMediaUtils'
import { GROUP_TYPES_BEGIN, GROUP_TYPES_END, GroupTypeBeginName, QUESTION_TYPES } from '#/constants'
import type { AnyRowTypeName } from '#/constants'
import type { AssetResponse, SubmissionResponse, SurveyRow } from '#/dataInterface'

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

/** Paths of every repeat group of the form, nested ones included (e.g. `household/members`). */
function getRepeatGroupPaths(survey: SurveyRow[]): Set<string> {
  const repeatPaths = new Set<string>()
  const openedGroups: string[] = []

  for (const row of survey) {
    if (Object.prototype.hasOwnProperty.call(GROUP_TYPES_BEGIN, row.type)) {
      openedGroups.push(getRowName(row))
      if (row.type === GroupTypeBeginName.begin_repeat) {
        repeatPaths.add(openedGroups.join('/'))
      }
    } else if (Object.prototype.hasOwnProperty.call(GROUP_TYPES_END, row.type)) {
      openedGroups.pop()
    }
  }

  return repeatPaths
}

/**
 * Whether the answer at `xpath` sits inside a repeat group, whatever its question type. Processing
 * works per question and not per repeat instance, so such answers must not lead there.
 *
 * A repeat-instance index in the path (e.g. `members[2]/name`) settles it. Otherwise the submission
 * decides where it has the data (a parent path holding the list of repeat instances, or a plain
 * answer at `xpath`), so a question moved in or out of a repeat since is judged by where this
 * submission put it. Only then does the form definition decide.
 */
export function isInRepeatGroup(
  asset: AssetResponse,
  xpath: string,
  submission?: DataResponse | SubmissionResponse,
): boolean {
  if (/\[\d+\]/.test(xpath)) {
    return true
  }

  const pathSegments = xpath.split('/')
  const parentPaths = pathSegments.slice(0, -1).map((_segment, index) => pathSegments.slice(0, index + 1).join('/'))

  if (submission) {
    if (parentPaths.some((parentPath) => Array.isArray(submission[parentPath]))) {
      return true
    }
    if (submission[xpath] !== undefined) {
      return false
    }
  }

  const repeatPaths = getRepeatGroupPaths(asset.content?.survey ?? [])
  return parentPaths.some((parentPath) => repeatPaths.has(parentPath))
}
