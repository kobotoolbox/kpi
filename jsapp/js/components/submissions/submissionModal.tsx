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
import {MODAL_TYPES, META_QUESTION_TYPES, EnketoActions} from 'js/constants';
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
import './submissionModal.scss';

const DETAIL_NOT_FOUND = '{\"detail\":\"Not found.\"}';

interface SubmissionModalProps {
  sid: string;
  asset: AssetResponse;
  ids: number[];
  isDuplicated: boolean;
  duplicatedSubmission: SubmissionResponse | null;
  backgroundAudioUrl: string;
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
  /** Is `null` when it's not loaded yet */
  submission: SubmissionResponse | null;
  loading: boolean;
  /** 'false' (i.e. "no error") or error message */
  error: string | boolean;
  // For previous and next:
  // -1 means there is none,
  // -2 means there is but on different table page.
  previous: number;
  next: number;
  sid: string;
  showBetaFieldsWarning: boolean;
  isEditLoading: boolean;
  isViewLoading: boolean;
  isDuplicated: boolean;
  duplicatedSubmission: SubmissionResponse | null;
  isEditingDuplicate: boolean;
  promptRefresh: boolean;
  translationIndex: number;
  translationOptions: TranslationOption[];
  showXMLNames: boolean;
  isValidationStatusChangePending: boolean;
}

