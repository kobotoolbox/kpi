import './submissionDetails.scss'

import React from 'react'

import alertify from 'alertifyjs'
import clonedeep from 'lodash.clonedeep'
import { actions } from '#/actions'
import Button from '#/components/common/button'
import Checkbox from '#/components/common/checkbox'
import KoboSelect from '#/components/common/koboSelect'
import { userCan, userHasPermForSubmission } from '#/components/permissions/utils'
import SubmissionDataTable from '#/components/submissions/single/submissionDataTable'
import { getBackgroundAudioAttachment, markAttachmentAsDeleted } from '#/components/submissions/submissionUtils'
import {
  VALIDATION_STATUS_OPTIONS,
  ValidationStatusAdditionalName,
} from '#/components/submissions/validationStatus.constants'
import type { ValidationStatusOptionName } from '#/components/submissions/validationStatus.constants'
import { EnketoActions } from '#/constants'
import type { AssetResponse, SubmissionResponse, ValidationStatusResponse } from '#/dataInterface'
import enketoHandler from '#/enketoHandler'
import { launchPrinting } from '#/utils'
import SubmissionBackgroundAudio from './SubmissionBackgroundAudio'

interface SubmissionDetailsProps {
  asset: AssetResponse
  /** The record to display. Loading and error states are the route's business. */
  submission: SubmissionResponse
  /**
   * Root UUID of the record this one was duplicated from, set only for as long
   * as the user stays on the record the duplication produced.
   */
  duplicatedFromUuid?: string
  /** Asks for a fresh copy of `submission`, e.g. after an edit in Enketo. */
  onRefreshRequested: () => void
  onDeleted: () => void
  /** @param newSubmissionDbId - `_id` of the record the duplication produced. */
  onDuplicated: (newSubmissionDbId: string, duplicatedFromUuid: string) => void
}

interface TranslationOption {
  /** Empty string means unnamed language */
  value: string | ''
  label: string
}

interface SubmissionDetailsState {
  /**
   * A working copy of `props.submission`. Some changes (a new validation status,
   * a deleted attachment) come back to us in full from their own endpoint, so we
   * apply them here instead of asking for the whole record again.
   */
  submission: SubmissionResponse
  isEnketoEditLoading: boolean
  isEnketoViewLoading: boolean
  isEditingDuplicate: boolean
  isRefreshNeeded: boolean
  translationIndex: number
  translationOptions: TranslationOption[]
  showXMLNames: boolean
  isValidationStatusChangePending: boolean
}

/**
 * Displays the details of a single submission, and the actions that can be taken
 * on it. Rendered by the submission route, which owns loading the record and
 * moving between records.
 *
 * TODO: the duplicating flow should be somehow decoupled from this component, as
 * it increases already complex code.
 */
export default class SubmissionDetails extends React.Component<SubmissionDetailsProps, SubmissionDetailsState> {
  private unlisteners: Function[] = []

  constructor(props: SubmissionDetailsProps) {
    super(props)
    const translations = this.props.asset.content?.translations
    let translationOptions: TranslationOption[] = []

    if (translations && translations.length > 1) {
      translationOptions = translations.map((trns) => {
        return {
          value: trns || '',
          label: trns || t('Unnamed language'),
        }
      })
    }

    this.state = {
      submission: props.submission,
      isEnketoEditLoading: false,
      isEnketoViewLoading: false,
      isEditingDuplicate: false,
      isRefreshNeeded: false,
      translationIndex: 0,
      translationOptions: translationOptions,
      showXMLNames: false,
      isValidationStatusChangePending: false,
    }
  }

