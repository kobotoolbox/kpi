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
import type {Identifier, XYCoord} from 'dnd-core';
import {DND_TYPES} from 'js/constants';
import {findQuestion} from '../utils';
import classnames from 'classnames';

export interface AnalysisQuestionRowProps {
  uid: string;
  questiondata: any;
  index: number;
  moveRow: (uid: string, oldIndex: number, newIndex: number) => void;
}

interface DragItem {
  id: string;
  index: number;
  type: string;
}

// i think it would make sense to make AnalysisQuestionRow a pure component
// and move the logic out of the individual question into the AnalysisQuestionList
// component or elsewhere.

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

  const isDragDisabled = analysisQuestions?.state.isPending;

  const previewRef = useRef<HTMLLIElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const [{handlerId}, drop] = useDrop<
    DragItem,
    unknown,
    {handlerId: Identifier | null}
  >({
    accept: DND_TYPES.ANALYSIS_QUESTION,
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: DragItem, monitor) {
      if (!previewRef.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = props.index;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }

      // Determine rectangle on screen
      const hoverBoundingRect = previewRef.current?.getBoundingClientRect();

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
      props.moveRow(props.uid, dragIndex, hoverIndex);

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex;
    },
  });

  const [{isDragging}, drag, preview] = useDrag({
    type: DND_TYPES.ANALYSIS_QUESTION,
    item: () => {
      return {id: props.uid, index: props.index};
    },
    canDrag: !isDragDisabled,
    collect: (monitor) => {
      return {
        isDragging: monitor.isDragging(),
      };
    },
    end: (_item, monitor) => {
      // Make sure we only accept drops on target
      if (!monitor.didDrop()) {
        return;
      }

      analysisQuestions?.dispatch({type: 'applyQuestionsOrder'});

      // TODO make actual API call here
      // For now we make a fake response
      console.log('QA fake API call: update order');
      setTimeout(() => {
        console.log('QA fake API call: update order DONE');
        analysisQuestions?.dispatch({
          type: 'applyQuestionsOrderCompleted',
          payload: {
            questions: analysisQuestions?.state.questions,
          },
        });
      }, 2000);
    },
  });

  drag(dragRef);
  drop(preview(previewRef));

  const renderItem = useCallback(
    (item: AnalysisQuestion) => {
      if (analysisQuestions?.state.questionsBeingEdited.includes(item.uid)) {
        return <AnalysisQuestionEditor uid={item.uid} />;
      } else {
        switch (item.type) {
          case 'qual_auto_keyword_count': {
            return <KeywordSearchResponseForm uid={item.uid} />;
          }
          case 'qual_note': {
            // This question type doesn't have any response
            return <CommonHeader uid={item.uid} />;
          }
          case 'qual_select_multiple': {
            return <SelectMultipleResponseForm uid={item.uid} />;
          }
          case 'qual_select_one': {
            return <SelectOneResponseForm uid={item.uid} />;
          }
          case 'qual_tags': {
            return <TagsResponseForm uid={item.uid} />;
          }
          default: {
            return <DefaultResponseForm uid={item.uid} />;
          }
        }
      }
    },
    [analysisQuestions?.state.questionsBeingEdited]
  );

  return (
    <li
      className={classnames({
        [styles.root]: true,
        [styles.isBeingDragged]: isDragging,
        [styles.isDragDisabled]: isDragDisabled,
      })}
      ref={previewRef}
      data-handler-id={handlerId}
    >
      <div className={styles.dragHandle} ref={dragRef}>
        <Icon name='drag-handle' size='xs' />
      </div>

      <div className={styles.content}>{renderItem(question)}</div>
    </li>
  );
}
