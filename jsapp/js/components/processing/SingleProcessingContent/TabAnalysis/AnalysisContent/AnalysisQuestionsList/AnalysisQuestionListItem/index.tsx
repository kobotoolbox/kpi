import React, { useCallback, useRef, useState } from 'react'

import classnames from 'classnames'
import type { Identifier, XYCoord } from 'dnd-core'
import { useDrag, useDrop } from 'react-dnd'
import type { _DataSupplementResponseOneOfManualQualVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualQualVersionsItem'
import { ActionEnum } from '#/api/models/actionEnum'
import type { DataResponse } from '#/api/models/dataResponse'
import type { PatchedDataSupplementPayloadOneOfManualQual } from '#/api/models/patchedDataSupplementPayloadOneOfManualQual'
import type { ResponseQualActionParams } from '#/api/models/responseQualActionParams'
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
import { DND_TYPES } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import { removeDefaultUuidPrefix } from '#/utils'
import type { AdvancedFeatureResponseManualQual } from '../../../common/utils'
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
  advancedFeature: AdvancedFeatureResponseManualQual
  questionXpath: string
  qaQuestion: ResponseQualActionParams
  setQaQuestion: (qualQuestion: ResponseQualActionParams | undefined) => void
  submission: DataResponse
  index: number
  moveRow: (uuid: string, oldIndex: number, newIndex: number) => void
  editMode: boolean
  isAnyQuestionBeingEdited: boolean
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
  advancedFeature,
  questionXpath,
  qaQuestion,
  setQaQuestion,
  submission,
  index,
  moveRow,
  editMode,
  isAnyQuestionBeingEdited,
}: Props) {
  const rootUuid = removeDefaultUuidPrefix(submission['meta/rootUuid'])

  const queryAnswer = useAssetsDataSupplementRetrieve(asset.uid, rootUuid, {
    query: {
      staleTime: Number.POSITIVE_INFINITY,
      queryKey: getAssetsDataSupplementRetrieveQueryKey(asset.uid, rootUuid),
      select: useCallback(
        (
          data: assetsDataSupplementRetrieveResponse,
        ): _DataSupplementResponseOneOfManualQualVersionsItem | undefined => {
          if (data.status !== 200) return // typeguard, should never happen
          return data.data[questionXpath].manual_qual?.[qaQuestion.uuid]?._versions[0]
        },
        [questionXpath, qaQuestion.uuid],
      ),
    },
  })

  // Local state for optimistic UI of SelectOne radio button value
  // this is needed so that the "clear" button works immediately without waiting for server response
  const [localRadioValue, setLocalRadioValue] = useState<string | undefined>()

  const mutationSaveAnswer = useAssetsDataSupplementPartialUpdate()
  const mutationCreateQuestion = useAssetsAdvancedFeaturesCreate()
  const mutationPatchQuestion = useAssetsAdvancedFeaturesPartialUpdate()

  const handleSaveAnswer = async (value: PatchedDataSupplementPayloadOneOfManualQual['value']) => {
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

  const isCreate = advancedFeature.uid === LOCALLY_EDITED_PLACEHOLDER_UUID

  const handleSaveQuestion = (params: ResponseQualActionParams[]) => {
    if (isCreate) {
      return mutationCreateQuestion.mutateAsync({
        uidAsset: asset.uid,
        data: {
          action: ActionEnum.manual_qual,
          question_xpath: advancedFeature.question_xpath,
          params: params,
        },
      })
    } else {
      return mutationPatchQuestion.mutateAsync({
        uidAsset: asset.uid,
        uidAdvancedFeature: advancedFeature.uid,
        data: {
          params: params,
        },
      })
    }
  }

  const handleCancelEdit = () => {
    setQaQuestion(undefined)
  }

  const handleDeleteQuestion = (qaQuestionToDelete: ResponseQualActionParams) => {
    // Mark the question as deleted by setting options.deleted to true
    const updatedParams = advancedFeature.params.map((param) =>
      param.uuid === qaQuestionToDelete.uuid ? { ...param, options: { ...param.options, deleted: true } } : param,
    )

    return mutationPatchQuestion.mutateAsync({
      uidAsset: asset.uid,
      uidAdvancedFeature: advancedFeature.uid,
      data: {
        params: updatedParams,
      },
    })
  }

  const handleReorderQuestions = (reorderedParams: ResponseQualActionParams[]) => {
    return mutationPatchQuestion.mutateAsync({
      uidAsset: asset.uid,
      uidAdvancedFeature: advancedFeature.uid,
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
      await handleReorderQuestions(advancedFeature.params)
    },
  })

  drag(dragRef)
  drop(preview(previewRef))

  const renderItem = () => {
    // TODO: after creating question successfuly, we should close the editor
    if (editMode) {
      return (
        <AnalysisQuestionEditor
          advancedFeature={advancedFeature}
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
          localRadioValue !== undefined ? localRadioValue : (queryAnswer.data?._data?.value as string)
        const hasValue = !!currentValue

        const handleClearSelection = hasValue
          ? async () => {
              setLocalRadioValue('')
              await handleSaveAnswer('')
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
