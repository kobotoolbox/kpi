import React, { useCallback, useContext } from 'react'

import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'

import type { DataResponse } from '#/api/models/dataResponse'
import type { AssetResponse } from '#/dataInterface'
import AnalysisQuestionsContext from '../../common/analysisQuestions.context'
import AnalysisQuestionListItem from './AnalysisQuestionListItem'
import styles from './index.module.scss'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse & Record<string, string>
}

/**
 * Renders a list of questions (`AnalysisQuestionRow`s to be precise).
 *
 * Also handles questions reordering (configured in `AnalysisQuestionRow`).
 */
export default function AnalysisQuestionsList({ asset, questionXpath, submission }: Props) {
  const analysisQuestions = useContext(AnalysisQuestionsContext)
  if (!analysisQuestions) {
    return null
  }

  const moveRow = useCallback((uuid: string, oldIndex: number, newIndex: number) => {
    analysisQuestions.dispatch({
      type: 'reorderQuestion',
      payload: { uuid: uuid, oldIndex, newIndex },
    })
  }, [])

  return (
    <DndProvider backend={HTML5Backend}>
      <ul className={styles.root}>
        {analysisQuestions.state.questions.map((question, index: number) => {
          // We hide analysis questions for other survey questions. We need to
          // hide them at this point (not filtering the whole list beforehand),
          // because we need the indexes to match the whole list. And FYI all
          // analysis questions live on a single list :)
          if (question.xpath !== questionXpath) {
            return null
          }

          // TODO: we temporarily hide Keyword Search from the UI until
          // https://github.com/kobotoolbox/kpi/issues/4594 is done
          if (question.type === 'qual_auto_keyword_count') {
            return null
          }

          // We hide questions marked as deleted
          if (question.options?.deleted) {
            return null
          }

          return (
            <AnalysisQuestionListItem
              asset={asset}
              submission={submission}
              uuid={question.uuid}
              index={index}
              key={question.uuid}
              moveRow={moveRow}
            />
          )
        })}
      </ul>
    </DndProvider>
  )
}
