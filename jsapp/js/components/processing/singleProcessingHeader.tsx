import React from 'react';
import {QUESTION_TYPES} from 'js/constants';
import type {AssetResponse} from 'js/dataInterface';
import {
  findRowByXpath,
  getRowTypeIcon,
  getTranslatedRowLabel,
  getRowName,
  getLanguageIndex,
} from 'js/assetUtils';
import {ROUTES} from 'js/router/routerConstants';
import Button from 'js/components/common/button';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import KoboSelect from 'js/components/common/koboSelect';
import type {KoboSelectOption} from 'js/components/common/koboSelect';
import styles from './singleProcessingHeader.module.scss';
import {goToProcessing} from 'js/components/processing/routes.utils';
import {withRouter} from 'js/router/legacy';
import type {WithRouterProps} from 'js/router/legacy';
import {actions} from 'js/actions';
import classNames from 'classnames';

interface SingleProcessingHeaderProps extends WithRouterProps {
  submissionEditId: string;
  assetUid: string;
  asset: AssetResponse;
}

interface SingleProcessingHeaderState {
  isDoneButtonPending: boolean;
}

/**
 * Component with the current question label and the UI for switching between
 * submissions and questions. It also has means of leaving Single Processing
 * via "DONE" button.
 */
class SingleProcessingHeader extends React.Component<
  SingleProcessingHeaderProps,
  SingleProcessingHeaderState
