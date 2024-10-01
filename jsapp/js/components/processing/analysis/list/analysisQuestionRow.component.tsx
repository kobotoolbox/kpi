import React, {useCallback, useContext, useRef} from 'react';
import AnalysisQuestionsContext from '../analysisQuestions.context';
import AnalysisQuestionEditor from '../editors/analysisQuestionEditor.component';
import TextResponseForm from '../responseForms/textResponseForm.component';
import KeywordSearchResponseForm from '../responseForms/keywordSearchResponseForm.component';
import SelectMultipleResponseForm from '../responseForms/selectMultipleResponseForm.component';
import SelectOneResponseForm from '../responseForms/selectOneResponseForm.component';
import TagsResponseForm from '../responseForms/tagsResponseForm.component';
import IntegerResponseForm from '../responseForms/integerResponseForm.component';
import CommonHeader from '../responseForms/commonHeader.component';
import styles from './analysisQuestionRow.module.scss';
import type {AnalysisQuestionBase} from '../constants';
import Icon from 'js/components/common/icon';
import InlineMessage from 'js/components/common/inlineMessage';
import {useDrag, useDrop} from 'react-dnd';
import type {Identifier, XYCoord} from 'dnd-core';
import {DND_TYPES} from 'js/constants';
import {
  findQuestion,
  getQuestionsFromSchema,
  updateSurveyQuestions,
  hasManagePermissionsToCurrentAsset,
} from '../utils';
import classnames from 'classnames';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import {handleApiFail} from 'js/api';
import type {FailResponse} from 'js/dataInterface';
import assetStore from 'js/assetStore';
import {userCan} from 'js/components/permissions/utils';

export interface AnalysisQuestionRowProps {
  uuid: string;
  index: number;
  moveRow: (uuid: string, oldIndex: number, newIndex: number) => void;
}

interface DragItem {
  id: string;
  index: number;
  type: string;
}

/**
 * For given question, it displays either a question definition editor, or
 * a response form.
 *
 * Also configures questions reordering.
 */
export default function AnalysisQuestionRow(props: AnalysisQuestionRowProps) {
  const analysisQuestions = useContext(AnalysisQuestionsContext);
  if (!analysisQuestions) {
    return null;
  }

  // Get the question data from state (with safety check)
  const question = findQuestion(props.uuid, analysisQuestions.state);
  if (!question) {
    return null;
  }

  // Responding to analysis question requires `edit_submissions` permission.
  const hasEditSubmissionsPermissions = (() => {
    const asset = assetStore.getAsset(singleProcessingStore.currentAssetUid);
    return userCan('change_submissions', asset);
  })();

  // Reordering analysis questions requires `manage_asset` permission.
  const isDragDisabled =
    analysisQuestions.state.isPending || !hasManagePermissionsToCurrentAsset();

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
      props.moveRow(props.uuid, dragIndex, hoverIndex);

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
      return {id: props.uuid, index: props.index};
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

      async function makeCall() {
        if (!analysisQuestions) {
          return;
        }

        // Step 1: Let the reducer know what we're about to do
        analysisQuestions.dispatch({type: 'applyQuestionsOrder'});

        // Step 2: update asset endpoint with new questions
        try {
          const response = await updateSurveyQuestions(
            singleProcessingStore.currentAssetUid,
            analysisQuestions.state.questions
          );

          // Step 3: update reducer's state with new list after the call finishes
          analysisQuestions?.dispatch({
            type: 'applyQuestionsOrderCompleted',
            payload: {
              questions: getQuestionsFromSchema(response?.advanced_features),
            },
          });
        } catch (err) {
          handleApiFail(err as FailResponse);
          analysisQuestions?.dispatch({type: 'applyQuestionsOrderFailed'});
        }
      }
      makeCall();
    },
  });

  drag(dragRef);
  drop(preview(previewRef));

  const renderItem = useCallback(
    (item: AnalysisQuestionBase) => {
      if (analysisQuestions.state.questionsBeingEdited.includes(item.uuid)) {
        return <AnalysisQuestionEditor uuid={item.uuid} />;
      } else {
        switch (item.type) {
          case 'qual_auto_keyword_count': {
            return <KeywordSearchResponseForm uuid={item.uuid} />;
          }
          case 'qual_note': {
            // This question type doesn't have any response, so we display just
            // the header
            return <CommonHeader uuid={item.uuid} />;
          }
          case 'qual_select_multiple': {
            return (
              <SelectMultipleResponseForm
                uuid={item.uuid}
                canEdit={hasEditSubmissionsPermissions}
              />
            );
          }
          case 'qual_select_one': {
            return (
              <SelectOneResponseForm
                uuid={item.uuid}
                canEdit={hasEditSubmissionsPermissions}
              />
            );
          }
          case 'qual_tags': {
            return (
              <TagsResponseForm
                uuid={item.uuid}
                canEdit={hasEditSubmissionsPermissions}
              />
            );
          }
          case 'qual_integer': {
            return (
              <IntegerResponseForm
                uuid={item.uuid}
                canEdit={hasEditSubmissionsPermissions}
              />
            );
          }
          case 'qual_text': {
            return (
              <TextResponseForm
                uuid={item.uuid}
                canEdit={hasEditSubmissionsPermissions}
              />
            );
          }
          default: {
            return (
              <InlineMessage
                icon='alert'
                type='warning'
                message={t('Unknown question type ##type_name##').replace(
                  '##type_name##',
                  item.type
                )}
              />
            );
          }
        }
      }
    },
    [analysisQuestions.state.questionsBeingEdited]
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
