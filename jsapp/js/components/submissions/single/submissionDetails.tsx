import './submissionDetails.scss'
import alertify from 'alertifyjs'
import clonedeep from 'lodash.clonedeep'
import React from 'react'
import { actions } from '#/actions'
import { userCan, userHasPermForSubmission } from '#/components/permissions/utils'
import SubmissionDataTable from '#/components/submissions/single/submissionDataTable'
import { getBackgroundAudioAttachment, markAttachmentAsDeleted } from '#/components/submissions/submissionUtils'
import { ValidationStatusAdditionalName } from '#/components/submissions/validationStatus.constants'
import type { ValidationStatusOptionName } from '#/components/submissions/validationStatus.constants'
import { EnketoActions } from '#/constants'
import type { AssetResponse, SubmissionResponse, ValidationStatusResponse } from '#/dataInterface'
import enketoHandler from '#/enketoHandler'
import SubmissionBackgroundAudio from './SubmissionBackgroundAudio'
import SubmissionActions from './submissionActions'
import SubmissionDuplicateBanner from './submissionDuplicateBanner'
import SubmissionLanguageSelect from './submissionLanguageSelect'
import SubmissionRefreshWarning from './submissionRefreshWarning'

interface SubmissionDetailsProps {
  asset: AssetResponse
  /** The record to display. Loading and error states are the route's business. */
  submission: SubmissionResponse
  /**
   * Root UUID of the record this one was duplicated from, set only for as long
   * as the user stays on the record the duplication produced.
   */
  duplicatedFromUuid?: string
  /** Owned by the route, which renders the element that expands. */
  isFullscreen: boolean
  onToggleFullscreen: () => void
  /** Asks for a fresh copy of `submission`, e.g. after an edit in Enketo. */
  onRefreshRequested: () => void
  onDeleted: () => void
  /** @param newSubmissionDbId - `_id` of the record the duplication produced. */
  onDuplicated: (newSubmissionDbId: string, duplicatedFromUuid: string) => void
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
  showXMLNames: boolean
  isValidationStatusChangePending: boolean
}

/**
 * Displays the details of a single submission, and the actions that can be taken
 * on it. Rendered by the submission route, which owns loading the record and
 * moving between records.
 *
 * The pieces of UI live in their own components; what is left here is the state
 * they share and the calls they trigger.
 *
 * TODO: the duplicating flow should be somehow decoupled from this component, as
 * it increases already complex code.
 */
export default class SubmissionDetails extends React.Component<SubmissionDetailsProps, SubmissionDetailsState> {
  private unlisteners: Function[] = []

  constructor(props: SubmissionDetailsProps) {
    super(props)

    this.state = {
      submission: props.submission,
      isEnketoEditLoading: false,
      isEnketoViewLoading: false,
      isEditingDuplicate: false,
      isRefreshNeeded: false,
      translationIndex: 0,
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
   * TODO: use Mantine confirm Modal instead of alertify. Also make the prompt
   * delete button `isPending` while it waits for the call to finish,
   * as currently there is no indication that app is doing anything
   * in the meantime (bad UX).
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
    this.setState({ isValidationStatusChangePending: true })

    if (newValidationStatus === ValidationStatusAdditionalName.no_status) {
      actions.resources.removeSubmissionValidationStatus(this.props.asset.uid, this.sid)
    } else {
      actions.resources.updateSubmissionValidationStatus(this.props.asset.uid, this.sid, {
        'validation_status.uid': newValidationStatus,
      })
    }
  }

  handleDeletedAttachment(attachmentUid: string) {
    // Override the attachment object in memory to mark it as deleted (without
    // making an API call for fresh submission data)
    this.setState({
      submission: markAttachmentAsDeleted(this.state.submission, attachmentUid) as SubmissionResponse,
    })
  }

  render() {
    // Get background audio
    // Note: we do this here to avoid a weird interaction with onDeleted if we pass the uid back up to this component
    // FIXME: This does not get the audio file if the form turns off background audio (even if there exist submissions)
    const bgAudio = getBackgroundAudioAttachment(this.props.asset, this.state.submission)

    // Set while the user is looking at a duplicate they have just created and
    // not accepted yet, which is when the banner takes over the actions.
    const duplicateFlowFromUuid = this.state.isEditingDuplicate ? undefined : this.props.duplicatedFromUuid

    return (
      <>
        {duplicateFlowFromUuid && (
          <SubmissionDuplicateBanner
            asset={this.props.asset}
            submission={this.state.submission}
            duplicatedFromUuid={duplicateFlowFromUuid}
            isEditable={this.isSubmissionEditable()}
            isEditPending={this.state.isEnketoEditLoading}
            onEdit={this.launchEditSubmission.bind(this)}
            onDiscard={this.deleteSubmission.bind(this)}
          />
        )}

        {this.state.isRefreshNeeded && <SubmissionRefreshWarning onRefresh={this.triggerRefresh.bind(this)} />}

        <SubmissionLanguageSelect
          asset={this.props.asset}
          translationIndex={this.state.translationIndex}
          onChange={(translationIndex) => {
            this.setState({ translationIndex })
          }}
        />

        <SubmissionActions
          asset={this.props.asset}
          submission={this.state.submission}
          isInDuplicateFlow={duplicateFlowFromUuid !== undefined}
          isEditable={this.isSubmissionEditable()}
          isEditPending={this.state.isEnketoEditLoading}
          isViewPending={this.state.isEnketoViewLoading}
          isValidationStatusPending={this.state.isValidationStatusChangePending}
          showXMLNames={this.state.showXMLNames}
          onShowXMLNamesChange={this.onShowXMLNamesChange.bind(this)}
          onValidationStatusChange={this.onValidationStatusChange.bind(this)}
          onEdit={this.launchEditSubmission.bind(this)}
          onView={this.launchViewSubmission.bind(this)}
          onDuplicate={this.duplicateSubmission.bind(this)}
          onDelete={this.deleteSubmission.bind(this)}
          isFullscreen={this.props.isFullscreen}
          onToggleFullscreen={this.props.onToggleFullscreen}
        />

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
