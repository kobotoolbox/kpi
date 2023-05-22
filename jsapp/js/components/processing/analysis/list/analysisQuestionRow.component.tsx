import React, {useCallback, useContext, useRef} from 'react';
import AnalysisQuestionsContext from '../analysisQuestions.context';
import AnalysisQuestionEditor from '../editors/analysisQuestionEditor.component';
import DefaultResponseForm from '../responseForms/defaultResponseForm.component';
import KeywordSearchResponseForm from '../responseForms/keywordSearchResponseForm.component';
import SelectMultipleResponseForm from '../responseForms/selectMultipleResponseForm.component';
import SelectOneResponseForm from '../responseForms/selectOneResponseForm.component';
import TagsResponseForm from '../responseForms/tagsResponseForm.component';
import CommonHeader from '../responseForms/commonHeader.component';
import styles from './analysisQuestionRow.module.scss';
import type {AnalysisQuestion} from '../constants';
import Icon from 'js/components/common/icon';
import {useDrag, useDrop} from 'react-dnd';
import type { Identifier, XYCoord } from 'dnd-core'
import {DND_TYPES} from 'js/constants';
import { findQuestion } from '../utils';
import classnames from 'classnames';

export interface AnalysisQuestionRowProps {
  uid: string;
  index: number;
  moveRow: (dragIndex: number, hoverIndex: number) => void;
}

interface DragItem {
  id: string
  index: number
  type: string
}

export default function AnalysisQuestionRow(props: AnalysisQuestionRowProps) {
  const analysisQuestions = useContext(AnalysisQuestionsContext);

  if (!analysisQuestions) {
    return null;
  }

  // Get the question data from state (with safety check)
  const question = findQuestion(props.uid, analysisQuestions?.state);
  if (!question) {
    return null;
  }

  const rowRef = useRef<HTMLLIElement>(null);

  const [{handlerId}, drop] = useDrop<
    DragItem,
    void,
    {handlerId: Identifier | null}
  >({
    accept: DND_TYPES.ANALYSIS_QUESTION,
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: DragItem, monitor) {
      if (!rowRef.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = props.index;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }

      // Determine rectangle on screen
      const hoverBoundingRect = rowRef.current?.getBoundingClientRect();

      // Get vertical middle
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

      // Determine mouse position
      const clientOffset = monitor.getClientOffset();

      // Get pixels to the top
      const hoverClientY = (clientOffset as XYCoord).y - hoverBoundingRect.top;

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }

      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      // Time to actually perform the action
      props.moveRow(dragIndex, hoverIndex);

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex;
    },
  });

  const [{isDragging}, drag] = useDrag({
    type: DND_TYPES.ANALYSIS_QUESTION,
    item: () => {
      return {id: props.uid, index: props.index};
    },
    collect: (monitor: any) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(drop(rowRef));

  const renderItem = useCallback(
    (question: AnalysisQuestion) => {
      if (analysisQuestions?.state.questionsBeingEdited.includes(question.uid)) {
        return <AnalysisQuestionEditor uid={question.uid} />;
      } else {
        switch (question.type) {
          case 'qual_auto_keyword_count': {
            return <KeywordSearchResponseForm uid={question.uid} />;
          }
          case 'qual_note': {
            // This question type doesn't have any response
            return <CommonHeader uid={question.uid} />;
          }
          case 'qual_select_multiple': {
            return <SelectMultipleResponseForm uid={question.uid} />;
          }
          case 'qual_select_one': {
            return <SelectOneResponseForm uid={question.uid} />;
          }
          case 'qual_tags': {
            return <TagsResponseForm uid={question.uid} />;
          }
          default: {
            return <DefaultResponseForm uid={question.uid} />;
          }
        }
      }
    },
    [],
  );

  return (
    <li
      className={classnames({
        [styles.root]: true,
        [styles.isBeingDragged]: isDragging,
      })}
      ref={rowRef}
      data-handler-id={handlerId}
    >
      <div className={styles.dragHandle}>
        <Icon name='drag-handle' size='xs' />
      </div>

      <div className={styles.content}>{renderItem(question)}</div>
    </li>
  );
}
