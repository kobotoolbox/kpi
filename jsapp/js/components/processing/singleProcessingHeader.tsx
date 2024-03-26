import React from 'react';
import {QUESTION_TYPES, META_QUESTION_TYPES} from 'js/constants';
import type {AssetContent} from 'js/dataInterface';
import {
  findRowByQpath,
  getRowTypeIcon,
  getTranslatedRowLabel,
  getRowName,
} from 'js/assetUtils';
import {ROUTES} from 'js/router/routerConstants';
import Button from 'js/components/common/button';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import KoboSelect from 'js/components/common/koboSelect';
import type {KoboSelectOption} from 'js/components/common/koboSelect';
import styles from './singleProcessingHeader.module.scss';
import {openProcessing} from './processingUtils';
import {withRouter} from 'js/router/legacy';
import type {WithRouterProps} from 'js/router/legacy';
import {actions} from 'js/actions';
import classNames from 'classnames';

interface SingleProcessingHeaderProps extends WithRouterProps {
  submissionEditId: string;
  assetUid: string;
  assetContent: AssetContent;
}

interface SingleProcessingHeaderState {
  pageSize: number;
  startIndex: number;
  disabled: boolean;
  maxIndex: number;
  minIndex: number;
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
  constructor(props: SingleProcessingHeaderProps) {
    super(props);
    this.state = {
      pageSize: parseInt(this.props.params.pageSize || '30'),
      startIndex: parseInt(this.props.params.startIndex || '0'),
      maxIndex: singleProcessingStore.getSubmissionCount(),
      minIndex: 0,
      disabled: false,
      isDoneButtonPending: false,
    };
  }

