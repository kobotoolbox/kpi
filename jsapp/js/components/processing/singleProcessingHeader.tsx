import React from 'react';
import bem, {makeBem} from 'js/bem';
import {
  QUESTION_TYPES,
  META_QUESTION_TYPES,
} from 'js/constants';
import type {AssetContent} from 'js/dataInterface';
import {
  findRowByQpath,
  getRowTypeIcon,
  getTranslatedRowLabel,
  getRowName,
} from 'js/assetUtils';
import {ROUTES} from 'js/router/routerConstants';
import {hashHistory} from 'react-router';
import Button from 'js/components/common/button';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import KoboSelect from 'js/components/common/koboSelect';
import type {KoboSelectOption} from 'js/components/common/koboSelect';
import './singleProcessingHeader.scss';
import { openProcessing } from './processingUtils';

bem.SingleProcessingHeader = makeBem(null, 'single-processing-header', 'header');
bem.SingleProcessingHeader__column = makeBem(bem.SingleProcessingHeader, 'column', 'section');
bem.SingleProcessingHeader__submissions = makeBem(bem.SingleProcessingHeader, 'submissions', 'nav');
bem.SingleProcessingHeader__count = makeBem(bem.SingleProcessingHeader, 'count');
bem.SingleProcessingHeader__number = makeBem(bem.SingleProcessingHeader, 'number');

interface SingleProcessingHeaderProps {
  submissionEditId: string;
  assetUid: string;
  assetContent: AssetContent;
}

/**
 * Component with the current question label and the UI for switching between
 * submissions and questions.
 */
export default class SingleProcessingHeader extends React.Component<
  SingleProcessingHeaderProps
