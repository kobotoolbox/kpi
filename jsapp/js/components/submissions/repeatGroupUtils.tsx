import type * as React from 'react'
import type { DataResponse } from '#/api/models/dataResponse'
import DeletedAttachment from '#/attachments/deletedAttachment.component'
import type { SubmissionResponse, SubmissionResponseValue, SubmissionResponseValueObject } from '#/dataInterface'
import { recordKeys } from '#/utils'
import { getMediaAttachment } from './submissionMediaUtils'

export interface RepeatGroupAnswerOptions {
  /** Keep unanswered repeat iterations visible using a placeholder value. */
  includeUnanswered?: boolean
  /** Placeholder used for unanswered repeat iterations. */
  unansweredPlaceholder?: string
}

export interface RepeatGroupAnswerValueText {
  kind: 'text'
  value: string
}

export interface RepeatGroupAnswerValueDeletedAttachment {
  kind: 'deleted-attachment'
}

export type RepeatGroupAnswerValue = RepeatGroupAnswerValueText | RepeatGroupAnswerValueDeletedAttachment

export type RepeatGroupAnswerTreeNode = RepeatGroupAnswerValue | RepeatGroupAnswerTreeNode[]

export function formatRepeatGroupAnswerValueToText(answerValue: RepeatGroupAnswerValue): string {
  if (answerValue.kind === 'deleted-attachment') {
    return t('Deleted attachment')
  }

  return answerValue.value
}

const isSubmissionResponseValueObject = (data: any): data is SubmissionResponseValueObject => {
  if (data === null) return false
  if (typeof data !== 'object') return false
  if (Array.isArray(data)) return false
  if (recordKeys(data).length === 0) return false

  return true
}

/**
 * Returns answers for one repeat-group question as a flat list.
 *
 * This helper exists for older callers that expect a simple flat array.
 */
export function getRepeatGroupAnswers(
  responseData: DataResponse | SubmissionResponse,
  /** Full (nested) path to a response, e.g. group_person/group_pets/group_pet/pet_name. */
  fullPath: string,
  options?: RepeatGroupAnswerOptions,
): React.ReactNode[] {
  const answerTree = getRepeatGroupAnswerTree(responseData, fullPath, options)

  const formatAnswerNode = (answerNode: RepeatGroupAnswerTreeNode): React.ReactNode[] => {
    if (!Array.isArray(answerNode)) {
      return [renderRepeatGroupAnswerValue(answerNode)]
    }

    return answerNode.flatMap((childNode) => formatAnswerNode(childNode))
  }

  return answerTree.flatMap((answerNode) => formatAnswerNode(answerNode))
}

