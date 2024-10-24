import React from 'react';
import clonedeep from 'lodash.clonedeep';
import alertify from 'alertifyjs';
import enketoHandler from 'js/enketoHandler';
import {dataInterface} from 'js/dataInterface';
import {actions} from 'js/actions';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {launchPrinting} from 'js/utils';
import pageState from 'js/pageState.store';
import {MODAL_TYPES, QuestionTypeName, EnketoActions} from 'js/constants';
import {
  VALIDATION_STATUS_OPTIONS,
  ValidationStatusAdditionalName,
} from 'js/components/submissions/validationStatus.constants';
import type {ValidationStatusOptionName} from 'js/components/submissions/validationStatus.constants';
import SubmissionDataTable from 'js/components/submissions/submissionDataTable';
import Checkbox from 'js/components/common/checkbox';
import Button from 'js/components/common/button';
import KoboSelect from 'js/components/common/koboSelect';
import {
  userHasPermForSubmission,
  userCan,
} from 'js/components/permissions/utils';
import CenteredMessage from 'js/components/common/centeredMessage.component';
import type {
  FailResponse,
  AssetResponse,
  SubmissionResponse,
  ValidationStatusResponse,
} from 'js/dataInterface';
import AudioPlayer from 'js/components/common/audioPlayer';
import {getBackgroundAudioQuestionName} from 'js/components/submissions/tableUtils';
import {getMediaAttachment} from 'js/components/submissions/submissionUtils';
import type {SubmissionPageName} from 'js/components/submissions/table.types';
import './submissionModal.scss';

const DETAIL_NOT_FOUND = '{\"detail\":\"Not found.\"}';

interface SubmissionModalProps {
  sid: string;
  asset: AssetResponse;
  ids: number[];
  isDuplicated: boolean;
  duplicatedSubmission: SubmissionResponse | null;
  tableInfo:
    | {
        resultsTotal: number;
        pageSize: number;
        currentPage: number;
      }
    | boolean;
}

interface TranslationOption {
  /** Empty string means unnamed language */
  value: string | '';
  label: string;
}

interface SubmissionModalState {
  /** Submission data. Is `null` when it's not loaded yet. */
  submission: SubmissionResponse | null;
  isFetchingSubmissionData: boolean;
  /** 'false' (i.e. "no error") or error message */
  submissionDataFetchError: string | boolean;
  // For previous and next:
  // -1 means there is none,
  // -2 means there is but on different table page.
  previous: number;
  next: number;
  /** Submission uid. */
  sid: string;
  isEnketoEditLoading: boolean;
  isEnketoViewLoading: boolean;
  isDuplicated: boolean;
  duplicatedSubmission: SubmissionResponse | null;
  isEditingDuplicate: boolean;
  isRefreshNeeded: boolean;
  translationIndex: number;
  translationOptions: TranslationOption[];
  showXMLNames: boolean;
  isValidationStatusChangePending: boolean;
}

/**
 * This is a modal component (to be used with `BigModal`) that displays details
 * of given submission.
 * It also handles flow of duplicating submission (TODO: this should be somehow
 * decoupled from this modal, as it increases already complex code).
 */
export default class SubmissionModal extends React.Component<
  SubmissionModalProps,
  SubmissionModalState