> {
  private unlisteners: Function[] = [];

  componentDidMount() {
    this.unlisteners.push(
      singleProcessingStore.listen(this.onSingleProcessingStoreChange, this)
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  /**
  * Don't want to store a duplicate of store data here just for the sake of
  * comparison, so we need to make the component re-render itself when the
  * store changes :shrug:.
  */
  onSingleProcessingStoreChange() {
    this.forceUpdate();
  }

  onQuestionSelectChange(newQpath: string) {
    this.goToSubmission(newQpath, this.props.submissionEditId);
  }

  /** Finds first submission with response for given question. */
  getFirstNonNullEditId(questionName: string) {
    const editIds = singleProcessingStore.getSubmissionsEditIds();
    if (editIds) {
      return editIds[questionName]?.find((editIdOrNull) => editIdOrNull !== null) || null;
    }
    return null;
  }

  getQuestionSelectorOptions() {
    const options: KoboSelectOption[] = [];
    const editIds = singleProcessingStore.getSubmissionsEditIds();
    if (editIds) {
      Object.keys(editIds).forEach((qpath) => {
        const questionData = findRowByQpath(this.props.assetContent, qpath);
        // At this point we want to find out whether the question has at least
        // one editId (i.e. there is at least one transcriptable response to
        // the question). Otherwise there's no point in having the question as
        // selectable option.
        const questionEditIds = editIds[qpath];
        const hasAtLeastOneEditId = Boolean(questionEditIds.find((editIdOrNull) => editIdOrNull !== null));
        if (questionData && hasAtLeastOneEditId) {
          // Only allow audio questions at this point (we plan to allow text
          // and video in future).
          if (
            questionData.type === QUESTION_TYPES.audio.id ||
            questionData.type === META_QUESTION_TYPES['background-audio']
          ) {
            const rowName = getRowName(questionData);
            const translatedLabel = getTranslatedRowLabel(
              rowName,
              this.props.assetContent.survey,
              0
            );
            options.push({
              id: qpath,
              label: translatedLabel !== null ? translatedLabel : rowName,
              icon: getRowTypeIcon(questionData.type),
            });
          }
        }
      });
    }
    return options;
  }

  /** Goes back to table view for given asset. */
  onDone() {
    const newRoute = ROUTES.FORM_TABLE.replace(':uid', this.props.assetUid);
    hashHistory.push(newRoute);
  }

  /** Goes to another submission. */
  goToSubmission(qpath: string, targetSubmissionEditId: string) {
    openProcessing(this.props.assetUid, qpath, targetSubmissionEditId);
  }

  goPrev() {
    const prevEditId = this.getPrevSubmissionEditId();
    if (prevEditId !== null && singleProcessingStore.currentQuestionQpath) {
      this.goToSubmission(singleProcessingStore.currentQuestionQpath, prevEditId);
    }
  }

  goNext() {
    const nextEditId = this.getNextSubmissionEditId();
    if (nextEditId !== null && singleProcessingStore.currentQuestionQpath) {
      this.goToSubmission(singleProcessingStore.currentQuestionQpath, nextEditId);
    }
  }

  /** Returns index or `null` (if store is not ready yet). */
  getCurrentSubmissionIndex(): number | null {
    const editIds = singleProcessingStore.getCurrentQuestionSubmissionsEditIds();
    if (Array.isArray(editIds)) {
      const submissionEditIdIndex = editIds.findIndex(
        (item) => item.editId === this.props.submissionEditId
      );
      return submissionEditIdIndex;
    }
    return null;
  }

  /** Returns a natural number or `null` (if store is not ready yet). */
  getCurrentSubmissionNumber(): number | null {
    const currentSubmissionIndex = this.getCurrentSubmissionIndex();
    if (currentSubmissionIndex !== null) {
      return currentSubmissionIndex + 1;
    }
    return null;
  }

  /**
   * Looks for closest previous submissionEditId that has data - i.e. it omits all
   * `null`s in `submissionsEditIds` array. If there is no such `submissionEditId`
   * found, simply returns `null`.
   */
  getPrevSubmissionEditId(): string | null {
    const editIds = singleProcessingStore.getCurrentQuestionSubmissionsEditIds();
    if (!Array.isArray(editIds)) {
      return null;
    }

    const currentIndex = this.getCurrentSubmissionIndex();
    // If not found, or we are on first element, there is no previous.
    if (
      currentIndex === -1 ||
      currentIndex === 0 ||
      currentIndex === null
    ) {
      return null;
    }

    // Finds the closest non-`null` submissionEditId going backwards from
    // the current one.
    const previousEditIds = editIds.slice(0, currentIndex);
    let foundId: string | null = null;
    previousEditIds.forEach((item) => {
      if (item.hasResponse) {
        foundId = item.editId;
      }
    });

    return foundId;
  }

  /**
   * Looks for closest next submissionEditId that has data - i.e. it omits all
   * `null`s in `submissionsEditIds` array. If there is no such `submissionEditId`
   * found, simply returns `null`.
   */
  getNextSubmissionEditId(): string | null {
    const editIds = singleProcessingStore.getCurrentQuestionSubmissionsEditIds();
    if (!Array.isArray(editIds)) {
      return null;
    }

    const currentIndex = this.getCurrentSubmissionIndex();
    // If not found, or we are on last element, there is no next.
    if (
      currentIndex === -1 ||
      currentIndex === editIds.length - 1 ||
      currentIndex === null
    ) {
      return null;
    }

    // Finds the closest non-`null` submissionEditId going forwards from
    // the current one.
    const nextEditIds = editIds.slice(currentIndex + 1);
    let foundId: string | null = null;
    nextEditIds.find((item) => {
      if (item.hasResponse) {
        foundId = item.editId;
        return true;
      }
      return false;
    });

    return foundId;
  }

  render() {
    const editIds = singleProcessingStore.getCurrentQuestionSubmissionsEditIds();

    return (
      <bem.SingleProcessingHeader>
        <bem.SingleProcessingHeader__column m='main'>
          <KoboSelect
            name='single-processing-question-selector'
            type='gray'
            size='l'
            options={this.getQuestionSelectorOptions()}
            selectedOption={singleProcessingStore.currentQuestionQpath || null}
            onChange={this.onQuestionSelectChange.bind(this)}
          />
        </bem.SingleProcessingHeader__column>

        <bem.SingleProcessingHeader__column>
          <bem.SingleProcessingHeader__submissions>
            <bem.SingleProcessingHeader__count>
              <strong>
                {t('Item')}
                &nbsp;
                {this.getCurrentSubmissionNumber()}
              </strong>
              &nbsp;
              {Array.isArray(editIds) &&
                t('of ##total_count##').replace('##total_count##', String(editIds.length))
              }
            </bem.SingleProcessingHeader__count>

            <Button
              type='bare'
              size='s'
              color='storm'
              startIcon='arrow-up'
              onClick={this.goPrev.bind(this)}
              isDisabled={this.getPrevSubmissionEditId() === null}
            />

            <Button
              type='bare'
              size='s'
              color='storm'
              endIcon='arrow-down'
              onClick={this.goNext.bind(this)}
              isDisabled={this.getNextSubmissionEditId() === null}
            />
          </bem.SingleProcessingHeader__submissions>
        </bem.SingleProcessingHeader__column>

        <bem.SingleProcessingHeader__column>
          <Button
            type='frame'
            size='l'
            color='blue'
            label={t('DONE')}
            onClick={this.onDone.bind(this)}
          />
        </bem.SingleProcessingHeader__column>
      </bem.SingleProcessingHeader>
    );
  }
}
