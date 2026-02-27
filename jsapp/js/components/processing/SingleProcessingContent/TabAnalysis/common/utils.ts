import type { ActionEnum } from '#/api/models/actionEnum'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { ResponseManualQualActionParams } from '#/api/models/responseManualQualActionParams'
import type { QualVersionItem } from '#/components/processing/common/types'
import { ANALYSIS_QUESTION_TYPES } from './constants'

export interface AdvancedFeatureResponseManualQual extends AdvancedFeatureResponse {
  question_xpath: string
  action: typeof ActionEnum.manual_qual
  params: ResponseManualQualActionParams[]
  uid: string
}

export function getQuestionTypeDefinition(type: ResponseManualQualActionParams['type']) {
  return ANALYSIS_QUESTION_TYPES.find((definition) => definition.type === type)
}

/**
 * Checks if given qual answer data is AI generated
 */
export function isAnswerAIGenerated(qaAnswer: QualVersionItem | undefined) {
  // We assume if 'status' is there, it means it went through AI
  return qaAnswer && 'status' in qaAnswer._data
}

export function hasNonEmptyAnswer(type: ResponseManualQualActionParams['type'], qaAnswer: QualVersionItem | undefined) {
  if (qaAnswer === undefined) {
    return false
  }

  if ('value' in qaAnswer._data) {
    switch (type) {
      case 'qualSelectMultiple':
      case 'qualTags':
        return Array.isArray(qaAnswer._data.value) && qaAnswer._data.value.length !== 0
      case 'qualSelectOne':
      case 'qualText':
        return qaAnswer._data.value !== ''
      case 'qualInteger':
        return qaAnswer._data.value !== null
      default:
        return false
    }
  }

  return false
}

export function getEmptyAnswer(type: ResponseManualQualActionParams['type']) {
  switch (type) {
    case 'qualSelectMultiple':
    case 'qualTags':
      return []
    case 'qualSelectOne':
    case 'qualText':
      return ''
    case 'qualInteger':
      return null
    default:
      return ''
  }
}
