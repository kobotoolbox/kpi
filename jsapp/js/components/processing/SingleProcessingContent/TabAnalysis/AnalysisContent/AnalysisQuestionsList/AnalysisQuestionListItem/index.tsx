import React, { useCallback, useEffect, useRef, useState } from 'react'

import classnames from 'classnames'
import type { Identifier, XYCoord } from 'dnd-core'
import { useDrag, useDrop } from 'react-dnd'
import { ActionEnum } from '#/api/models/actionEnum'
import type { DataResponse } from '#/api/models/dataResponse'
import type { ResponseManualQualActionParams } from '#/api/models/responseManualQualActionParams'
import {
  type assetsDataSupplementRetrieveResponse,
  getAssetsDataSupplementRetrieveQueryKey,
  useAssetsAdvancedFeaturesCreate,
  useAssetsAdvancedFeaturesPartialUpdate,
  useAssetsDataSupplementPartialUpdate,
  useAssetsDataSupplementRetrieve,
} from '#/api/react-query/survey-data'
import Icon from '#/components/common/icon'
import InlineMessage from '#/components/common/inlineMessage'
import { userCan } from '#/components/permissions/utils'
import { LOCALLY_EDITED_PLACEHOLDER_UUID, SUBSEQUENCES_SCHEMA_VERSION } from '#/components/processing/common/constants'
import type { QualVersionItem } from '#/components/processing/common/types'
import type { ManualQualValue } from '#/components/processing/common/types'
import { getLatestQualVersionItem } from '#/components/processing/common/utils'
import { DND_TYPES } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import { removeDefaultUuidPrefix } from '#/utils'
import {
  type AdvancedFeatureResponseManualQual,
  getEmptyAnswer,
  hasNonEmptyAnswer,
  isAnswerAIGenerated,
} from '../../../common/utils'
import AnalysisQuestionEditor from './AnalysisQuestionEditor'
import IntegerResponseForm from './IntegerResponseForm'
import KeywordSearchResponseForm from './KeywordSearchResponseForm'
import SelectMultipleResponseForm from './MultipleResponseForm'
import ResponseForm from './ResponseForm'
import SelectOneResponseForm from './SelectOneResponseForm'
import TagsResponseForm from './TagsResponseForm'
import TextResponseForm from './TextResponseForm'
import styles from './index.module.scss'

export interface Props {
  asset: AssetResponse
  advancedFeatureManual: AdvancedFeatureResponseManualQual
  questionXpath: string
  qaQuestion: ResponseManualQualActionParams
  setQaQuestion: (qualQuestion: ResponseManualQualActionParams | undefined) => void
  submission: DataResponse
  index: number
  moveRow: (uuid: string, oldIndex: number, newIndex: number) => void
  editMode: boolean
  isAnyQuestionBeingEdited: boolean
  onGenerateWithAI: (qaQuestion: ResponseManualQualActionParams) => Promise<void>
}

interface DragItem {
  id: string
  index: number
  type: string
}

/**
 * For given question, it displays either a question definition editor, or
 * a response form.
 *
 * Also configures questions reordering.
 */