  componentDidMount() {
    singleProcessingStore.fetchEditIds(
      this.props.params.filters,
      this.props.params.sort,
      this.state.pageSize,
      this.state.startIndex
    );
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

  onQuestionSelectChange(newQpath: string | null) {
    this.setState({...this.state, disabled: true});
    if (newQpath !== null) {
      this.goToSubmission(
        newQpath,
        this.props.submissionEditId,
        this.state.startIndex.toString()
      );
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
    if (editIds) {
      Object.keys(editIds).forEach((qpath) => {
        const questionData = findRowByQpath(this.props.assetContent, qpath);
        // At this point we want to find out whether the question has at least
        // one editId (i.e. there is at least one transcriptable response to
        // the question). Otherwise there's no point in having the question as
        // selectable option.
        const questionEditIds = editIds[qpath];
        const hasAtLeastOneEditId = Boolean(
          questionEditIds.find((editIdOrNull) => editIdOrNull !== null)
        );
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
              value: qpath,
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
  goToSubmission = (
    qpath: string,
    targetSubmissionEditId: string,
    startIndex?: string
  ) => {
    openProcessing(
      this.props.assetUid,
      qpath,
      targetSubmissionEditId,
      this.props.params.filters,
      this.props.params.sort,
      this.state.pageSize,
      parseInt(startIndex || this.props.params.startIndex || '0')
    );
  };

  goPrev() {
    this.setState({...this.state, disabled: true});
    const prevEditId = this.getPrevSubmissionEditId();
    const prevIndex = this.state.startIndex - this.state.pageSize;
    const currentIndex = this.getCurrentSubmissionIndex();
    const shouldChangePages =
      currentIndex !== null && currentIndex % this.state.pageSize === 0;
    if (prevEditId !== null && !shouldChangePages) {
      this.goToSubmission(
        singleProcessingStore.currentQuestionQpath,
        prevEditId
      );
    } else {
      this.loadPage(prevIndex, currentIndex);
    }
  }

  goNext() {
    this.setState({...this.state, disabled: true});
    const nextEditId = this.getNextSubmissionEditId();
    const nextIndex = this.state.startIndex + this.state.pageSize;
    const currentIndex = this.getCurrentSubmissionIndex();
    const shouldChangePages =
      currentIndex !== null &&
      currentIndex % this.state.pageSize === this.state.pageSize - 1;
    if (nextEditId !== null && !shouldChangePages) {
      this.goToSubmission(
        singleProcessingStore.currentQuestionQpath,
        nextEditId
      );
    } else {
      this.loadPage(nextIndex, currentIndex);
    }
  }

  // load the next/previous page of non-empty page of editIds from the API
  loadPage = (nextIndex: number, currentIndex: number | null) => {
    if (nextIndex > singleProcessingStore.getSubmissionCount()) {
      // we've hit the final submission in the set, disable the next button and re-enable the rest of the UI
      this.setState({
        ...this.state,
        disabled: false,
        maxIndex: currentIndex!,
      });
      return;
    }
    if (nextIndex < 0) {
      // we've hit the first submission in the set, disable the previous button and enable UI
      this.setState({
        ...this.state,
        disabled: false,
        minIndex: currentIndex!,
      });
      return;
    }
    // first, let's attach the listener that will navigate to the next valid submission
    this.unlisteners.push(
      actions.submissions.getProcessingSubmissions.completed.listen(() => {
        // first, remove this callback
        const unsubscribe: Function | undefined = this.unlisteners.pop();
        unsubscribe?.();
        // the difference between the next and current index tells us
        // if we're navigating backward (negative) or forwards (positive)
        const offset = nextIndex - this.state.startIndex;
        const editIds =
          singleProcessingStore.getCurrentQuestionSubmissionsEditIds();
        if (!editIds) {
          // this page of results doesn't have any edits, try the next one
          return this.loadPage(nextIndex + offset, currentIndex);
        }
        let editIndex;
        if (offset > 1) {
          // we're navigating forwards - go to the first element of the next page
          editIndex = 0;
        } else if (offset < 0) {
          // we're navigating forwards - go to the last element of the previous page
          editIndex = editIds.length - 1;
        } else {
          // we don't need to switch pages at all - bail
          return;
        }
        this.goToSubmission(
          singleProcessingStore.currentQuestionQpath,
          editIds[editIndex].editId,
          nextIndex.toString()
        );
      })
    );
    // finally, fetch the next batch of edit IDs so we can construct the absolute URL for the next/previous page
    singleProcessingStore.fetchEditIds(
      this.props.params.filters || '',
      this.props.params.sort,
      this.state.pageSize,
      nextIndex
    );
  };

  /** Returns index or `null` (if store is not ready yet). */
  getCurrentSubmissionIndex(): number | null {
    const editIds =
      singleProcessingStore.getCurrentQuestionSubmissionsEditIds();
    if (Array.isArray(editIds)) {
      const submissionEditIdIndex = editIds.findIndex(
        (item) => item.editId === this.props.submissionEditId
      );
      return submissionEditIdIndex + this.state.startIndex;
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
    const submissionCount = singleProcessingStore.getSubmissionCount();
    const currentIndex = this.getCurrentSubmissionNumber() || -1;

    return (
      <header className={styles.root}>
        <section className={classNames(styles.column, styles.columnMain)}>
          <KoboSelect
            name='single-processing-question-selector'
            type='gray'
            size='l'
            options={this.getQuestionSelectorOptions()}
            selectedOption={singleProcessingStore.currentQuestionQpath}
            onChange={this.onQuestionSelectChange.bind(this)}
            isDisabled={this.state.disabled}
          />
        </section>

        <section className={styles.column}>
          <nav className={styles.submissions}>
            <div className={styles.count}>
              {currentIndex >= 0 && (
                <>
                  <strong>
                    {t('Item')}
                    &nbsp;
                    {currentIndex}
                  </strong>
                  &nbsp;
                  {t('of ##total_count##').replace(
                    '##total_count##',
                    submissionCount.toString()
                  )}
                </>
              )}
            </div>

            <Button
              type='bare'
              size='s'
              color='storm'
              startIcon='arrow-up'
              onClick={this.goPrev.bind(this)}
              isDisabled={
                this.state.disabled ||
                currentIndex <= 1 ||
                currentIndex <= this.state.minIndex + 1
              }
            />

            <Button
              type='bare'
              size='s'
              color='storm'
              endIcon='arrow-down'
              onClick={this.goNext.bind(this)}
              isDisabled={
                this.state.disabled ||
                currentIndex >= submissionCount ||
                currentIndex > this.state.maxIndex
              }
            />
          </nav>
        </section>

        <section className={styles.column}>
          <Button
            type='frame'
            size='l'
            color='blue'
            label={t('DONE')}
            isPending={this.state.isDoneButtonPending}
            onClick={this.onDone.bind(this)}
          />
        </section>
      </header>
    );
  }
}

export default withRouter(SingleProcessingHeader);
