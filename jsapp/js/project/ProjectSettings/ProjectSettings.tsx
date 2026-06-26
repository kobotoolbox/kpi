import clonedeep from 'lodash.clonedeep'
import { when } from 'mobx'
import React from 'react'
import autoBind from 'react-autobind'
import reactMixin from 'react-mixin'
import { actions } from '#/actions'
import { handleApiFail } from '#/api'
import { archiveAsset, unarchiveAsset } from '#/assetQuickActions'
import assetUtils from '#/assetUtils'
import { openDeleteAssetModal } from '#/components/DeleteAssetModal/openDeleteAssetModal'
import InlineMessage from '#/components/common/inlineMessage'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { LockingRestrictionName } from '#/components/locking/lockingConstants'
import { hasAssetRestriction } from '#/components/locking/lockingUtils'
import { NAME_MAX_LENGTH, PROJECT_SETTINGS_CONTEXTS } from '#/constants'
import type { AssetResponse, LabelValuePair } from '#/dataInterface'
import { dataInterface } from '#/dataInterface'
import { applyFileToAsset, applyUrlToAsset } from '#/dropzone.utils'
import mixins from '#/mixins'
import pageState from '#/pageState.store'
import { router, withRouter } from '#/router/legacy'
import { ROUTES } from '#/router/routerConstants'
import sessionStore from '#/stores/session'
import { escapeHtml, isAValidUrl, join, notify } from '#/utils'
import styles from './ProjectSettings.module.scss'
import { STEPS, type StepName, getStepTitle } from './constants'
import StepChooseTemplate from './steps/StepChooseTemplate'
import StepFormSource from './steps/StepFormSource'
import StepImportUrl from './steps/StepImportUrl'
import StepProjectDetails from './steps/StepProjectDetails'
import StepUploadFile from './steps/StepUploadFile'
import type { ProjectSettingsProps, ProjectSettingsState } from './types'
import { getFilenameFromURI, getInitialFieldsFromAsset, getSettingsForEndpoint, validateProjectFields } from './utils'

/**
 * This is used for multiple different purposes:
 *
 * 1. When creating new project from scratch
 * 2. When creating new project from template
 * 3. When replacing project with new one
 * 4. When editing project in /settings
 *
 * Identifying the purpose is done by checking `context` and `formAsset`.
 *
 * You can listen to field changes by `onProjectDetailsChange` prop function.
 *
 * NOTE: We have multiple components with similar form:
 * - ProjectSettings
 * - AccountSettingsRoute
 * - LibraryAssetForm
 */
class ProjectSettings extends React.Component<ProjectSettingsProps, ProjectSettingsState> {
  private unlisteners: Function[] = []

  constructor(props: ProjectSettingsProps) {
    super(props)

    this.unlisteners = []

    this.state = {
      isSessionLoaded: !!sessionStore.isLoggedIn,
      isSubmitPending: false,
      formAsset: this.props.formAsset,
      // project details
      fields: getInitialFieldsFromAsset(this.props.formAsset),
      fieldsWithErrors: [],
      // steps
      currentStep: null,
      previousStep: null,
      // importing url
      isImportFromURLPending: false,
      importUrl: '',
      importUrlButtonEnabled: false,
      importUrlButton: t('Import'),
      // template
      isApplyTemplatePending: false,
      applyTemplateButton: t('Next'),
      chosenTemplateUid: this.props.initialTemplateUid || null,
      pendingTemplateCloneUid: null,
      // upload files
      isUploadFilePending: false,
      // archive flow
      isAwaitingArchiveCompleted: false,
      isAwaitingUnarchiveCompleted: false,
    }

    autoBind(this)
  }

  /*
   * setup
   */

