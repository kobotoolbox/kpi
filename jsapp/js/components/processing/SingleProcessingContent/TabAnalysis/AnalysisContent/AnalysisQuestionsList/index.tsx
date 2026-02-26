import React, { useCallback, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'

import { UsageLimitTypes } from '#/account/stripe.types'
import { useBillingPeriod } from '#/account/usage/useBillingPeriod'
import { useOrganizationsServiceUsageSummary } from '#/account/usage/useOrganizationsServiceUsageSummary'
import { ActionEnum } from '#/api/models/actionEnum'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { ResponseQualActionParams } from '#/api/models/responseQualActionParams'
import {
  getAssetsDataSupplementRetrieveQueryKey,
  useAssetsAdvancedFeaturesCreate,
  useAssetsAdvancedFeaturesPartialUpdate,
  useAssetsDataSupplementPartialUpdate,
} from '#/api/react-query/survey-data'
import { SUBSEQUENCES_SCHEMA_VERSION } from '#/components/processing/common/constants'
import type { AssetResponse } from '#/dataInterface'
import envStore from '#/envStore'
import { notify, removeDefaultUuidPrefix } from '#/utils'
import NlpUsageLimitBlockModal from '../../../components/nlpUsageLimitBlockModal'
import type { AdvancedFeatureResponseManualQual } from '../../common/utils'
import AnalysisQuestionListItem from './AnalysisQuestionListItem'
import styles from './index.module.scss'

interface Props {
  asset: AssetResponse
  advancedFeatures: AdvancedFeatureResponse[]
  questionXpath: string
  submission: DataResponse
  qaQuestion?: ResponseQualActionParams
  setQaQuestion: (qaQuestion: ResponseQualActionParams | undefined) => void
}

/**
 * Renders a list of questions (`AnalysisQuestionRow`s to be precise).
 *
 * Also handles questions reordering (configured in `AnalysisQuestionRow`).
 */
export default function AnalysisQuestionsList({
  asset,
  advancedFeatures,
  questionXpath,
  submission,
  qaQuestion,
  setQaQuestion,
}: Props) {
  // Filter to get the manual_qual advanced feature for this question
  const advancedFeatureManual = advancedFeatures.find(
    (feature) => feature.action === ActionEnum.manual_qual && feature.question_xpath === questionXpath,
  ) as AdvancedFeatureResponseManualQual | undefined

  // Filter to get the automatic_bedrock_qual advanced feature for this question
  const advancedFeatureAutomatic = advancedFeatures.find(
    (feature) => feature.action === ActionEnum.automatic_bedrock_qual && feature.question_xpath === questionXpath,
  ) as AdvancedFeatureResponseManualQual | undefined

  const rootUuid = removeDefaultUuidPrefix(submission['meta/rootUuid'])
  const queryClient = useQueryClient()

  const mutationCreateBedrockFeature = useAssetsAdvancedFeaturesCreate({
    mutation: { scope: { id: 'automatic-qual' } },
  })

  const mutationPatchBedrockFeature = useAssetsAdvancedFeaturesPartialUpdate({
    mutation: { scope: { id: 'automatic-qual' } },
  })

  const mutationGenerateWithAI = useAssetsDataSupplementPartialUpdate({
    mutation: {
      scope: { id: 'qa-generate-ai' },
      // Override default error handler to show a user-friendly message
      // instead of the raw server response (which may contain HTML).
      onError: () => {
        notify.error(t('Failed to generate AI response. Please try again later.'))
      },
    },
  })

  // Local state to avoid flickering on reordering (optimistic UI)
  const [localParams, setLocalParams] = useState<ResponseQualActionParams[]>(advancedFeatureManual?.params ?? [])

  // Update local params when advancedFeature changes (e.g., after backend update)
  React.useEffect(() => {
    setLocalParams(advancedFeatureManual?.params ?? [])
  }, [advancedFeatureManual?.params])

  const moveRow = useCallback((_uuid: string, oldIndex: number, newIndex: number) => {
    setLocalParams((prevParams) => {
      const newParams = [...prevParams]
      const [movedItem] = newParams.splice(oldIndex, 1)
      newParams.splice(newIndex, 0, movedItem)
      return newParams
    })
  }, [])

  let localAdvancedFeature: AdvancedFeatureResponseManualQual | undefined
  if (advancedFeatureManual) {
    localAdvancedFeature = {
      ...advancedFeatureManual,
      params: localParams,
    }
  }

  if (!localAdvancedFeature) {
    return null
  }

  const qaQuestions = localParams
    .filter((qaQuestion) => !qaQuestion.options?.deleted)
    // TODO: we temporarily hide Keyword Search from the UI until
    // https://github.com/kobotoolbox/kpi/issues/4594 is done
    .filter((qaQuestion) => qaQuestion.type !== 'qualAutoKeywordCount')

  const isAnyQuestionBeingEdited = !!qaQuestion

  const enableGenerateWithAIFeature = async () => {
    // Filter to get valid questions for AI generation (exclude tags and notes)
    const validQuestions = qaQuestions.filter(
      (param: ResponseQualActionParams) => param.type !== 'qualTags' && param.type !== 'qualNote',
    )

    if (!advancedFeatureAutomatic) {
      // If automatic_bedrock_qual feature doesn't exist, we need to create it with all valid questions
      await mutationCreateBedrockFeature.mutateAsync({
        uidAsset: asset.uid,
        data: {
          action: ActionEnum.automatic_bedrock_qual,
          question_xpath: questionXpath,
          params: validQuestions,
        },
      })
      return
    }

    // If automatic_bedrock_qual feature already exists,
    // we need to check if there are any valid questions that are not covered by it
    const uncoveredQuestions = validQuestions.filter(
      (param) => !advancedFeatureAutomatic?.params?.some((autoParam) => autoParam.uuid === param.uuid),
    )

    if (uncoveredQuestions.length > 0) {
      await mutationPatchBedrockFeature.mutateAsync({
        uidAsset: asset.uid,
        uidAdvancedFeature: advancedFeatureAutomatic.uid,
        data: {
          action: ActionEnum.automatic_bedrock_qual,
          question_xpath: questionXpath,
          params: uncoveredQuestions,
        },
      })
    }
  }

  const [isLimitBlockModalOpen, setIsLimitBlockModalOpen] = useState<boolean>(false)
  const { data: serviceUsageData } = useOrganizationsServiceUsageSummary()
  const { billingPeriod } = useBillingPeriod()

  const usageLimitBlock =
    serviceUsageData?.status === 200 &&
    serviceUsageData?.data.limitExceedList.includes(UsageLimitTypes.LLM_REQUEST) &&
    envStore.data.usage_limit_enforcement

  function handleDismissModal() {
    setIsLimitBlockModalOpen(false)
  }

  const handleGenerateWithAI = async (qaQuestionParam: ResponseQualActionParams) => {
    if (usageLimitBlock) {
      setIsLimitBlockModalOpen(true)
      return
    }

    // Enable the automatic_bedrock_qual feature if needed
    await enableGenerateWithAIFeature()

    // Now trigger the AI generation
    await mutationGenerateWithAI.mutateAsync({
      uidAsset: asset.uid,
      rootUuid: rootUuid,
      data: {
        _version: SUBSEQUENCES_SCHEMA_VERSION,
        [questionXpath]: {
          [ActionEnum.automatic_bedrock_qual]: {
            uuid: qaQuestionParam.uuid,
          },
        },
      },
    })

    // Invalidate the supplement data query so all AnalysisQuestionListItem
    // components refetch and display the latest AI-generated result.
    await queryClient.invalidateQueries({
      queryKey: getAssetsDataSupplementRetrieveQueryKey(asset.uid, rootUuid),
    })
  }

  return (
    <>
      <DndProvider backend={HTML5Backend}>
        <ul className={styles.root}>
          {qaQuestion && !qaQuestions.some(({ uuid }) => uuid === qaQuestion?.uuid) && (
            <AnalysisQuestionListItem
              asset={asset}
              advancedFeatureManual={localAdvancedFeature}
              submission={submission}
              qaQuestion={qaQuestion}
              setQaQuestion={setQaQuestion}
              questionXpath={questionXpath}
              index={-1}
              moveRow={moveRow}
              editMode
              isAnyQuestionBeingEdited={isAnyQuestionBeingEdited}
              onGenerateWithAI={handleGenerateWithAI}
            />
          )}
          {qaQuestions.map((qaQuestionItem, index) => (
            <AnalysisQuestionListItem
              key={qaQuestionItem.uuid}
              asset={asset}
              advancedFeatureManual={localAdvancedFeature}
              submission={submission}
              qaQuestion={qaQuestionItem}
              setQaQuestion={setQaQuestion}
              questionXpath={questionXpath}
              index={index}
              moveRow={moveRow}
              editMode={qaQuestion?.uuid === qaQuestionItem.uuid}
              isAnyQuestionBeingEdited={isAnyQuestionBeingEdited}
              onGenerateWithAI={handleGenerateWithAI}
            />
          ))}
        </ul>
      </DndProvider>
      <NlpUsageLimitBlockModal
        isModalOpen={isLimitBlockModalOpen}
        usageType={UsageLimitTypes.LLM_REQUEST}
        dismissed={handleDismissModal}
        interval={billingPeriod}
      />
    </>
  )
}