> {
  private unlisteners: Function[] = [];

  componentDidMount() {
    this.unlisteners.push(
      singleProcessingStore.listen(this.onSingleProcessingStoreChange, this)
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb();
    });
  }

  /**
   * Don't want to store a duplicate of store data here just for the sake of
   * comparison, so we need to make the component re-render itself when the
   * store changes :shrug:.
   */
  onSingleProcessingStoreChange() {
    this.forceUpdate();
  }

  onQuestionSelectChange(newXpath: string | null) {
    if (newXpath !== null) {
      this.goToSubmission(newXpath, this.props.submissionEditId);
    }
  }

  /** Finds first submission with response for given question. */
  getFirstNonNullEditId(questionName: string) {
    const editIds = singleProcessingStore.getSubmissionsEditIds();
    if (editIds) {
      return (
        editIds[questionName]?.find((editIdOrNull) => editIdOrNull !== null) ||
        null
      );
    }
    return null;
  }

  /**
   * For displaying question selector - filtered down to questions with
   * responses and of audio type (for now).
   */
  getQuestionSelectorOptions() {
    const options: KoboSelectOption[] = [];
    const editIds = singleProcessingStore.getSubmissionsEditIds();
    const assetContent = this.props.asset.content;
    const languageIndex = getLanguageIndex(
      this.props.asset,
      singleProcessingStore.getCurrentlyDisplayedLanguage()
    );

    if (!assetContent) {
      return [];
    }

    if (editIds) {
      Object.keys(editIds).forEach((xpath) => {
        const questionData = findRowByXpath(assetContent, xpath);
        // At this point we want to find out whether the question has at least
        // one editId (i.e. there is at least one transcriptable response to
        // the question). Otherwise there's no point in having the question as
        // selectable option.
        const questionEditIds = editIds[xpath];
        const hasAtLeastOneEditId = Boolean(
          questionEditIds.find((editIdOrNull) => editIdOrNull !== null)
        );
        if (questionData && hasAtLeastOneEditId) {
          // Only allow audio questions at this point (we plan to allow text
          // and video in future).
          if (
            questionData.type === QUESTION_TYPES.audio.id ||
            questionData.type === QUESTION_TYPES['background-audio'].id
          ) {
            const rowName = getRowName(questionData);
            const translatedLabel = getTranslatedRowLabel(
              rowName,
              assetContent.survey,
              languageIndex
            );
            options.push({
              value: xpath,
              label: translatedLabel !== null ? translatedLabel : rowName,
              icon: getRowTypeIcon(questionData.type),
            });
          }
        }
      });
    }
    return options;
  }

  /** Goes back to Data Table route for given project. */
  onDone() {
    // HACK: If there are any changes to the data, we need to ensure that
    // the latest asset is available in the Data Table, when it will rebuild
    // itself, so that all the columns are rendered. This is needed for the case
    // when user added/deleted transcript or translation (editing the text
    // value for it is already handled properly by Data Table code).
    if (!singleProcessingStore.data.isPristine) {
      // Mark button as pending to let user know we wait for stuff.
      this.setState({isDoneButtonPending: true});

      // We don't need to add these listeners prior to this moment, and we don't
      // need to cancel them, as regardless of outcome, we will navigate out of
      // current view.
      this.unlisteners.push(
        actions.resources.loadAsset.completed.listen(
          this.navigateToDataTable.bind(this)
        )
      );

      // For failed load we still navigate to Data Table, as this is not
      // something that would cause a massive disruption or data loss
      this.unlisteners.push(
        actions.resources.loadAsset.failed.listen(
          this.navigateToDataTable.bind(this)
        )
      );

      // We force load asset to overwrite the cache, so that when
      // `FormSubScreens` (a parent of Data Table) starts loading in a moment,
      // it would fetch latest asset and make Data Table use it. To avoid
      // race conditions we wait until it loads to leave.
      actions.resources.loadAsset({id: this.props.assetUid}, true);
    } else {
      this.navigateToDataTable();
    }
  }

  navigateToDataTable() {
    const newRoute = ROUTES.FORM_TABLE.replace(':uid', this.props.assetUid);
    this.props.router.navigate(newRoute);
  }

  /** Goes to another submission. */
  goToSubmission(xpath: string, targetSubmissionEditId: string) {
    goToProcessing(this.props.assetUid, xpath, targetSubmissionEditId, true);
  }

  goPrev() {
    const prevEditId = this.getPrevSubmissionEditId();
    if (prevEditId !== null) {
      this.goToSubmission(
        singleProcessingStore.currentQuestionXpath,
        prevEditId
      );
    }
  }

  goNext() {
    const nextEditId = this.getNextSubmissionEditId();
    if (nextEditId !== null) {
      this.goToSubmission(
        singleProcessingStore.currentQuestionXpath,
        nextEditId
      );
    }
  }

  /** Returns index or `null` (if store is not ready yet). */
  getCurrentSubmissionIndex(): number | null {
    const editIds =
      singleProcessingStore.getCurrentQuestionSubmissionsEditIds();
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
   * Looks for closest previous submissionEditId that has data - i.e. it omits
   * all `null`s in `submissionsEditIds` array. If there is no such
   * `submissionEditId` to be found, simply returns `null`.
   */
  getPrevSubmissionEditId(): string | null {
    const editIds =
      singleProcessingStore.getCurrentQuestionSubmissionsEditIds();
    if (!Array.isArray(editIds)) {
      return null;
    }

    const currentIndex = this.getCurrentSubmissionIndex();
    // If not found, or we are on first element, there is no previous.
    if (currentIndex === -1 || currentIndex === 0 || currentIndex === null) {
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
   * `null`s in `submissionsEditIds` array. If there is no such
   * `submissionEditId` to be found, simply returns `null`.
   */
  getNextSubmissionEditId(): string | null {
    const editIds =
      singleProcessingStore.getCurrentQuestionSubmissionsEditIds();
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
    const editIds =
      singleProcessingStore.getCurrentQuestionSubmissionsEditIds();

    return (
      <header className={styles.root}>
        <section className={classNames(styles.column, styles.columnMain)}>
          <KoboSelect
            name='single-processing-question-selector'
            type='gray'
            size='l'
            options={this.getQuestionSelectorOptions()}
            selectedOption={singleProcessingStore.currentQuestionXpath}
            onChange={this.onQuestionSelectChange.bind(this)}
          />
        </section>

        <section className={styles.column}>
          <nav className={styles.submissions}>
            <div className={styles.count}>
              <strong>
                {t('Item')}
                &nbsp;
                {this.getCurrentSubmissionNumber()}
              </strong>
              &nbsp;
              {Array.isArray(editIds) &&
                t('of ##total_count##').replace(
                  '##total_count##',
                  String(editIds.length)
                )}
            </div>

            <Button
              type='text'
              size='s'
              startIcon='arrow-up'
              onClick={this.goPrev.bind(this)}
              isDisabled={this.getPrevSubmissionEditId() === null}
            />

            <Button
              type='text'
              size='s'
              endIcon='arrow-down'
              onClick={this.goNext.bind(this)}
              isDisabled={this.getNextSubmissionEditId() === null}
            />
          </nav>
        </section>

        <section className={styles.column}>
          <Button
            type='primary'
            size='l'
            label={t('DONE')}
            isPending={this.state?.isDoneButtonPending}
            onClick={this.onDone.bind(this)}
          />
        </section>
      </header>
    );
  }
}

export default withRouter(SingleProcessingHeader);