  componentDidMount() {
    this.unlisteners.push(
      actions.resources.updateSubmissionValidationStatus.completed.listen(
        this.refreshSubmissionValidationStatus.bind(this),
      ),
      actions.resources.removeSubmissionValidationStatus.completed.listen(
        this.refreshSubmissionValidationStatus.bind(this),
      ),
      actions.resources.deleteSubmission.completed.listen(this.onDeletedSubmissionCompleted.bind(this)),
      actions.resources.duplicateSubmission.completed.listen(this.onDuplicateSubmissionCompleted.bind(this)),
    )
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb()
    })
  }

  componentDidUpdate(prevProps: SubmissionDetailsProps) {
    // A fresh record replaces whatever we had patched in the meantime.
    if (prevProps.submission !== this.props.submission) {
      this.setState({ submission: this.props.submission })
    }
  }

  /** `_id` of the displayed record, in the string form the endpoints expect. */
  get sid() {
    return String(this.state.submission._id)
  }

  get isDuplicated() {
    return Boolean(this.props.duplicatedFromUuid)
  }

  /**
   * A callback for submission validation status changes. We use the response
   * to update the in-memory submission data (to avoid making another call).
   */
  refreshSubmissionValidationStatus(result: ValidationStatusResponse) {
    this.setState({ isValidationStatusChangePending: false })

    const newSubmissionData = clonedeep(this.state.submission)

    if (result && result.uid) {
      newSubmissionData._validation_status = result
    } else {
      newSubmissionData._validation_status = {}
    }

    this.setState({ submission: newSubmissionData })
  }

  /**
   * Whether the submission is editable at this moment. It takes into account
   * current user permissions and few other properties.
   */
  isSubmissionEditable() {
    return (
      this.props.asset.deployment__active &&
      !this.state.isEnketoEditLoading &&
      (userCan('change_submissions', this.props.asset) ||
        userHasPermForSubmission('change_submissions', this.props.asset, this.state.submission))
    )
  }

  /**
   * Displays a prompt for confirming deletion.
   *
   * TODO: use KoboPrompt instead of alertify. Also make the prompt delete
   * button `isPending` while it waits for the call to finish, as currently
   * there is no indication that app is doing anything in the meantime (bad UX).
   */
  deleteSubmission() {
    const dialog = alertify.dialog('confirm')
    const opts = {
      title: t('Delete submission?'),
      message: `${t('Are you sure you want to delete this submission?')} ${t('This action cannot be undone')}.`,
      labels: { ok: t('Delete'), cancel: t('Cancel') },
      onok: () => {
        actions.resources.deleteSubmission(this.props.asset.uid, this.sid)
      },
      oncancel: () => {
        dialog.destroy()
      },
    }
    dialog.set(opts).show()
  }

  onDeletedSubmissionCompleted() {
    // The record we are displaying is gone, so there is nothing to stay for.
    this.props.onDeleted()
  }

  onDuplicateSubmissionCompleted(_assetUid: string, newSubmissionDbId: string, duplicatedFrom: SubmissionResponse) {
    this.props.onDuplicated(String(newSubmissionDbId), duplicatedFrom['meta/rootUuid'] || duplicatedFrom._uuid)
  }

  /**
   * Opens current submission as editable in Enketo (in new browser tab). After
   * using Enketo and saving the submission, you will notice "Refresh" button
   * appearing - please use it to ensure you see that submission data you've
   * just modified.
   */
  launchEditSubmission() {
    this.setState({
      isRefreshNeeded: true,
      isEnketoEditLoading: true,
      isEditingDuplicate: true,
    })
    enketoHandler.openSubmission(this.props.asset.uid, this.sid, EnketoActions.edit).then(
      () => {
        this.setState({ isEnketoEditLoading: false })
      },
      () => {
        this.setState({ isEnketoEditLoading: false })
      },
    )
  }

  /**
   * Opens current submission as view-only in Enketo (in new browser tab).
   */
  launchViewSubmission() {
    this.setState({ isEnketoViewLoading: true })
    enketoHandler.openSubmission(this.props.asset.uid, this.sid, EnketoActions.view).then(
      () => {
        this.setState({ isEnketoViewLoading: false })
      },
      () => {
        this.setState({ isEnketoViewLoading: false })
      },
    )
  }

  duplicateSubmission() {
    actions.resources.duplicateSubmission(this.props.asset.uid, this.sid, this.state.submission)
  }

  /** Asks the route for fresh submission data. */
  triggerRefresh() {
    this.setState({ isRefreshNeeded: false })
    this.props.onRefreshRequested()
  }

  onShowXMLNamesChange(newValue: boolean) {
    this.setState({ showXMLNames: newValue })
  }

  onValidationStatusChange(newValidationStatus: ValidationStatusOptionName) {
    // `null` is not possible, because we have `isClearable={false}`, but TypeScript
    // keeps complaining
    if (newValidationStatus === null) {
      return
    }

    this.setState({ isValidationStatusChangePending: true })

    if (newValidationStatus === ValidationStatusAdditionalName.no_status) {
      actions.resources.removeSubmissionValidationStatus(this.props.asset.uid, this.sid)
    } else {
      actions.resources.updateSubmissionValidationStatus(this.props.asset.uid, this.sid, {
        'validation_status.uid': newValidationStatus,
      })
    }
  }

  onLanguageChange(newValue: string | null) {
    const index = this.state.translationOptions.findIndex((x) => x.value === newValue)
    this.setState({
      translationIndex: index || 0,
    })
  }

  handleDeletedAttachment(attachmentUid: string) {
    // Override the attachment object in memory to mark it as deleted (without
    // making an API call for fresh submission data)
    this.setState({
      submission: markAttachmentAsDeleted(this.state.submission, attachmentUid) as SubmissionResponse,
    })
  }

  /**
   * Displays language and validation status dropdowns.
   */
  renderDropdowns() {
    if (!this.props.asset.deployment__active) {
      return null
    }

    const selectedOption =
      'uid' in this.state.submission._validation_status ? this.state.submission._validation_status.uid : null

    return (
      <div className='submission-modal-dropdowns'>
        {this.state.translationOptions.length > 1 && (
          <KoboSelect
            label={t('Language')}
            name='submission-modal-language-switcher'
            type='outline'
            size='s'
            options={this.state.translationOptions}
            selectedOption={this.state.translationOptions[this.state.translationIndex].value}
            onChange={(newSelectedOption: string | null) => {
              this.onLanguageChange(newSelectedOption)
            }}
          />
        )}

        <KoboSelect
          label={t('Validation status:')}
          name='submission-modal-validation-status'
          type='outline'
          size='s'
          options={VALIDATION_STATUS_OPTIONS}
          selectedOption={selectedOption}
          onChange={(newSelectedOption: string | null) => {
            if (newSelectedOption !== null) {
              const castOption = newSelectedOption as ValidationStatusOptionName
              this.onValidationStatusChange(castOption)
            } else {
              this.onValidationStatusChange(ValidationStatusAdditionalName.no_status)
            }
          }}
          isPending={this.state.isValidationStatusChangePending}
          isDisabled={
            !(
              userCan('validate_submissions', this.props.asset) ||
              userHasPermForSubmission('validate_submissions', this.props.asset, this.state.submission)
            )
          }
        />
      </div>
    )
  }

  /**
   * Displays some info about duplicated submission and "Edit" and "Discard"
   * action buttons.
   */
  renderDuplicatedSubmissionSubheader() {
    if (!this.isDuplicated || this.state.isEditingDuplicate) {
      return null
    }

    return (
      <section className='submission-modal-message-box duplicated-submission-subheader'>
        <h1 className='submission-duplicate__header'>{t('Duplicate created')}</h1>

        <p className='submission-duplicate__text'>
          {t(
            'A duplicate of the submission record was successfully created. You can view the new instance below and make changes using the action buttons below.',
          )}
        </p>

        <p className='submission-duplicate__text'>
          {t('Source submission uuid:' + ' ')}
          <code>{this.props.duplicatedFromUuid}</code>
        </p>

        <div className='submission-modal-buttons-group'>
          {this.renderEditButton()}

          {(userCan('delete_submissions', this.props.asset) ||
            userHasPermForSubmission('delete_submissions', this.props.asset, this.state.submission)) && (
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
    )
  }

  /**
   * Displays a warning/info message, prompting user to load fresh submission
   * data (because it most probably changed on the Back end)
   */
  renderRefreshWarning() {
    // We only display refresh warning if we need it (e.g. we know user was
    // editing submission in Enketo)
    if (!this.state.isRefreshNeeded) {
      return null
    }

    return (
      <div className='submission-modal-message-box'>
        <p>{t('Click on the button below to load the most recent data for this submission. ')}</p>

        <Button onClick={this.triggerRefresh.bind(this)} type='primary' size='l' label={t('Refresh submission')} />
      </div>
    )
  }

  /**
   * Displays the buttons that allow making changes to the submission.
   */
  renderSubmissionActions() {
    // We hide these elements of UI for duplicated submission flow.
    // TODO: displaying those might be a better UX, we just need to check if
    // everything works, or if it requires some work to make it usable.
    if (this.isDuplicated && !this.state.isEditingDuplicate) {
      return null
    }

    return (
      <section className='submission-modal-buttons'>
        <div className='submission-modal-buttons-group'>
          <Checkbox
            checked={this.state.showXMLNames}
            onChange={this.onShowXMLNamesChange.bind(this)}
            label={t('Display XML names')}
          />
        </div>

        <div className='submission-modal-buttons-group'>
          {this.renderEditButton()}

          <Button
            onClick={this.launchViewSubmission.bind(this)}
            type='primary'
            size='l'
            isDisabled={
              !userCan('view_submissions', this.props.asset) &&
              !userHasPermForSubmission('view_submissions', this.props.asset, this.state.submission)
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
              !userHasPermForSubmission('delete_submissions', this.props.asset, this.state.submission)
            }
          />
        </div>
      </section>
    )
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
    )
  }

  render() {
    // Get background audio
    // Note: we do this here to avoid a weird interaction with onDeleted if we pass the uid back up to this component
    // FIXME: This does not get the audio file if the form turns off background audio (even if there exist submissions)
    const bgAudio = getBackgroundAudioAttachment(this.props.asset, this.state.submission)

    // Each of these `renderX()` functions handle the conditional rendering
    // by itself
    // TODO: Move each of these render functions to a different component to shorten this file
    return (
      <>
        {this.renderDuplicatedSubmissionSubheader()}

        {this.renderRefreshWarning()}

        {this.renderDropdowns()}

        {this.renderSubmissionActions()}

        {this.props.asset.content?.survey && bgAudio && (
          <SubmissionBackgroundAudio
            asset={this.props.asset}
            submission={this.state.submission}
            audio={bgAudio}
            onDeleted={() => this.handleDeletedAttachment(bgAudio?.uid)}
          />
        )}

        <SubmissionDataTable
          asset={this.props.asset}
          submissionData={this.state.submission}
          translationIndex={this.state.translationIndex}
          showXMLNames={this.state.showXMLNames}
          onAttachmentDeleted={this.handleDeletedAttachment.bind(this)}
        />
      </>
    )
  }
}
