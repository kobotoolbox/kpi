import React, { useRef } from 'react'

import classnames from 'classnames'
import type { Identifier, XYCoord } from 'dnd-core'
import { useDrag, useDrop } from 'react-dnd'
import type { DataResponse } from '#/api/models/dataResponse'
import type { PatchedDataSupplementPayloadOneOfQual } from '#/api/models/patchedDataSupplementPayloadOneOfQual'
import type { QualActionParams } from '#/api/models/qualActionParams'
import type { QualSelectQuestionParams } from '#/api/models/qualSelectQuestionParams'
import Icon from '#/components/common/icon'
import InlineMessage from '#/components/common/inlineMessage'
import { userCan } from '#/components/permissions/utils'
import { DND_TYPES } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
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
import {
  useAssetsDataSupplementDeleteQaHelper,
  useAssetsDataSupplementPartialUpdateQaHelper,
  useAssetsDataSupplementReorderQaHelper,
  useAssetsDataSupplementRetrieveQaHelper,
  useAssetsDataSupplementUpsertQaHelper,
} from './utils'

export interface Props {
  asset: AssetResponse
  advancedFeature: AdvancedFeatureResponseManualQual
  questionXpath: string
  qaQuestion: QualActionParams
  setQaQuestion: (qualQuestion: QualActionParams | undefined) => void
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
  const queryAnswer = useAssetsDataSupplementRetrieveQaHelper(asset, questionXpath, submission, qaQuestion)
  const [mutationAnswer, onSaveAnswer] = useAssetsDataSupplementPartialUpdateQaHelper(
    asset,
    questionXpath,
    submission,
    qaQuestion,
  )
  const handleSaveAnswer = async (value: PatchedDataSupplementPayloadOneOfQual['value']) => {
    await onSaveAnswer(value)
  }

  const [mutationQuestion, onSaveQuestion] = useAssetsDataSupplementUpsertQaHelper(asset, advancedFeature)
  const handleSaveQuestion = async (params: QualActionParams[]) => {
    await onSaveQuestion(params)
    setQaQuestion(undefined)
  }
  const handleCancelEdit = () => {
    setQaQuestion(undefined)
  }

  const [mutationDelete, onDeleteQuestion] = useAssetsDataSupplementDeleteQaHelper(asset, advancedFeature)
  const handleDeleteQuestion = async (qaQuestionToDelete: QualActionParams) => {
    await onDeleteQuestion(qaQuestionToDelete)
  }

  const [mutationReorder, onReorderQuestions] = useAssetsDataSupplementReorderQaHelper(asset, advancedFeature)
  const handleReorderQuestions = async (reorderedParams: QualActionParams[]) => {
    await onReorderQuestions(reorderedParams)
  }

  const disabledAnswer =
    !userCan('change_submissions', asset) ||
    queryAnswer.isFetching ||
    mutationAnswer.isPending ||
    mutationQuestion.isPending ||
    mutationDelete.isPending ||
    mutationReorder.isPending

  const disabledQuestion =
    !userCan('manage_asset', asset) ||
    queryAnswer.isFetching ||
    mutationAnswer.isPending ||
    mutationQuestion.isPending ||
    mutationDelete.isPending ||
    mutationReorder.isPending

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
    if (editMode) {
      return (
        <AnalysisQuestionEditor
          advancedFeature={advancedFeature}
          qaQuestion={qaQuestion as QualSelectQuestionParams}
          onSaveQuestion={handleSaveQuestion}
          disabled={disabledAnswer}
          onCancel={handleCancelEdit}
        />
      )
    }

    switch (qaQuestion.type) {
      case 'qual_auto_keyword_count' as any: {
        // TODO OpenAPI: DEV-1628
        return <KeywordSearchResponseForm />
      }
      case 'qualNote': {
        // This question type doesn't have any response, so we display just
        // the header
        return (
          <ResponseForm
            qaQuestion={qaQuestion}
            disabled={disabledQuestion} // TODO: or disabledAnswer?
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
              qaQuestion={qaQuestion as QualSelectQuestionParams}
              qaAnswer={queryAnswer.data}
              disabled={disabledAnswer}
              onSave={handleSaveAnswer}
            />
          </ResponseForm>
        )
      }
      case 'qualSelectOne': {
        return (
          <ResponseForm
            qaQuestion={qaQuestion}
            disabled={disabledQuestion}
            onEdit={setQaQuestion}
            onDelete={handleDeleteQuestion}
          >
            <SelectOneResponseForm
              qaQuestion={qaQuestion as QualSelectQuestionParams}
              qaAnswer={queryAnswer.data}
              disabled={disabledAnswer}
              onSave={handleSaveAnswer}
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
