import React, { useCallback } from 'react'

import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'

import type { DataResponse } from '#/api/models/dataResponse'
import type { QualActionParams } from '#/api/models/qualActionParams'
import type { AssetResponse } from '#/dataInterface'
import type { AdvancedFeatureResponseManualQual } from '../../common/utils'
import AnalysisQuestionListItem from './AnalysisQuestionListItem'
import styles from './index.module.scss'

interface Props {
  asset: AssetResponse
  advancedFeature: AdvancedFeatureResponseManualQual
  questionXpath: string
  submission: DataResponse
  qaQuestion?: QualActionParams
  setQaQuestion: (qaQuestion: QualActionParams | undefined) => void
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
  const moveRow = useCallback((uuid: string, oldIndex: number, newIndex: number) => {
    console.log(uuid, oldIndex, newIndex)
    // TODO: react query mutation.
    // analysisQuestions.dispatch({
    //   type: 'reorderQuestion',
    //   payload: { uuid: uuid, oldIndex, newIndex },
    // })
  }, [])

  console.log('AnalysisQuestionsList', qaQuestion, advancedFeature.params)

  const qaQuestions = advancedFeature.params
    .filter((qaQuestion) => !qaQuestion.options?.deleted) // We hide questions marked as deleted. TODO OpenAPI: is that a thing? DEV-1630
    // TODO: we temporarily hide Keyword Search from the UI until
    // https://github.com/kobotoolbox/kpi/issues/4594 is done
    // TODO OpenAPI: DEV-1628
    .filter((qaQuestion) => (qaQuestion.type as any) !== 'qual_auto_keyword_count')

  return (
    <DndProvider backend={HTML5Backend}>
      <ul className={styles.root}>
        {qaQuestion && !qaQuestions.some(({ uuid }) => uuid === qaQuestion?.uuid) && (
          <AnalysisQuestionListItem
            asset={asset}
            advancedFeature={advancedFeature}
            submission={submission}
            questionXpath={questionXpath}
            qaQuestion={qaQuestion}
            setQaQuestion={setQaQuestion}
            index={0}
            moveRow={moveRow}
            editMode
          />
        )}
        {qaQuestions.map((question, index: number) => (
          <AnalysisQuestionListItem
            key={question.uuid}
            asset={asset}
            advancedFeature={advancedFeature}
            submission={submission}
            questionXpath={questionXpath}
            qaQuestion={question}
            setQaQuestion={setQaQuestion}
            index={index}
            moveRow={moveRow}
            editMode={question.uuid === qaQuestion?.uuid}
          />
        ))}
      </ul>
    </DndProvider>
  )
}