export function getRepeatGroupAnswerTree(
  responseData: DataResponse | SubmissionResponse,
  /** Full (nested) path to a response, e.g. group_person/group_pets/group_pet/pet_name. */
  fullPath: string,
  options?: RepeatGroupAnswerOptions,
): RepeatGroupAnswerTreeNode[] {
  const pathSegments = fullPath.split('/')
  const lastPathSegmentIndex = pathSegments.length - 1
  const shouldIncludeUnanswered = options?.includeUnanswered === true
  const unansweredPlaceholder = options?.unansweredPlaceholder || '-'

  const lookForAnswers = (
    data: DataResponse | SubmissionResponse | SubmissionResponseValue,
    currentDepth = 0,
    responseIndex?: number,
    allowBareSegmentFallback = false,
  ): RepeatGroupAnswerTreeNode[] => {
    if (!isSubmissionResponseValueObject(data)) return []

    // Some submissions store the child repeat key directly on the current
    // object, even when part of the path is missing as its own nested object.
    // We keep walking forward through the path until we find the first key that
    // actually exists in this branch.
    let resolvedDepth = currentDepth
    let submissionResponseValue: SubmissionResponseValue | undefined
    while (resolvedDepth <= lastPathSegmentIndex) {
      const resolvedPath = pathSegments.slice(0, resolvedDepth + 1).join('/')
      const resolvedSegment = pathSegments[resolvedDepth]
      const hasResolvedPath = Object.prototype.hasOwnProperty.call(data, resolvedPath)
      const hasResolvedSegment = allowBareSegmentFallback && Object.prototype.hasOwnProperty.call(data, resolvedSegment)

      if (hasResolvedPath || hasResolvedSegment) {
        submissionResponseValue = hasResolvedPath ? data[resolvedPath] : data[resolvedSegment]
        break
      }

      resolvedDepth += 1
    }

    if (typeof submissionResponseValue === 'undefined') return []

    if (resolvedDepth === lastPathSegmentIndex) {
      // Once we reach the last path segment, the value should be the answer for
      // this question. If it is an array instead, the saved submission shape no
      // longer matches the current form shape, so we skip it instead of
      // guessing.
      if (Array.isArray(submissionResponseValue)) return []

      // Attachments inside repeat groups are keyed by a path that includes the
      // repeat index, for example `band_member[3]/portrait_photo`.
      const responseNumber = responseIndex !== undefined ? responseIndex + 1 : undefined
      const levelParentKey = fullPath.split('/').slice(0, resolvedDepth).join('/')
      const attachmentPath = appendTextToPathAtLevel(fullPath, levelParentKey, `[${responseNumber}]`)
      const attachment = getMediaAttachment(responseData, String(submissionResponseValue), attachmentPath)

      if (typeof attachment === 'object' && attachment?.is_deleted) {
        return [{ kind: 'deleted-attachment' }]
      }

      return [{ kind: 'text', value: String(submissionResponseValue) }]
    }

    if (isSubmissionResponseValueObject(submissionResponseValue)) {
      return lookForAnswers(submissionResponseValue, resolvedDepth + 1, responseIndex, true)
    }

    // If this branch is not an object or an array, then the saved submission
    // shape no longer matches the current form shape.
    if (!Array.isArray(submissionResponseValue)) return []

    const answersByBranch: RepeatGroupAnswerTreeNode[][] = submissionResponseValue.map(
      (item: SubmissionResponseValue, itemIndex: number) => lookForAnswers(item, resolvedDepth + 1, itemIndex, true),
    )

    const normalizedAnswersByBranch: RepeatGroupAnswerTreeNode[][] = answersByBranch.map(
      (branchAnswers, branchIndex) => {
        if (!shouldIncludeUnanswered || branchAnswers.length > 0) {
          return branchAnswers
        }

        const branchItem = submissionResponseValue[branchIndex]
        if (!isSubmissionResponseValueObject(branchItem)) {
          return []
        }

        return [{ kind: 'text', value: unansweredPlaceholder }]
      },
    )

    if (resolvedDepth + 2 <= lastPathSegmentIndex) {
      const groupedAnswers: RepeatGroupAnswerTreeNode[] = []

      for (const branch of normalizedAnswersByBranch) {
        if (branch.length <= 0) {
          continue
        }

        groupedAnswers.push(branch)
      }

      return groupedAnswers
    }

    return normalizedAnswersByBranch.reduce<RepeatGroupAnswerTreeNode[]>((flattenedAnswers, branch) => {
      flattenedAnswers.push(...branch)
      return flattenedAnswers
    }, [])
  }

  return lookForAnswers(responseData)
}

function appendTextToPathAtLevel(path: string, level: string, stringToAdd: string): string {
  const parts = path.split('/')
  const index = parts.indexOf(level)
  if (index !== -1) {
    parts[index] = `${parts[index]}${stringToAdd}`
  }
  return parts.join('/')
}

function renderRepeatGroupAnswerValue(answerValue: RepeatGroupAnswerValue): React.ReactNode {
  if (answerValue.kind === 'deleted-attachment') {
    return <DeletedAttachment />
  }

  return answerValue.value
}
