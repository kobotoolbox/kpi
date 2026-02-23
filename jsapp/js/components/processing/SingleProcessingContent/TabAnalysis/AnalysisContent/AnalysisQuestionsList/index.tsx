import React, { useCallback, useState } from 'react'

import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'

import type { DataResponse } from '#/api/models/dataResponse'
import type { ResponseManualQualActionParams } from '#/api/models/responseManualQualActionParams'
import type { AssetResponse } from '#/dataInterface'
import type { AdvancedFeatureResponseManualQual } from '../../common/utils'
import AnalysisQuestionListItem from './AnalysisQuestionListItem'
import styles from './index.module.scss'

interface Props {
  asset: AssetResponse
  advancedFeature: AdvancedFeatureResponseManualQual
  questionXpath: string
  submission: DataResponse
  qaQuestion?: ResponseManualQualActionParams
  setQaQuestion: (qaQuestion: ResponseManualQualActionParams | undefined) => void
}

/**
 * Renders a list of questions (`AnalysisQuestionRow`s to be precise).
 *
 * Also handles questions reordering (configured in `AnalysisQuestionRow`).
 */
export default function AnalysisQuestionsList({
  asset,
  advancedFeature,
  questionXpath,
  submission,
  qaQuestion,
  setQaQuestion,
}: Props) {
  // Local state to avoid flickering on reordering (optimistic UI)
  const [localParams, setLocalParams] = useState<ResponseManualQualActionParams[]>(advancedFeature.params)

  // Update local params when advancedFeature changes (e.g., after backend update)
  React.useEffect(() => {
    setLocalParams(advancedFeature.params)
  }, [advancedFeature.params])

  const moveRow = useCallback((_uuid: string, oldIndex: number, newIndex: number) => {
    setLocalParams((prevParams) => {
      const newParams = [...prevParams]
      const [movedItem] = newParams.splice(oldIndex, 1)
      newParams.splice(newIndex, 0, movedItem)
      return newParams
    })
  }, [])

  const localAdvancedFeature: AdvancedFeatureResponseManualQual = {
    ...advancedFeature,
    params: localParams,
  }

  const qaQuestions = localParams
    .filter((qaQuestion) => !qaQuestion.options?.deleted)
    // TODO: we temporarily hide Keyword Search from the UI until
    // https://github.com/kobotoolbox/kpi/issues/4594 is done
    .filter((qaQuestion) => qaQuestion.type !== 'qualAutoKeywordCount')

  const isAnyQuestionBeingEdited = !!qaQuestion

  return (
    <DndProvider backend={HTML5Backend}>
      <ul className={styles.root}>
        {qaQuestion && !qaQuestions.some(({ uuid }) => uuid === qaQuestion?.uuid) && (
          <AnalysisQuestionListItem
            asset={asset}
            advancedFeature={localAdvancedFeature}
            submission={submission}
            qaQuestion={qaQuestion}
            setQaQuestion={setQaQuestion}
            questionXpath={questionXpath}
            index={-1}
            moveRow={moveRow}
            editMode
            isAnyQuestionBeingEdited={isAnyQuestionBeingEdited}
          />
        )}
        {qaQuestions.map((qaQuestionItem, index) => {
          return (
            <AnalysisQuestionListItem
              key={qaQuestionItem.uuid}
              asset={asset}
              advancedFeature={localAdvancedFeature}
              submission={submission}
              qaQuestion={qaQuestionItem}
              setQaQuestion={setQaQuestion}
              questionXpath={questionXpath}
              index={index}
              moveRow={moveRow}
              editMode={qaQuestion?.uuid === qaQuestionItem.uuid}
              isAnyQuestionBeingEdited={isAnyQuestionBeingEdited}
            />
          )
        })}
      </ul>
    </DndProvider>
  )
}