> {
  private unlisteners: Function[] = [];

  constructor(props: SubmissionModalProps) {
    super(props);
    let translations = this.props.asset.content?.translations;
    let translationOptions: TranslationOption[] = [];

    if (translations && translations.length > 1) {
      translationOptions = translations.map((trns) => {
        return {
          value: trns || '',
          label: trns || t('Unnamed language'),
        };
      });
    }

    this.state = {
      submission: null,
      isFetchingSubmissionData: true,
      submissionDataFetchError: false,
      previous: -1,
      next: -1,
      sid: props.sid,
      isEnketoEditLoading: false,
      isEnketoViewLoading: false,
      isDuplicated: props.isDuplicated,
      duplicatedSubmission: props.duplicatedSubmission || null,
      isEditingDuplicate: false,
      isRefreshNeeded: false,
      translationIndex: 0,
      translationOptions: translationOptions,
      showXMLNames: false,
      isValidationStatusChangePending: false,
    };
  }

  componentDidMount() {
    this.unlisteners.push(
      actions.resources.updateSubmissionValidationStatus.completed.listen(
        this.refreshSubmissionValidationStatus.bind(this)
      ),
      actions.resources.removeSubmissionValidationStatus.completed.listen(
        this.refreshSubmissionValidationStatus.bind(this)
      ),
      actions.resources.deleteSubmission.completed.listen(
        this.onDeletedSubmissionCompleted.bind(this)
      )
    );

    this.getSubmission(this.props.asset.uid, this.state.sid);
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb();
    });
  }

  /**
   * A callback for submission validation status changes. We use the response
   * to update the in-memory submission data (to avoid making another call).
   */
  refreshSubmissionValidationStatus(result: ValidationStatusResponse) {
    this.setState({isValidationStatusChangePending: false});

    if (!this.state.submission) {
      return;
    }

    const newSubmissionData = clonedeep(this.state.submission);

    if (result && result.uid) {
      newSubmissionData._validation_status = result;
    } else {
      newSubmissionData._validation_status = {};
    }

    this.setState({submission: newSubmissionData});
  }

  /**
   * Whether the submission is editable at this moment. It takes into account
   * current user permissions and few other properties.
   */
  isSubmissionEditable() {
    return (
      this.state.submission &&
      this.props.asset.deployment__active &&
      !this.state.isEnketoEditLoading &&
      (
        userCan('change_submissions', this.props.asset) ||
        userHasPermForSubmission(
          'change_submissions',
          this.props.asset,
          this.state.submission
        )
      )
    );
  }

  /**
   * Loads fresh submission data. Has some error handling.
   */
  getSubmission(assetUid: string, sid: string) {
    this.setState({isFetchingSubmissionData: true});

    dataInterface
      .getSubmission(assetUid, sid)
      .done((data: SubmissionResponse) => {
        let prev = -1;
        let next = -1;

        if (this.props.ids && sid) {
          const c = this.props.ids.findIndex((k) => k === parseInt(sid));
          let tableInfo = this.props.tableInfo || false;
          if (this.props.ids[c - 1]) {
            prev = this.props.ids[c - 1];
          }
          if (this.props.ids[c + 1]) {
            next = this.props.ids[c + 1];
          }

          // table submissions pagination
          if (typeof tableInfo !== 'boolean') {
            const nextAvailable =
              tableInfo.resultsTotal >
              (tableInfo.currentPage + 1) * tableInfo.pageSize;
            if (c + 1 === this.props.ids.length && nextAvailable) {
              next = -2;
            }

            if (tableInfo.currentPage > 0 && prev === -1) {
              prev = -2;
            }
          }
        }

        this.setState({
          submission: data,
          isFetchingSubmissionData: false,
          next: next,
          previous: prev,
        });
      })
      .fail((error: FailResponse) => {
        if (error.responseText) {
          let error_message = error.responseText;
          if (error_message === DETAIL_NOT_FOUND) {
            error_message = t(
              'The submission could not be found. It may have been deleted. Submission ID: ##id##'
            ).replace('##id##', sid);
          }
          this.setState({submissionDataFetchError: error_message, isFetchingSubmissionData: false});
        } else if (error.statusText) {
          this.setState({submissionDataFetchError: error.statusText, isFetchingSubmissionData: false});
        } else {
          this.setState({
            submissionDataFetchError: t('Error: could not load data.'),
            isFetchingSubmissionData: false,
          });
        }
      });
  }

  static getDerivedStateFromProps(
    props: SubmissionModalProps,
    state: SubmissionModalState
  ) {
    if (!(state.sid === props.sid)) {
      return {
        sid: props.sid,
        promptRefresh: false,
      };
    }
    // Return null to indicate no change to state.
    return null;
  }

  componentDidUpdate(prevProps: SubmissionModalProps) {
    if (this.props.asset && prevProps.sid !== this.props.sid) {
      this.getSubmission(this.props.asset.uid, this.props.sid);
    }
  }

  /**
   * Displays a prompt for confirming deletion.
   *
   * TODO: use KoboPrompt instead of alertify. Also make the prompt delete
   * button `isPending` while it waits for the call to finish, as currently
   * there is no indication that app is doing anything in the meantime (bad UX).
   */
  deleteSubmission() {
    let dialog = alertify.dialog('confirm');
    let opts = {
      title: t('Delete submission?'),
      message: `${t('Are you sure you want to delete this submission?')} ${t('This action cannot be undone')}.`,
      labels: {ok: t('Delete'), cancel: t('Cancel')},
      onok: () => {
        actions.resources.deleteSubmission(
          this.props.asset.uid,
          this.props.sid
        );
      },
      oncancel: () => {
        dialog.destroy();
      },
    };
    dialog.set(opts).show();
  }

  onDeletedSubmissionCompleted() {
    // After successfull deletion of submission we close this modal.
    pageState.hideModal();
  }

  /**
   * Opens current submission as editable in Enketo (in new browser tab). After
   * using Enketo and saving the submission, you will notice "Refresh" button
   * appearing in this modal - please use it to ensure you see that submission
   * data you've just modified.
   */
  launchEditSubmission() {
    this.setState({
      isRefreshNeeded: true,
      isEnketoEditLoading: true,
      isEditingDuplicate: true,
    });
    enketoHandler
      .openSubmission(this.props.asset.uid, this.state.sid, EnketoActions.edit)
      .then(
        () => {this.setState({isEnketoEditLoading: false});},
        () => {this.setState({isEnketoEditLoading: false});}
      );
  }

  /**
   * Opens current submission as view-only in Enketo (in new browser tab).
   */
  launchViewSubmission() {
    this.setState({isEnketoViewLoading: true});
    enketoHandler
      .openSubmission(this.props.asset.uid, this.state.sid, EnketoActions.view)
      .then(
        () => {this.setState({isEnketoViewLoading: false});},
        () => {this.setState({isEnketoViewLoading: false});}
      );
  }

  duplicateSubmission() {
    // Due to how modals are created, we must close this modal and recreate
    // an almost identical one to display the new submission with a different
    // title bar
    pageState.hideModal();
    actions.resources.duplicateSubmission(
      this.props.asset.uid,
      this.state.sid,
      this.state.submission
    );
  }

  /**
   * Fetches fresh submission data and triggers reload of the Data Table.
   */
  triggerRefresh() {
    this.getSubmission(this.props.asset.uid, this.props.sid);
    this.setState({isRefreshNeeded: false});
    // Prompt table to refresh submission list
    actions.resources.refreshTableSubmissions();
  }

  /**
   * Changes submission being displayed in here to the previous/next submission
   * from the already loaded submissions in the Data Table.
   */
  switchSubmission(
    /** This is a submission uid (a number) */
    prevOrNext: number
  ) {
    this.setState({isFetchingSubmissionData: true});

    pageState.showModal({
      type: MODAL_TYPES.SUBMISSION,
      sid: prevOrNext,
      asset: this.props.asset,
      ids: this.props.ids,
      tableInfo: this.props.tableInfo || false,
    });
  }

  /**
   * Triggers Data Table to load the previous/next page of submissions, and then
   * changes submission being displayed in here to previous/next taking proper
   * order into account.
   */
  switchSubmissionFromOtherTablePage(newPage: SubmissionPageName) {
    this.setState({isFetchingSubmissionData: true});
    pageState.showModal({
      type: MODAL_TYPES.SUBMISSION,
      sid: false,
      page: newPage,
    });
  }

  onShowXMLNamesChange(newValue: boolean) {
    this.setState({showXMLNames: newValue});
  }

  onValidationStatusChange(newValidationStatus: ValidationStatusOptionName) {
    // `null` is not possible, because we have `isClearable={false}`, but TypeScript
    // keeps complaining
    if (newValidationStatus === null) {
      return;
    }

    this.setState({isValidationStatusChangePending: true});

    if (newValidationStatus === ValidationStatusAdditionalName.no_status) {
      actions.resources.removeSubmissionValidationStatus(
        this.props.asset.uid,
        this.state.sid
      );
    } else {
      actions.resources.updateSubmissionValidationStatus(
        this.props.asset.uid,
        this.state.sid,
        {'validation_status.uid': newValidationStatus}
      );
    }
  }

  onLanguageChange(newValue: string | null) {
    let index = this.state.translationOptions.findIndex(
      (x) => x.value === newValue
    );
    this.setState({
      translationIndex: index || 0,
    });
  }

  /**
   * Whether the form has background audio enabled. This means that there is
   * a possibility that the submission could have a background audio recording.
   * If you need to know if recording exist, please use `getBackgroundAudioUrl`.
   */
  hasBackgroundAudioEnabled() {
    return this.props.asset?.content?.survey?.some(
      (question) => question.type === QuestionTypeName['background-audio']
    );
  }

  getBackgroundAudioUrl() {
    const backgroundAudioName = getBackgroundAudioQuestionName(
      this.props.asset
    );

    if (
      backgroundAudioName &&
      this.state.submission &&
      Object.keys(this.state.submission).includes(backgroundAudioName)
    ) {
      const response = this.state.submission[backgroundAudioName];
      if (typeof response === 'string') {
        const mediaAttachment = getMediaAttachment(
          this.state.submission,
          response,
          QuestionTypeName['background-audio']
        );
        if (typeof mediaAttachment === 'string') {
          return mediaAttachment;
        } else {
          return mediaAttachment.download_medium_url || mediaAttachment.download_url;
        }
      }
    }

    return undefined;
  }

  /**
   * Displays language and validation status dropdowns.
   */
  renderDropdowns() {
    if (!this.props.asset.deployment__active || !this.state.submission) {
      return null;
    }

    return (
      <div className='submission-modal-dropdowns'>
        {this.state.translationOptions.length > 1 && (
          <KoboSelect
            label={t('Language')}
            name='submission-modal-language-switcher'
            type='outline'
            size='s'
            options={this.state.translationOptions}
            selectedOption={
              this.state.translationOptions[this.state.translationIndex].value
            }
            onChange={(newSelectedOption: string | null) => {
              this.onLanguageChange(newSelectedOption);
            }}
          />
        )}

        <KoboSelect
          label={t('Validation status:')}
          name='submission-modal-validation-status'
          type='outline'
          size='s'
          options={VALIDATION_STATUS_OPTIONS}
          selectedOption={
            this.state.submission._validation_status?.uid || null
          }
          onChange={(newSelectedOption: string | null) => {
            if (newSelectedOption !== null) {
              const castOption = newSelectedOption as ValidationStatusOptionName;
              this.onValidationStatusChange(castOption);
            } else {
              this.onValidationStatusChange(ValidationStatusAdditionalName.no_status);
            }
          }}
          isPending={this.state.isValidationStatusChangePending}
          isDisabled={
            !(
              userCan('validate_submissions', this.props.asset) ||
              userHasPermForSubmission(
                'validate_submissions',
                this.props.asset,
                this.state.submission
              )
            )
          }
        />
      </div>
    );
  }

  /**
   * Displays some info about duplicated submission and "Edit" and "Discard"
   * action buttons.
   */
  renderDuplicatedSubmissionSubheader() {
    // For TypeScript
    if (!this.state.submission) {
      return null;
    }

    if (!this.state.isDuplicated || this.state.isEditingDuplicate) {
      return null;
    }

    return (
      <section className='submission-modal-message-box duplicated-submission-subheader'>
        <h1 className='submission-duplicate__header'>
          {t('Duplicate created')}
        </h1>

        <p className='submission-duplicate__text'>
          {t('A duplicate of the submission record was successfully created. You can view the new instance below and make changes using the action buttons below.')}
        </p>

        <p className='submission-duplicate__text'>
          {t('Source submission uuid:' + ' ')}
          <code>{this.state.duplicatedSubmission?._uuid}</code>
        </p>

        <div className='submission-modal-buttons-group'>
          {this.renderEditButton()}

          {(userCan('delete_submissions', this.props.asset) ||
            userHasPermForSubmission(
              'delete_submissions',
              this.props.asset,
              this.state.submission
            )) && (
            <Button
              onClick={this.deleteSubmission.bind(this)}
              type='danger'
              size='l'
              isDisabled={!this.isSubmissionEditable()}
              label={t('Discard')}
              tooltip={t('Discard duplicated submission')}
            />
          )}
        </div>
      </section>
    );
  }

  /**
   * Displays a warning/info message, prompting user to load fresh submission
   * data (because it most probably changed on the Back end)
   */
  renderRefreshWarning() {
    // We only display refresh warning if we need it (e.g. we know user was
    // editing submission in Enketo)
    if (!this.state.isRefreshNeeded) {
      return null;
    }

    return (
      <div className='submission-modal-message-box'>
        <p>
          {t(
            'Click on the button below to load the most recent data for this submission. '
          )}
        </p>

        <Button
          onClick={this.triggerRefresh.bind(this)}
          type='primary'
          size='l'
          label={t('Refresh submission')}
        />
      </div>
    );
  }

  /**
   * Displays few buttons that allows switching submission or making changes to it.
   */
  renderSubmissionActions() {
    // For TypeScript
    if (!this.state.submission) {
      return null;
    }

    // We hide these elements of UI for duplicated submission flow.
    // TODO: displaying those might be a better UX, we just need to check if
    // everything works, or if it requires some work to make it usable (e.g. for
    // duplicated submission prev/next arrows might point to wrong submissions)
    if (this.state.isDuplicated && !this.state.isEditingDuplicate) {
      return null;
    }

    return (
      <section className='submission-modal-buttons'>
        <div className='submission-modal-buttons-group'>
          <Button
            onClick={() => {
              if (this.state.previous === -2) {
                this.switchSubmissionFromOtherTablePage('prev');
              } else {
                this.switchSubmission(this.state.previous);
              }
            }}
            isDisabled={this.state.previous === -1}
            type='text'
            size='l'
            label={t('Previous')}
            startIcon='angle-left'
          />

          <Button
            onClick={() => {
              if (this.state.next === -2) {
                this.switchSubmissionFromOtherTablePage('next');
              } else {
                this.switchSubmission(this.state.next);
              }
            }}
            isDisabled={this.state.next === -1}
            type='text'
            size='l'
            label={t('Next')}
            endIcon='angle-right'
          />
        </div>

        <div className='submission-modal-buttons-group'>
          <Checkbox
            checked={this.state.showXMLNames}
            onChange={this.onShowXMLNamesChange.bind(this)}
            label={t('Display XML names')}
          />

          {this.renderEditButton()}

          <Button
            onClick={this.launchViewSubmission.bind(this)}
            type='primary'
            size='l'
            isDisabled={
              !userCan('view_submissions', this.props.asset) &&
              !userHasPermForSubmission(
                'view_submissions',
                this.props.asset,
                this.state.submission
              )
            }
            isPending={this.state.isEnketoViewLoading}
            label={t('View')}
          />

          <Button
            onClick={this.duplicateSubmission.bind(this)}
            type='primary'
            size='l'
            isDisabled={!this.isSubmissionEditable()}
            label={t('Duplicate')}
          />

          <Button
            onClick={launchPrinting}
            type='secondary'
            size='l'
            startIcon='print'
            className='report-button__print'
            tooltip={t('Print')}
            tooltipPosition='right'
          />

          <Button
            onClick={this.deleteSubmission.bind(this)}
            type='secondary-danger'
            size='l'
            startIcon='trash'
            tooltip={t('Delete submission')}
            tooltipPosition='right'
            isDisabled={
              !userCan('delete_submissions', this.props.asset) &&
              !userHasPermForSubmission(
                'delete_submissions',
                this.props.asset,
                this.state.submission
              )
            }
          />
        </div>
      </section>
    );
  }

  renderEditButton() {
    return (
      <Button
        onClick={this.launchEditSubmission.bind(this)}
        type='primary'
        size='l'
        isDisabled={!this.isSubmissionEditable()}
        isPending={this.state.isEnketoEditLoading}
        label={t('Edit')}
      />
    );
  }

  render() {
    // Until we get all necessary data, we display a spinner
    if (this.state.isFetchingSubmissionData) {
      return <LoadingSpinner />;
    }

    // Error handling
    if (typeof this.state.submissionDataFetchError === 'string') {
      return <CenteredMessage message={this.state.submissionDataFetchError} />;
    }
    if (!this.state.submission) {
      return <CenteredMessage message={t('Unknown error')} />;
    }

    // Get background audio
    const bgAudioUrl = this.getBackgroundAudioUrl();

    // Each of these `renderX()` functions handle the conditional rendering
    // by itself
    return (
      <>
        {this.renderDuplicatedSubmissionSubheader()}

        {this.renderRefreshWarning()}

        {this.renderDropdowns()}

        {this.renderSubmissionActions()}

        {this.hasBackgroundAudioEnabled() && (
          <bem.SubmissionDataTable>
            <bem.SubmissionDataTable__row m={['columns', 'column-names']}>
              <bem.SubmissionDataTable__column>
                {t('Background audio recording')}
              </bem.SubmissionDataTable__column>
            </bem.SubmissionDataTable__row>

            <bem.SubmissionDataTable__row m={['columns', 'response', 'type-audio']}>
              {bgAudioUrl &&
                <bem.SubmissionDataTable__column m={['data', 'type-audio']}>
                  <AudioPlayer mediaURL={bgAudioUrl} />
                </bem.SubmissionDataTable__column>
              }

              {!bgAudioUrl &&
                <bem.SubmissionDataTable__column m='data'>
                  {t('N/A')}
                </bem.SubmissionDataTable__column>
              }
            </bem.SubmissionDataTable__row>
          </bem.SubmissionDataTable>
        )}

        <SubmissionDataTable
          asset={this.props.asset}
          submissionData={this.state.submission}
          translationIndex={this.state.translationIndex}
          showXMLNames={this.state.showXMLNames}
        />
      </>
    );
  }
}