export default function AnalysisQuestionListItem({
  asset,
  advancedFeatureManual,
  questionXpath,
  qaQuestion,
  setQaQuestion,
  submission,
  index,
  moveRow,
  editMode,
  isAnyQuestionBeingEdited,
  onGenerateWithAI,
}: Props) {
  const rootUuid = removeDefaultUuidPrefix(submission['meta/rootUuid'])

  const queryAnswer = useAssetsDataSupplementRetrieve(asset.uid, rootUuid, {
    query: {
      staleTime: Number.POSITIVE_INFINITY,
      queryKey: getAssetsDataSupplementRetrieveQueryKey(asset.uid, rootUuid),
      select: useCallback(
        (data: assetsDataSupplementRetrieveResponse): QualVersionItem | undefined => {
          if (data.status !== 200) return // typeguard, should never happen
          return getLatestQualVersionItem(data.data, questionXpath, qaQuestion.uuid)
        },
        [questionXpath, qaQuestion.uuid],
      ),
    },
  })

  // Local state for optimistic UI of SelectOne radio button value
  // this is needed so that the "clear" button works immediately without waiting for server response
  const [localRadioValue, setLocalRadioValue] = useState<string | undefined>()

  // Reset local radio override when a new version arrives (e.g. after AI generation)
  useEffect(() => {
    setLocalRadioValue(undefined)
  }, [queryAnswer.data?._uuid])

  const mutationSaveAnswer = useAssetsDataSupplementPartialUpdate({ mutation: { scope: { id: 'qa-answer' } } })
  const mutationCreateQuestion = useAssetsAdvancedFeaturesCreate({ mutation: { scope: { id: 'qa-question' } } })
  const mutationPatchQuestion = useAssetsAdvancedFeaturesPartialUpdate({ mutation: { scope: { id: 'qa-question' } } })

  const handleSaveAnswer = async (value: ManualQualValue) => {
    await mutationSaveAnswer.mutateAsync({
      uidAsset: asset.uid,
      rootUuid: rootUuid,
      data: {
        _version: SUBSEQUENCES_SCHEMA_VERSION,
        [questionXpath]: {
          [ActionEnum.manual_qual]: {
            uuid: qaQuestion.uuid,
            value,
          },
        },
      },
    })
  }

  const isCreate = advancedFeatureManual.uid === LOCALLY_EDITED_PLACEHOLDER_UUID

  const handleSaveQuestion = async (params: ResponseManualQualActionParams[]) => {
    if (isCreate) {
      await mutationCreateQuestion.mutateAsync({
        uidAsset: asset.uid,
        data: {
          action: ActionEnum.manual_qual,
          question_xpath: advancedFeatureManual.question_xpath,
          params: params,
        },
      })
    } else {
      await mutationPatchQuestion.mutateAsync({
        uidAsset: asset.uid,
        uidAdvancedFeature: advancedFeatureManual.uid,
        data: {
          params: params,
        },
      })
    }
    setQaQuestion(undefined)
  }

  const handleCancelEdit = () => {
    setQaQuestion(undefined)
  }

  const handleDeleteQuestion = async (qaQuestionToDelete: ResponseManualQualActionParams) => {
    // Mark the question as deleted by setting options.deleted to true
    const updatedParams = advancedFeatureManual.params.map((param: ResponseManualQualActionParams) =>
      param.uuid === qaQuestionToDelete.uuid ? { ...param, options: { ...param.options, deleted: true } } : param,
    )

    await mutationPatchQuestion.mutateAsync({
      uidAsset: asset.uid,
      uidAdvancedFeature: advancedFeatureManual.uid,
      data: {
        params: updatedParams,
      },
    })
    setQaQuestion(undefined)
  }

  const handleReorderQuestions = (reorderedParams: ResponseManualQualActionParams[]) => {
    return mutationPatchQuestion.mutateAsync({
      uidAsset: asset.uid,
      uidAdvancedFeature: advancedFeatureManual.uid,
      data: {
        params: reorderedParams,
      },
    })
  }

  const disabledAnswer =
    !userCan('change_submissions', asset) || mutationCreateQuestion.isPending || mutationPatchQuestion.isPending
  const disabledQuestion =
    !userCan('manage_asset', asset) || mutationCreateQuestion.isPending || mutationPatchQuestion.isPending

  const previewRef = useRef<HTMLLIElement>(null)
  const dragRef = useRef<HTMLDivElement>(null)

  const [{ handlerId }, drop] = useDrop<DragItem, unknown, { handlerId: Identifier | null }>({
    accept: DND_TYPES.ANALYSIS_QUESTION,
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      }
    },
    hover(item: DragItem, monitor) {
      if (!previewRef.current) {
        return
      }
      const dragIndex = item.index
      const hoverIndex = index

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return
      }

      // Determine rectangle on screen
      const hoverBoundingRect = previewRef.current?.getBoundingClientRect()

      // Get vertical middle
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2

      // Determine mouse position
      const clientOffset = monitor.getClientOffset()

      // Get pixels to the top
      const hoverClientY = (clientOffset as XYCoord).y - hoverBoundingRect.top

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return
      }

      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return
      }

      // Time to actually perform the action
      moveRow(qaQuestion.uuid, dragIndex, hoverIndex)

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex
    },
  })

  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_TYPES.ANALYSIS_QUESTION,
    item: () => {
      return { id: qaQuestion.uuid, index: index }
    },
    // Reordering analysis questions requires `manage_asset` permission.
    // Also disable dragging when any question is being edited or created.
    canDrag: !disabledQuestion && !isAnyQuestionBeingEdited,
    collect: (monitor) => {
      return {
        isDragging: monitor.isDragging(),
      }
    },
    end: async (_item, monitor) => {
      // Make sure we only accept drops on target
      if (!monitor.didDrop()) {
        return
      }

      // Save the reordered questions to the backend
      // The moveRow callback has already updated the visual order in the parent component
      // Here we persist that change to the backend using the current params order
      await handleReorderQuestions(advancedFeatureManual.params)
    },
  })

  drag(dragRef)
  drop(preview(previewRef))

  const renderItem = () => {
    // TODO: after creating question successfuly, we should close the editor
    if (editMode) {
      return (
        <AnalysisQuestionEditor
          advancedFeature={advancedFeatureManual}
          qaQuestion={qaQuestion}
          onSaveQuestion={handleSaveQuestion}
          disabled={disabledAnswer}
          onCancel={handleCancelEdit}
        />
      )
    }

    switch (qaQuestion.type) {
      case 'qualAutoKeywordCount': {
        return <KeywordSearchResponseForm />
      }
      case 'qualNote': {
        // This question type doesn't have any response, so we display just
        // the header
        return (
          <ResponseForm
            qaQuestion={qaQuestion}
            disabled={disabledQuestion}
            onEdit={setQaQuestion}
            onDelete={handleDeleteQuestion}
            hasResponse
          />
        )
      }
      case 'qualSelectMultiple': {
        return (
          <ResponseForm
            qaQuestion={qaQuestion}
            disabled={disabledQuestion}
            onEdit={setQaQuestion}
            onDelete={handleDeleteQuestion}
            onClear={() => handleSaveAnswer(getEmptyAnswer(qaQuestion.type))}
            onGenerateWithAI={() => onGenerateWithAI(qaQuestion)}
            isGeneratedWithAI={isAnswerAIGenerated(queryAnswer.data)}
            hasResponse={hasNonEmptyAnswer(qaQuestion.type, queryAnswer.data)}
          >
            <SelectMultipleResponseForm
              qaQuestion={qaQuestion}
              qaAnswer={queryAnswer.data}
              disabled={disabledAnswer}
              onSave={handleSaveAnswer}
            />
          </ResponseForm>
        )
      }
      case 'qualSelectOne': {
        // Use local state if available, otherwise fall back to server data
        const currentValue =
          localRadioValue !== undefined ? localRadioValue : ((queryAnswer.data?._data as any)?.value as string)
        const hasValue = !!currentValue

        // select one requires a custom clear function
        const handleClearSelection = hasValue
          ? async () => {
              setLocalRadioValue(getEmptyAnswer(qaQuestion.type) as string)
              await handleSaveAnswer(getEmptyAnswer(qaQuestion.type))
            }
          : undefined

        const handleRadioSave = async (value: string) => {
          setLocalRadioValue(value)
          await handleSaveAnswer(value)
        }

        return (
          <ResponseForm
            qaQuestion={qaQuestion}
            disabled={disabledQuestion}
            onEdit={setQaQuestion}
            onDelete={handleDeleteQuestion}
            onClear={handleClearSelection}
            onGenerateWithAI={() => onGenerateWithAI(qaQuestion)}
            isGeneratedWithAI={isAnswerAIGenerated(queryAnswer.data)}
            hasResponse={hasNonEmptyAnswer(qaQuestion.type, queryAnswer.data)}
          >
            <SelectOneResponseForm
              qaQuestion={qaQuestion}
              disabled={disabledAnswer}
              onSave={handleRadioSave}
              value={currentValue}
            />
          </ResponseForm>
        )
      }
      case 'qualTags': {
        return (
          <ResponseForm
            qaQuestion={qaQuestion}
            disabled={disabledQuestion}
            onEdit={setQaQuestion}
            onDelete={handleDeleteQuestion}
            onClear={() => handleSaveAnswer(getEmptyAnswer(qaQuestion.type))}
            hasResponse={hasNonEmptyAnswer(qaQuestion.type, queryAnswer.data)}
          >
            <TagsResponseForm qaAnswer={queryAnswer.data} disabled={disabledAnswer} onSave={handleSaveAnswer} />
          </ResponseForm>
        )
      }
      case 'qualInteger': {
        return (
          <ResponseForm
            qaQuestion={qaQuestion}
            disabled={disabledQuestion}
            onEdit={setQaQuestion}
            onDelete={handleDeleteQuestion}
            onClear={() => handleSaveAnswer(getEmptyAnswer(qaQuestion.type))}
            onGenerateWithAI={() => onGenerateWithAI(qaQuestion)}
            isGeneratedWithAI={isAnswerAIGenerated(queryAnswer.data)}
            hasResponse={hasNonEmptyAnswer(qaQuestion.type, queryAnswer.data)}
          >
            <IntegerResponseForm qaAnswer={queryAnswer.data} disabled={disabledAnswer} onSave={handleSaveAnswer} />
          </ResponseForm>
        )
      }
      case 'qualText': {
        return (
          <ResponseForm
            qaQuestion={qaQuestion}
            disabled={disabledQuestion}
            onEdit={setQaQuestion}
            onDelete={handleDeleteQuestion}
            onClear={() => handleSaveAnswer(getEmptyAnswer(qaQuestion.type))}
            onGenerateWithAI={() => onGenerateWithAI(qaQuestion)}
            isGeneratedWithAI={isAnswerAIGenerated(queryAnswer.data)}
            hasResponse={hasNonEmptyAnswer(qaQuestion.type, queryAnswer.data)}
          >
            <TextResponseForm qaAnswer={queryAnswer.data} disabled={disabledAnswer} onSave={handleSaveAnswer} />
          </ResponseForm>
        )
      }
      default: {
        return (
          <InlineMessage
            icon='alert'
            type='warning'
            message={t('Unknown question type ##type_name##').replace('##type_name##', qaQuestion['type'])}
          />
        )
      }
    }
  }

  return (
    <li
      className={classnames({
        [styles.root]: true,
        [styles.isBeingDragged]: isDragging,
        [styles.isDragDisabled]: disabledQuestion,
      })}
      ref={previewRef}
      data-handler-id={handlerId}
    >
      <div
        className={classnames({
          [styles.dragHandle]: true,
          [styles.dragHandleDisabled]: isAnyQuestionBeingEdited,
        })}
        ref={dragRef}
      >
        <Icon name='drag-handle' size='xs' />
      </div>

      <div className={styles.content}>{renderItem()}</div>
    </li>
  )
}