class SubmissionModal extends React.Component<
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
      loading: true,
      error: false,
      // For previous and next:
      // -1 means there is none,
      // -2 means there is but on different table page.
      previous: -1,
      next: -1,
      sid: props.sid,
      showBetaFieldsWarning: false,
      isEditLoading: false,
      isViewLoading: false,
      isDuplicated: props.isDuplicated,
      duplicatedSubmission: props.duplicatedSubmission || null,
      isEditingDuplicate: false,
      promptRefresh: false,
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

  refreshSubmissionValidationStatus(result: ValidationStatusResponse) {
    this.setState({isValidationStatusChangePending: false});

    if (this.state.submission === null) {
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

  isSubmissionEditable() {
    return this.props.asset.deployment__active && !this.state.isEditLoading;
  }

  getSubmission(assetUid: string, sid: string) {
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
          loading: false,
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
          this.setState({error: error_message, loading: false});
        } else if (error.statusText) {
          this.setState({error: error.statusText, loading: false});
        } else {
          this.setState({
            error: t('Error: could not load data.'),
            loading: false,
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
    pageState.hideModal();
  }

  launchEditSubmission() {
    this.setState({
      promptRefresh: true,
      isEditLoading: true,
      isEditingDuplicate: true,
    });
    enketoHandler
      .openSubmission(this.props.asset.uid, this.state.sid, EnketoActions.edit)
      .then(
        () => {
          this.setState({isEditLoading: false});
        },
        () => {
          this.setState({isEditLoading: false});
        }
      );
  }

  launchViewSubmission() {
    this.setState({
      isViewLoading: true,
    });
    enketoHandler
      .openSubmission(this.props.asset.uid, this.state.sid, EnketoActions.view)
      .then(() => {
        this.setState({isViewLoading: false});
      });
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

  triggerRefresh() {
    this.getSubmission(this.props.asset.uid, this.props.sid);
    this.setState({
      promptRefresh: false,
    });
    // Prompt table to refresh submission list
    actions.resources.refreshTableSubmissions();
  }

  switchSubmission(prevOrNext: number) {
    this.setState({loading: true});
    pageState.showModal({
      type: MODAL_TYPES.SUBMISSION,
      sid: prevOrNext,
      asset: this.props.asset,
      ids: this.props.ids,
      tableInfo: this.props.tableInfo || false,
    });
  }

  prevTablePage() {
    this.setState({loading: true});

    pageState.showModal({
      type: MODAL_TYPES.SUBMISSION,
      sid: false,
      page: 'prev',
    });
  }

  nextTablePage() {
    this.setState({loading: true});

    pageState.showModal({
      type: MODAL_TYPES.SUBMISSION,
      sid: false,
      page: 'next',
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

  hasBackgroundAudio() {
    return this.props.asset?.content?.survey?.some(
      (question) => question.type === META_QUESTION_TYPES['background-audio']
    );
  }

  renderDropdowns() {
    if (!this.props.asset.deployment__active || !this.state.submission) {
      return null;
    }

    return (
      <div className='submission-modal-dropdowns'>
        {this.state.translationOptions.length > 1 && (
          <div className='switch--label-language'>
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
          </div>
        )}
        <div className='switch--validation-status'>
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
      </div>
    );
  }

  render() {
    if (this.state.loading) {
      return <LoadingSpinner />;
    }

    if (typeof this.state.error === 'string') {
      return <CenteredMessage message={this.state.error} />;
    }

    if (!this.state.submission) {
      return <CenteredMessage message={t('Unknown error')} />;
    }

    const s = this.state.submission;

    // Use this modal if we just duplicated a submission, but not if we are
    // editing it
    if (this.state.isDuplicated && !this.state.isEditingDuplicate) {
      return (
        <>
          <h1 className='submission-duplicate__header'>
            {t('Duplicate created')}
          </h1>
          <p className='submission-duplicate__text'>
            {t(
              'A duplicate of the submission record was successfully created. You can view the new instance below and make changes using the action buttons below.'
            )}
            <br />
            <br />
            {t('Source submission uuid:' + ' ')}
            <code>{this.state.duplicatedSubmission?._uuid}</code>
          </p>

          <div className='submission-modal-duplicate-actions'>
            {(userCan('change_submissions', this.props.asset) ||
              userHasPermForSubmission(
                'change_submissions',
                this.props.asset,
                this.state.submission
              )) && (
              <Button
                onClick={this.launchEditSubmission.bind(this)}
                color='blue'
                type='full'
                size='l'
                isDisabled={!this.isSubmissionEditable()}
                label={this.state.isEditLoading ? t('Loading…') : t('Edit')}
              />
            )}

            {(userCan('delete_submissions', this.props.asset) ||
              userHasPermForSubmission(
                'delete_submissions',
                this.props.asset,
                this.state.submission
              )) && (
              <Button
                onClick={this.deleteSubmission.bind(this)}
                color='red'
                type='full'
                size='l'
                isDisabled={!this.isSubmissionEditable()}
                label={t('Discard')}
                tooltip={t('Discard duplicated submission')}
                className='submission-duplicate__button'
              />
            )}
          </div>

          {this.renderDropdowns()}

          {this.state.submission && (
            <SubmissionDataTable
              asset={this.props.asset}
              submissionData={this.state.submission}
              translationIndex={this.state.translationIndex}
              showXMLNames={this.state.showXMLNames}
            />
          )}
        </>
      );
    }

    // Use this modal if we are not viewing a duplicate, or we are editing one
    if (!this.state.isDuplicated || this.state.isEditingDuplicate) {
      return (
        <>
          {this.state.promptRefresh && (
            <div className='submission-modal-warning'>
              <p>
                {t(
                  'Click on the button below to load the most recent data for this submission. '
                )}
              </p>

              <Button
                onClick={this.triggerRefresh.bind(this)}
                color='blue'
                type='full'
                size='l'
                label={t('Refresh submission')}
              />
            </div>
          )}

          <section className='submission-modal-section'>
            {this.hasBackgroundAudio() && (
              <bem.BackgroundAudioPlayer>
                <bem.BackgroundAudioPlayer__label>
                  {t('Background audio recording')}
                </bem.BackgroundAudioPlayer__label>

                <bem.BackgroundAudioPlayer__audio
                  controls
                  src={this.props?.backgroundAudioUrl}
                />
              </bem.BackgroundAudioPlayer>
            )}

            {this.renderDropdowns()}
          </section>

          <section className='submission-modal-section'>
            {this.state.isEditingDuplicate && (
              <div className='preserveFlexCSS' />
            )}

            {!this.state.isEditingDuplicate && (
              <div className='submission-pager'>
                {/* don't display previous button if `previous` is -1 */}
                {this.state.previous > -1 && (
                  <Button
                    onClick={this.switchSubmission.bind(
                      this,
                      this.state.previous
                    )}
                    color='blue'
                    type='bare'
                    size='l'
                    label={t('Previous')}
                    startIcon='angle-left'
                  />
                )}
                {this.state.previous === -2 && (
                  <Button
                    onClick={this.prevTablePage.bind(this)}
                    color='blue'
                    type='bare'
                    size='l'
                    label={t('Previous')}
                    startIcon='angle-left'
                  />
                )}

                {/* don't display next button if `next` is -1 */}
                {this.state.next > -1 && (
                  <Button
                    onClick={this.switchSubmission.bind(this, this.state.next)}
                    color='blue'
                    type='bare'
                    size='l'
                    label={t('Next')}
                    endIcon='angle-right'
                  />
                )}
                {this.state.next === -2 && (
                  <Button
                    onClick={this.nextTablePage.bind(this)}
                    color='blue'
                    type='bare'
                    size='l'
                    label={t('Next')}
                    endIcon='angle-right'
                  />
                )}
              </div>
            )}

            <div className='submission-modal-actions'>
              <Checkbox
                checked={this.state.showXMLNames}
                onChange={this.onShowXMLNamesChange.bind(this)}
                label={t('Display XML names')}
              />

              {(userCan('change_submissions', this.props.asset) ||
                userHasPermForSubmission(
                  'change_submissions',
                  this.props.asset,
                  this.state.submission
                )) && (
                <Button
                  onClick={this.launchEditSubmission.bind(this)}
                  color='blue'
                  type='full'
                  size='l'
                  isDisabled={!this.isSubmissionEditable()}
                  className='submission-duplicate__button'
                  label={this.state.isEditLoading ? t('Loading…') : t('Edit')}
                />
              )}

              {(userCan('view_submissions', this.props.asset) ||
                userHasPermForSubmission(
                  'view_submissions',
                  this.props.asset,
                  this.state.submission
                )) && (
                <Button
                  onClick={this.launchViewSubmission.bind(this)}
                  color='blue'
                  type='full'
                  size='l'
                  isDisabled={this.state.isViewLoading}
                  className='submission-duplicate__button'
                  label={this.state.isViewLoading ? t('Loading…') : t('View')}
                />
              )}

              {(userCan('change_submissions', this.props.asset) ||
                userHasPermForSubmission(
                  'change_submissions',
                  this.props.asset,
                  this.state.submission
                )) && (
                <Button
                  onClick={this.duplicateSubmission.bind(this)}
                  color='blue'
                  type='full'
                  size='l'
                  isDisabled={!this.isSubmissionEditable()}
                  className='submission-duplicate__button'
                  label={t('Duplicate')}
                />
              )}

              <Button
                onClick={launchPrinting}
                color='storm'
                type='bare'
                size='l'
                startIcon='print'
                className='report-button__print'
                tooltip={t('Print')}
                tooltipPosition='right'
              />

              {(userCan('delete_submissions', this.props.asset) ||
                userHasPermForSubmission(
                  'delete_submissions',
                  this.props.asset,
                  this.state.submission
                )) && (
                <Button
                  onClick={this.deleteSubmission.bind(this)}
                  color='red'
                  type='bare'
                  size='l'
                  startIcon='trash'
                  tooltip={t('Delete submission')}
                  tooltipPosition='right'
                />
              )}
            </div>
          </section>

          {this.state.submission && (
            <SubmissionDataTable
              asset={this.props.asset}
              submissionData={this.state.submission}
              translationIndex={this.state.translationIndex}
              showXMLNames={this.state.showXMLNames}
            />
          )}
        </>
      );
    }

    return null;
  }
}

export default SubmissionModal;