  componentDidMount() {
    this.setInitialStep()
    // If an initial template is provided, apply it immediately
    if (this.props.initialTemplateUid && this.props.context === PROJECT_SETTINGS_CONTEXTS.NEW) {
      this.cloneTemplateAsSurvey(this.props.initialTemplateUid)
    }
    when(
      () => sessionStore.isInitialLoadComplete,
      () => {
        this.setState({ isSessionLoaded: true })
      },
    )
    this.unlisteners.push(
      actions.resources.loadAsset.completed.listen(this.onLoadAssetCompleted.bind(this)),
      actions.resources.updateAsset.completed.listen(this.onUpdateAssetCompleted.bind(this)),
      actions.resources.updateAsset.failed.listen(this.onUpdateAssetFailed.bind(this)),
      actions.resources.setDeploymentActive.failed.listen(this.onSetDeploymentActiveFailed.bind(this)),
      actions.resources.setDeploymentActive.completed.listen(this.onSetDeploymentActiveCompleted.bind(this)),
      router!.subscribe(this.onRouteChange.bind(this)),
    )
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb()
    })
  }

  applyAssetToState(asset: AssetResponse) {
    this.setState({
      fields: getInitialFieldsFromAsset(asset),
      isUploadFilePending: false,
      isImportFromURLPending: false,
      formAsset: asset,
    })
  }

  setInitialStep() {
    switch (this.props.context) {
      case PROJECT_SETTINGS_CONTEXTS.NEW:
      case PROJECT_SETTINGS_CONTEXTS.REPLACE:
        // If an initial template is provided, keep currentStep null to show spinner
        // until the clone completes, then onCloneAssetCompleted will show PROJECT_DETAILS
        if (this.props.initialTemplateUid && this.props.context === PROJECT_SETTINGS_CONTEXTS.NEW) {
          return
        }
        return this.displayStep(STEPS.FORM_SOURCE)
      case PROJECT_SETTINGS_CONTEXTS.EXISTING:
        return this.displayStep(STEPS.PROJECT_DETAILS)
      default:
        throw new Error(`Unknown context: ${this.props.context}!`)
    }
  }

  getBaseTitle() {
    switch (this.props.context) {
      case PROJECT_SETTINGS_CONTEXTS.NEW:
        return t('Create project')
      case PROJECT_SETTINGS_CONTEXTS.REPLACE:
        return t('Replace form')
      case PROJECT_SETTINGS_CONTEXTS.EXISTING:
      default:
        return t('Project settings')
    }
  }

  isLoading() {
    return (
      !this.state.isSessionLoaded ||
      !this.state.currentStep ||
      // this checks if the modal is about existing asset
      // that is not fully loaded yet
      (this.props.context !== PROJECT_SETTINGS_CONTEXTS.NEW && typeof this.state.formAsset?.content === 'undefined')
    )
  }

  isReplacingFormLocked() {
    return (
      this.props.context === PROJECT_SETTINGS_CONTEXTS.REPLACE &&
      this.state.formAsset?.content &&
      hasAssetRestriction(this.state.formAsset.content, LockingRestrictionName.form_replace)
    )
  }

  /*
   * handling user input
   */

  onAnyFieldChange(fieldName: string, newFieldValue: string | string[] | LabelValuePair | LabelValuePair[] | null) {
    // Deep clone state to avoid mutations (React best practice)
    const newStateObj: ProjectSettingsState = clonedeep(this.state) as ProjectSettingsState

    // Check if this is an admin-configured extra field or a standard field
    if (newStateObj.fields.extra_metadata_fields?.hasOwnProperty(fieldName)) {
      newStateObj.fields.extra_metadata_fields[fieldName] = newFieldValue as string | string[] | null
    } else {
      // Type-safe field assignment - switch ensures we handle each field correctly
      // This replaces the previous `as any` type escape and catches typos at compile time
      switch (fieldName) {
        case 'name':
        case 'description':
          newStateObj.fields[fieldName] = newFieldValue as string
          break
        case 'sector':
        case 'operational_purpose':
        case 'collects_pii':
          newStateObj.fields[fieldName] = newFieldValue as LabelValuePair | null
          break
        case 'country':
          // Country is special - it's a multi-select so expects an array
          newStateObj.fields[fieldName] = newFieldValue as LabelValuePair[] | null
          break
      }
    }

    // Clear error for this field when user starts editing it
    // New validation will run on submit if the value is still invalid
    if (this.hasFieldError(fieldName)) {
      newStateObj.fieldsWithErrors = newStateObj.fieldsWithErrors.filter(
        (fieldWithErrorName) => fieldWithErrorName !== fieldName,
      )
    }

    this.setState(newStateObj)

    if (typeof this.props.onProjectDetailsChange === 'function') {
      this.props.onProjectDetailsChange({
        fieldName: fieldName,
        fieldValue: newFieldValue,
      })
    }
  }

  onNameChange(newValue: string) {
    this.onAnyFieldChange('name', assetUtils.removeInvalidChars(newValue).slice(0, NAME_MAX_LENGTH))
  }

  onDescriptionChange(newValue: string) {
    this.onAnyFieldChange('description', assetUtils.removeInvalidChars(newValue))
  }

  onImportUrlChange(value: string) {
    this.setState({
      importUrl: value,
      importUrlButtonEnabled: isAValidUrl(value),
      importUrlButton: t('Import'),
    })
  }

  onTemplateChange(templateUid: string) {
    this.setState({
      chosenTemplateUid: templateUid,
    })
  }

  resetApplyTemplateButton() {
    this.setState({
      isApplyTemplatePending: false,
      applyTemplateButton: t('Choose'),
    })
  }

  resetImportUrlButton() {
    this.setState({
      isImportFromURLPending: false,
      importUrlButtonEnabled: false,
      importUrlButton: t('Import'),
    })
  }

  deleteProject(evt: React.MouseEvent<HTMLButtonElement>) {
    evt.preventDefault()

    openDeleteAssetModal(this.state.formAsset!, this.state.formAsset!.name, this.goToProjectsList.bind(this))
  }

  // archive flow

  isArchivable() {
    return this.state.formAsset?.deployment_status === 'deployed'
  }

  isArchived() {
    return this.state.formAsset?.deployment_status === 'archived'
  }

  archiveProject(evt: React.MouseEvent<HTMLButtonElement>) {
    evt.preventDefault()
    archiveAsset(this.state.formAsset!)
    this.setState({ isAwaitingArchiveCompleted: true })
  }

  unarchiveProject(evt: React.MouseEvent<HTMLButtonElement>) {
    evt.preventDefault()
    unarchiveAsset(this.state.formAsset!)
    this.setState({ isAwaitingUnarchiveCompleted: true })
  }

  onSetDeploymentActiveFailed() {
    this.setState({
      isAwaitingArchiveCompleted: false,
      isAwaitingUnarchiveCompleted: false,
    })
  }

  // when archiving/unarchiving finishes, take user to a route that makes sense
  // unless user navigates by themselves before that happens
  onSetDeploymentActiveCompleted() {
    if (this.state.isAwaitingArchiveCompleted) {
      this.goToProjectsList()
    }
    if (this.state.isAwaitingUnarchiveCompleted) {
      this.goToFormLanding()
    }
    this.setState({
      isAwaitingArchiveCompleted: false,
      isAwaitingUnarchiveCompleted: false,
    })
  }

  onRouteChange() {
    this.setState({
      isAwaitingArchiveCompleted: false,
      isAwaitingUnarchiveCompleted: false,
    })
  }

  /*
   * routes navigation
   */

  goToFormBuilder(assetUid: string) {
    pageState.hideModal()
    this.props.router.navigate(`/forms/${assetUid}/edit`)
  }

  goToFormLanding() {
    pageState.hideModal()

    let targetUid
    if (this.state.formAsset) {
      targetUid = this.state.formAsset.uid
    } else if (this.props.router.params.assetid) {
      targetUid = this.props.router.params.assetid
    } else if (this.props.router.params.uid) {
      targetUid = this.props.router.params.uid
    }

    if (!targetUid) {
      throw new Error('Unknown uid!')
    }

    this.props.router.navigate(ROUTES.FORM_LANDING.replace(':uid', targetUid))
  }

  goToProjectsList() {
    pageState.hideModal()
    this.props.router.navigate(ROUTES.FORMS)
  }

  /*
   * modal steps navigation
   */

  displayStep(targetStep: StepName) {
    const currentStep = this.state.currentStep
    const previousStep = this.state.previousStep

    // No-op if we're already on this step
    if (targetStep === currentStep) {
      return
    } else if (targetStep === previousStep) {
      // Going back: swap current and previous (like a stack pop)
      this.setState({
        currentStep: previousStep,
        previousStep: null,
      })
    } else {
      // Going forward: push current step to history
      this.setState({
        currentStep: targetStep,
        previousStep: currentStep,
      })
    }

    // Update modal title if parent component provides a callback
    // (Used by BigModal to show "Create project: Upload XLSForm" etc.)
    if (this.props.onSetModalTitle) {
      const stepTitle = getStepTitle(targetStep)
      const baseTitle = this.getBaseTitle()
      this.props.onSetModalTitle(`${baseTitle}: ${stepTitle}`)
    }
  }

  displayPreviousStep() {
    if (this.state.previousStep) {
      this.displayStep(this.state.previousStep)
    }
  }

  /*
   * handling asset creation
   */

  onLoadAssetCompleted(response: AssetResponse) {
    if (this.state.formAsset?.uid === response.uid) {
      this.setState({ formAsset: response })
    }
  }

  onUpdateAssetCompleted(response: AssetResponse) {
    if (
      this.props.context === PROJECT_SETTINGS_CONTEXTS.REPLACE ||
      this.props.context === PROJECT_SETTINGS_CONTEXTS.NEW
    ) {
      this.goToFormLanding()
    }

    // This handles the case when the asset was edited outside the Settings,
    // e.g. the title editor in the header.
    if (this.props.context === PROJECT_SETTINGS_CONTEXTS.EXISTING && response.uid === this.state.formAsset?.uid) {
      this.setState({
        formAsset: response,
        fields: getInitialFieldsFromAsset(response),
      })
    }
  }

  onUpdateAssetFailed() {
    if (
      this.props.context === PROJECT_SETTINGS_CONTEXTS.REPLACE ||
      this.props.context === PROJECT_SETTINGS_CONTEXTS.NEW
    ) {
      this.resetApplyTemplateButton()
    }
  }

  getOrCreateFormAsset() {
    const assetPromise = new Promise<AssetResponse>((resolve, reject) => {
      if (this.state.formAsset) {
        resolve(this.state.formAsset)
      } else {
        dataInterface
          .createResource({
            asset_type: 'empty',
          })
          .done((asset: AssetResponse) => {
            resolve(asset)
          })
          .fail((r: JQuery.jqXHR) => {
            reject(t('Error: asset could not be created.') + ` (code: ${r.statusText})`)
          })
      }
    })
    return assetPromise
  }

  createAssetAndOpenInBuilder() {
    dataInterface
      .createResource({
        name: this.state.fields.name,
        settings: getSettingsForEndpoint(this.state.fields),
        asset_type: 'survey',
      })
      .done((asset: AssetResponse) => {
        this.goToFormBuilder(asset.uid)
      })
      .fail((r: JQuery.jqXHR) => {
        notify.error(t('Error: new project could not be created.') + ` (code: ${r.statusText})`)
      })
  }

  updateAndOpenAsset() {
    actions.resources.updateAsset(this.state.formAsset!.uid, {
      name: this.state.fields.name,
      settings: getSettingsForEndpoint(this.state.fields),
    })
  }

  cloneTemplateAsSurvey(templateUid: string) {
    this.setState({
      isApplyTemplatePending: true,
      applyTemplateButton: t('Please wait…'),
      // Track which template we're cloning to prevent race conditions
      pendingTemplateCloneUid: templateUid,
    })

    // Use dataInterface directly instead of actions to get promise-based control flow
    // This avoids race conditions with global action listeners that might trigger
    // before we're ready to process the result
    dataInterface
      .cloneAsset({
        uid: templateUid,
        new_asset_type: 'survey',
      })
      .done((asset: AssetResponse) => {
        // Race condition protection: only process if we're still waiting for THIS template
        // (User might have clicked another template while this one was loading)
        if (this.state.pendingTemplateCloneUid === templateUid) {
          this.setState({
            formAsset: asset,
            fields: getInitialFieldsFromAsset(asset),
            pendingTemplateCloneUid: null,
          })
          this.resetApplyTemplateButton()
          this.displayStep(STEPS.PROJECT_DETAILS)
        }
      })
      .fail(() => {
        if (this.state.pendingTemplateCloneUid === templateUid) {
          this.setState({ pendingTemplateCloneUid: null })
          this.resetApplyTemplateButton()
          notify.error(t('Failed to apply template.'))
          // Special case: if this was an auto-applied template from initialTemplateUid,
          // close the modal since the user was directed here for that specific template
          if (this.props.initialTemplateUid === templateUid) {
            pageState.hideModal()
          }
        }
      })
  }

  applyTemplate(evt: React.MouseEvent<HTMLButtonElement>) {
    evt.preventDefault()

    const templateUid = this.state.chosenTemplateUid

    if (this.props.context === PROJECT_SETTINGS_CONTEXTS.REPLACE) {
      this.setState({
        isApplyTemplatePending: true,
        applyTemplateButton: t('Please wait…'),
      })
      actions.resources.updateAsset(this.state.formAsset!.uid, {
        clone_from: templateUid!,
        name: this.state.formAsset!.name,
      })
    } else {
      this.cloneTemplateAsSurvey(templateUid!)
    }
  }

  importFromURL(evt: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) {
    evt.preventDefault()

    if (isAValidUrl(this.state.importUrl)) {
      this.setState({
        isImportFromURLPending: true,
        importUrlButtonEnabled: false,
        importUrlButton: t('Retrieving form, please wait...'),
      })

      this.getOrCreateFormAsset().then(
        (asset) => {
          this.setState({ formAsset: asset })
          const importUrl = this.state.importUrl

          applyUrlToAsset(importUrl, asset).then(
            (data) => {
              dataInterface
                .getAsset({ id: data.uid })
                .done((finalAsset: AssetResponse) => {
                  if (this.props.context === PROJECT_SETTINGS_CONTEXTS.REPLACE) {
                    // when replacing, we omit PROJECT_DETAILS step
                    this.goToFormLanding()
                  } else {
                    this.applyAssetToState(finalAsset)
                    this.displayStep(STEPS.PROJECT_DETAILS)
                  }
                })
                .fail(() => {
                  this.resetImportUrlButton()
                  notify.error(t('Failed to reload project after import!'))
                })
            },
            (response) => {
              this.resetImportUrlButton()
              this.notifyImportFailure(response, importUrl ? getFilenameFromURI(importUrl) : null)
            },
          )
        },
        () => {
          notify.error(t('Could not initialize XLSForm import!'))
        },
      )
    }
  }

  notifyImportFailure(response: any, sourceName: string | null) {
    const messages = response?.messages || response?.responseJSON?.messages
    const errorType = messages?.error_type
    const importError = messages?.error

    if (importError) {
      const errLines: Array<string | JSX.Element> = [t('Import Failed!')]
      if (sourceName) {
        errLines.push(<code key='name'>Name: {sourceName}</code>)
      }
      errLines.push(
        <code key='error'>
          {errorType}: {escapeHtml(importError)}
        </code>,
      )
      // join returns an array of React nodes (strings and JSX elements with <br /> separators)
      const message = <>{join(errLines, <br />)}</>
      notify.error(message)
    } else {
      handleApiFail(response, t('Import Failed!'))
    }
  }

  onFileDrop(files: File[]) {
    if (files.length >= 1) {
      this.setState({ isUploadFilePending: true })

      this.getOrCreateFormAsset().then(
        (asset) => {
          applyFileToAsset(files[0], asset).then(
            (data) => {
              dataInterface
                .getAsset({ id: data.uid })
                .done((finalAsset: AssetResponse) => {
                  // WORKAROUND: dataInterface.getAsset() bypasses the action/store pattern,
                  // so components listening to assetStore won't be notified of the new asset.
                  // We manually trigger the action listener here to maintain consistency.
                  // TODO: Refactor to use actions.resources.loadAsset throughout this flow.
                  // See: https://github.com/kobotoolbox/kpi/issues/3919
                  actions.resources.loadAsset.completed(finalAsset)

                  if (this.props.context === PROJECT_SETTINGS_CONTEXTS.REPLACE) {
                    // when replacing, we omit PROJECT_DETAILS step
                    this.goToFormLanding()
                  } else {
                    this.applyAssetToState(finalAsset)
                    this.displayStep(STEPS.PROJECT_DETAILS)
                  }
                })
                .fail(() => {
                  this.setState({ isUploadFilePending: false })
                  notify.error(t('Failed to reload project after upload!'))
                })
            },
            (response) => {
              this.setState({ isUploadFilePending: false })
              this.notifyImportFailure(response, files[0]?.name)
            },
          )
        },
        () => {
          this.setState({ isUploadFilePending: false })
          notify.error(t('Could not import XLSForm!'))
        },
      )
    }
  }

  hasFieldError(fieldName: string) {
    return this.state.fieldsWithErrors.includes(fieldName)
  }

  handleSubmit(evt: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) {
    evt.preventDefault()

    const fieldsWithErrors = validateProjectFields(this.state.fields)

    this.setState({ fieldsWithErrors })

    if (fieldsWithErrors.length >= 1) {
      notify.error(t('Some fields contain errors!'))
      return
    }

    this.setState({ isSubmitPending: true })

    if (this.state.formAsset) {
      this.updateAndOpenAsset()
    } else {
      this.createAssetAndOpenInBuilder()
    }
  }

  /*
   * rendering
   */

  render() {
    if (this.isLoading()) {
      return <LoadingSpinner />
    }

    if (this.isReplacingFormLocked()) {
      return (
        <InlineMessage
          type='warning'
          icon='alert'
          message={t("Form replacing is not available due to form's Locking Profile restrictions.")}
        />
      )
    }

    const modalStyle = this.props.context !== PROJECT_SETTINGS_CONTEXTS.EXISTING ? styles.modal : null
    const isBackDisabled =
      this.state.isSubmitPending ||
      this.state.isApplyTemplatePending ||
      this.state.isImportFromURLPending ||
      this.state.isUploadFilePending

    switch (this.state.currentStep) {
      case STEPS.FORM_SOURCE:
        return (
          <StepFormSource
            context={this.props.context}
            modalStyle={modalStyle}
            onSelectStep={this.displayStep.bind(this)}
          />
        )

      case STEPS.CHOOSE_TEMPLATE:
        return (
          <StepChooseTemplate
            chosenTemplateUid={this.state.chosenTemplateUid}
            onTemplateChange={this.onTemplateChange.bind(this)}
            applyTemplateButton={this.state.applyTemplateButton}
            isApplyTemplatePending={this.state.isApplyTemplatePending}
            onApplyTemplate={this.applyTemplate.bind(this)}
            previousStep={this.state.previousStep}
            onBack={this.displayPreviousStep.bind(this)}
            isBackDisabled={isBackDisabled}
            modalStyle={modalStyle}
          />
        )

      case STEPS.UPLOAD_FILE:
        return (
          <StepUploadFile
            isUploadFilePending={this.state.isUploadFilePending}
            onFileDrop={this.onFileDrop.bind(this)}
            previousStep={this.state.previousStep}
            onBack={this.displayPreviousStep.bind(this)}
            modalStyle={modalStyle}
          />
        )

      case STEPS.IMPORT_URL:
        return (
          <StepImportUrl
            importUrl={this.state.importUrl}
            onImportUrlChange={this.onImportUrlChange.bind(this)}
            importUrlButton={this.state.importUrlButton}
            importUrlButtonEnabled={this.state.importUrlButtonEnabled}
            onImportFromURL={this.importFromURL.bind(this)}
            previousStep={this.state.previousStep}
            onBack={this.displayPreviousStep.bind(this)}
            isBackDisabled={isBackDisabled}
            modalStyle={modalStyle}
          />
        )

      case STEPS.PROJECT_DETAILS:
        return (
          <StepProjectDetails
            context={this.props.context}
            fields={this.state.fields}
            formAsset={this.state.formAsset}
            isSubmitPending={this.state.isSubmitPending}
            hasFieldError={this.hasFieldError.bind(this)}
            onNameChange={this.onNameChange.bind(this)}
            onDescriptionChange={this.onDescriptionChange.bind(this)}
            onAnyFieldChange={this.onAnyFieldChange.bind(this)}
            onSubmit={this.handleSubmit.bind(this)}
            onArchiveProject={this.archiveProject.bind(this)}
            onUnarchiveProject={this.unarchiveProject.bind(this)}
            onDeleteProject={this.deleteProject.bind(this)}
            isArchivable={this.isArchivable.bind(this)}
            isArchived={this.isArchived.bind(this)}
            previousStep={this.state.previousStep}
            onBack={this.displayPreviousStep.bind(this)}
            modalStyle={modalStyle}
          />
        )

      default:
        throw new Error(`Unknown step: ${this.state.currentStep}!`)
    }
  }
}

// NOTE: dmix mixin is causing a full asset load after component mounts
reactMixin(ProjectSettings.prototype, mixins.dmix)

export default withRouter(ProjectSettings)
