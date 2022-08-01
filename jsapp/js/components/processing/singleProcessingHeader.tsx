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
  submissionUuid: string;
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
    this.goToSubmission(newQpath, this.props.submissionUuid);
  }

  /** Finds first submission with response for given question. */
  getFirstNonNullUuid(questionName: string) {
    const uuids = singleProcessingStore.getSubmissionsUuids();
    if (uuids) {
      return uuids[questionName]?.find((uuidOrNull) => uuidOrNull !== null) || null;
    }
    return null;
  }

  getQuestionSelectorOptions() {
    const options: KoboSelectOption[] = [];
    const uuids = singleProcessingStore.getSubmissionsUuids();
    if (uuids) {
      Object.keys(uuids).forEach((qpath) => {
        const questionData = findRowByQpath(this.props.assetContent, qpath);
        // At this point we want to find out whether the question has at least
        // one uuid (i.e. there is at least one transcriptable response to
        // the question). Otherwise there's no point in having the question as
        // selectable option.
        const questionUuids = uuids[qpath];
        const hasAtLeastOneUuid = Boolean(questionUuids.find((uuidOrNull) => uuidOrNull !== null));
        if (questionData && hasAtLeastOneUuid) {
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
  goToSubmission(qpath: string, targetSubmissionUuid: string) {
    openProcessing(this.props.assetUid, qpath, targetSubmissionUuid);
  }

  goPrev() {
    const prevUuid = this.getPrevSubmissionUuid();
    if (prevUuid !== null && singleProcessingStore.currentQuestionQpath) {
      this.goToSubmission(singleProcessingStore.currentQuestionQpath, prevUuid);
    }
  }

  goNext() {
    const nextUuid = this.getNextSubmissionUuid();
    if (nextUuid !== null && singleProcessingStore.currentQuestionQpath) {
      this.goToSubmission(singleProcessingStore.currentQuestionQpath, nextUuid);
    }
  }

  /** Returns index or `null` (if store is not ready yet). */
  getCurrentSubmissionIndex(): number | null {
    const uuids = singleProcessingStore.getCurrentQuestionSubmissionsUuids();
    if (Array.isArray(uuids)) {
      const submissionUuidIndex = uuids.findIndex(
        (item) => item.uuid === this.props.submissionUuid
      );
      return submissionUuidIndex;
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
   * Looks for closest previous submissionUuid that has data - i.e. it omits all
   * `null`s in `submissionsUuids` array. If there is no such `submissionUuid`
   * found, simply returns `null`.
   */
  getPrevSubmissionUuid(): string | null {
    const uuids = singleProcessingStore.getCurrentQuestionSubmissionsUuids();
    if (!Array.isArray(uuids)) {
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

    // Finds the closest non-`null` submissionUuid going backwards from
    // the current one.
    const previousUuids = uuids.slice(0, currentIndex);
    let foundId: string | null = null;
    previousUuids.forEach((item) => {
      if (item.hasResponse) {
        foundId = item.uuid;
      }
    });

    return foundId;
  }

  /**
   * Looks for closest next submissionUuid that has data - i.e. it omits all
   * `null`s in `submissionsUuids` array. If there is no such `submissionUuid`
   * found, simply returns `null`.
   */
  getNextSubmissionUuid(): string | null {
    const uuids = singleProcessingStore.getCurrentQuestionSubmissionsUuids();
    if (!Array.isArray(uuids)) {
      return null;
    }

    const currentIndex = this.getCurrentSubmissionIndex();
    // If not found, or we are on last element, there is no next.
    if (
      currentIndex === -1 ||
      currentIndex === uuids.length - 1 ||
      currentIndex === null
    ) {
      return null;
    }

    // Finds the closest non-`null` submissionUuid going forwards from
    // the current one.
    const nextUuids = uuids.slice(currentIndex + 1);
    let foundId: string | null = null;
    nextUuids.find((item) => {
      if (item.hasResponse) {
        foundId = item.uuid;
        return true;
      }
      return false;
    });

    return foundId;
  }

  render() {
    const uuids = singleProcessingStore.getCurrentQuestionSubmissionsUuids();

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
            <Button
              type='bare'
              size='s'
              color='storm'
              startIcon='caret-left'
              onClick={this.goPrev.bind(this)}
              isDisabled={this.getPrevSubmissionUuid() === null}
            />

            <bem.SingleProcessingHeader__count>
              <strong>
                {t('Submission')}
                &nbsp;
                {this.getCurrentSubmissionNumber()}
              </strong>
              &nbsp;
              {Array.isArray(uuids) &&
                t('of ##total_count##').replace('##total_count##', String(uuids.length))
              }
            </bem.SingleProcessingHeader__count>

            <Button
              type='bare'
              size='s'
              color='storm'
              endIcon='caret-right'
              onClick={this.goNext.bind(this)}
              isDisabled={this.getNextSubmissionUuid() === null}
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
