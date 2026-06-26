import cx from 'classnames'
import clonedeep from 'lodash.clonedeep'
import { when } from 'mobx'
import React from 'react'
import autoBind from 'react-autobind'
import Dropzone from 'react-dropzone'
import reactMixin from 'react-mixin'
import { actions } from '#/actions'
import { handleApiFail } from '#/api'
import { queryClient } from '#/api/queryClient'
import { getOrganizationsRetrieveQueryKey } from '#/api/react-query/user-team-organization-usage'
import { archiveAsset, unarchiveAsset } from '#/assetQuickActions'
import assetUtils from '#/assetUtils'
import { openDeleteAssetModal } from '#/components/DeleteAssetModal/openDeleteAssetModal'
import Button from '#/components/common/button'
import InlineMessage from '#/components/common/inlineMessage'
import LoadingSpinner from '#/components/common/loadingSpinner'
import TextBox from '#/components/common/textBox'
import WrappedSelect from '#/components/common/wrappedSelect'
import { LockingRestrictionName } from '#/components/locking/lockingConstants'
import { hasAssetRestriction } from '#/components/locking/lockingUtils'
import ExtraProjectMetadataFields from '#/components/modalForms/ExtraProjectMetadataFields'
import styles from '#/components/modalForms/projectSettings.module.scss'
import { userCan } from '#/components/permissions/utils'
import TemplatesList from '#/components/templatesList'
import { EXTRA_PROJECT_METADATA_FIELD_TYPES, NAME_MAX_LENGTH, PROJECT_SETTINGS_CONTEXTS } from '#/constants'
import type { AssetResponse, LabelValuePair } from '#/dataInterface'
import { dataInterface } from '#/dataInterface'
import { applyFileToAsset, applyUrlToAsset } from '#/dropzone.utils'
import envStore from '#/envStore'
import mixins from '#/mixins'
import pageState from '#/pageState.store'
import { router, withRouter } from '#/router/legacy'
import type { WithRouterProps } from '#/router/legacy'
import { ROUTES } from '#/router/routerConstants'
import sessionStore from '#/stores/session'
import { addRequiredToLabel } from '#/textUtils'
import { escapeHtml, isAValidUrl, join, notify, validFileTypes } from '#/utils'

const VIA_URL_SUPPORT_URL = 'xlsform_with_kobotoolbox.html#importing-an-xlsform-via-url'

type ProjectSettingsContext = (typeof PROJECT_SETTINGS_CONTEXTS)[keyof typeof PROJECT_SETTINGS_CONTEXTS]

interface ProjectSettingsFields {
  name: string
  description: string
  sector: LabelValuePair | null
  country: LabelValuePair[] | null
  operational_purpose: LabelValuePair | null
  collects_pii: LabelValuePair | null
  extra_metadata_fields: Record<string, string | string[] | null>
}

interface ProjectSettingsProps extends WithRouterProps {
  context: ProjectSettingsContext
  formAsset?: AssetResponse
  initialTemplateUid?: string | null
  onProjectDetailsChange?: (data: {
    fieldName: string
    fieldValue: string | string[] | LabelValuePair | LabelValuePair[] | null
  }) => void
  onSetModalTitle?: (title: string) => void
}

interface ProjectSettingsState {
  isSessionLoaded: boolean
  isSubmitPending: boolean
  formAsset?: AssetResponse
  fields: ProjectSettingsFields
  fieldsWithErrors: string[]
  currentStep: string | null
  previousStep: string | null
  isImportFromURLPending: boolean
  importUrl: string
  importUrlButtonEnabled: boolean
  importUrlButton: string
  isApplyTemplatePending: boolean
  applyTemplateButton: string
  chosenTemplateUid: string | null
  pendingTemplateCloneUid: string | null
  isUploadFilePending: boolean
  isAwaitingArchiveCompleted: boolean
  isAwaitingUnarchiveCompleted: boolean
}

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
  private STEPS: {
    FORM_SOURCE: string
    CHOOSE_TEMPLATE: string
    UPLOAD_FILE: string
    IMPORT_URL: string
    PROJECT_DETAILS: string
  }

  private unlisteners: Function[] = []

  constructor(props: ProjectSettingsProps) {
    super(props)

    this.STEPS = {
      FORM_SOURCE: 'form-source',
      CHOOSE_TEMPLATE: 'choose-template',
      UPLOAD_FILE: 'upload-file',
      IMPORT_URL: 'import-url',
      PROJECT_DETAILS: 'project-details',
    }

    this.unlisteners = []

    this.state = {
      isSessionLoaded: !!sessionStore.isLoggedIn,
      isSubmitPending: false,
      formAsset: this.props.formAsset,
      // project details
      fields: this.getInitialFieldsFromAsset(this.props.formAsset),
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

  getInitialFieldsFromAsset(asset?: AssetResponse): ProjectSettingsFields {
    const fields: ProjectSettingsFields = {
      name: '',
      description: '',
      sector: null,
      country: null,
      operational_purpose: null,
      collects_pii: null,
      extra_metadata_fields: {},
    }

    fields.name = asset ? asset.name : ''
    fields.description = asset?.settings?.description ?? ''

    const sectorValue = asset?.settings?.sector
    fields.sector =
      sectorValue && typeof sectorValue === 'object' && 'value' in sectorValue ? (sectorValue as LabelValuePair) : null

    const countryValue = asset?.settings?.country
    if (countryValue && Array.isArray(countryValue)) {
      fields.country = countryValue
    } else if (countryValue && typeof countryValue === 'object' && 'value' in countryValue) {
      fields.country = [countryValue as LabelValuePair]
    } else {
      fields.country = null
    }

    fields.operational_purpose = asset?.settings?.operational_purpose ?? null
    fields.collects_pii = asset?.settings?.collects_pii ?? null
    fields.extra_metadata_fields = {}

    envStore.data.extra_project_metadata_fields.forEach((field) => {
      const value = asset?.settings?.extra_metadata?.[field.name]
      const defaultValue =
        field.type === EXTRA_PROJECT_METADATA_FIELD_TYPES.MULTI_SELECT
          ? []
          : field.type === EXTRA_PROJECT_METADATA_FIELD_TYPES.SINGLE_SELECT
            ? null
            : ''

      fields.extra_metadata_fields[field.name] = value !== undefined ? value : defaultValue
    })

    return fields
  }

  /**
   * Function used whenever some endpoint calls return an asset.
   */
  applyAssetToState(asset: AssetResponse) {
    this.setState({
      fields: this.getInitialFieldsFromAsset(asset),
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
        return this.displayStep(this.STEPS.FORM_SOURCE)
      case PROJECT_SETTINGS_CONTEXTS.EXISTING:
        return this.displayStep(this.STEPS.PROJECT_DETAILS)
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

  getStepTitle(step: string) {
    switch (step) {
      case this.STEPS.FORM_SOURCE:
        return t('Choose a source')
      case this.STEPS.CHOOSE_TEMPLATE:
        return t('Choose template')
      case this.STEPS.UPLOAD_FILE:
        return t('Upload XLSForm')
      case this.STEPS.IMPORT_URL:
        return t('Import XLSForm')
      case this.STEPS.PROJECT_DETAILS:
        return t('Project details')
      default:
        return ''
    }
  }

  getFilenameFromURI(url: string) {
    return decodeURIComponent(new URL(url).pathname.split('/').pop()!.split('.')[0])
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
    const newStateObj: ProjectSettingsState = clonedeep(this.state) as ProjectSettingsState

    // Set Value
    if (newStateObj.fields.extra_metadata_fields?.hasOwnProperty(fieldName)) {
      newStateObj.fields.extra_metadata_fields[fieldName] = newFieldValue as string | string[] | null
    } else {
      // Type-safe field assignment by field name
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
          newStateObj.fields[fieldName] = newFieldValue as LabelValuePair[] | null
          break
      }
    }

    // If given field has error and user starts to edit it, we can remove
    // the error and wait for `handleSubmit` to add new ones if necessary.
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

  isMMO() {
    const account = sessionStore.currentAccount
    const orgUid = 'organization' in account ? account.organization?.uid : undefined
    if (orgUid) {
      const orgResponse = queryClient.getQueryData(getOrganizationsRetrieveQueryKey(orgUid)) as any
      if (orgResponse?.status === 200 && orgResponse.data?.is_mmo) {
        return true
      }
    }
    return false
  }

  userCanViewDeleteButton() {
    return this.isMMO() || userCan('delete_asset', this.state.formAsset)
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

  displayStep(targetStep: string) {
    const currentStep = this.state.currentStep
    const previousStep = this.state.previousStep

    if (targetStep === currentStep) {
      return
    } else if (targetStep === previousStep) {
      this.setState({
        currentStep: previousStep,
        previousStep: null,
      })
    } else {
      this.setState({
        currentStep: targetStep,
        previousStep: currentStep,
      })
    }

    if (this.props.onSetModalTitle) {
      const stepTitle = this.getStepTitle(targetStep)
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
        fields: this.getInitialFieldsFromAsset(response),
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

  getSettingsForEndpoint() {
    const settings = {
      description: this.state.fields.description,
      sector: this.state.fields.sector,
      country: this.state.fields.country,
      operational_purpose: this.state.fields.operational_purpose,
      collects_pii: this.state.fields.collects_pii,
      extra_metadata: this.state.fields.extra_metadata_fields,
    }

    return JSON.stringify(settings)
  }

  createAssetAndOpenInBuilder() {
    dataInterface
      .createResource({
        name: this.state.fields.name,
        settings: this.getSettingsForEndpoint(),
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
      settings: this.getSettingsForEndpoint(),
    })
  }

  cloneTemplateAsSurvey(templateUid: string) {
    this.setState({
      isApplyTemplatePending: true,
      applyTemplateButton: t('Please wait…'),
      pendingTemplateCloneUid: templateUid,
    })

    // Use dataInterface directly with promise to avoid race with global listeners
    dataInterface
      .cloneAsset({
        uid: templateUid,
        new_asset_type: 'survey',
      })
      .done((asset: AssetResponse) => {
        // Only process if we're still waiting for this specific template
        if (this.state.pendingTemplateCloneUid === templateUid) {
          this.setState({
            formAsset: asset,
            fields: this.getInitialFieldsFromAsset(asset),
            pendingTemplateCloneUid: null,
          })
          this.resetApplyTemplateButton()
          this.displayStep(this.STEPS.PROJECT_DETAILS)
        }
      })
      .fail(() => {
        if (this.state.pendingTemplateCloneUid === templateUid) {
          this.setState({ pendingTemplateCloneUid: null })
          this.resetApplyTemplateButton()
          notify.error(t('Failed to apply template.'))
          // If auto-cloning from initialTemplateUid failed, close the modal
          // since the user was sent here specifically for that template
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
                    this.displayStep(this.STEPS.PROJECT_DETAILS)
                  }
                })
                .fail(() => {
                  this.resetImportUrlButton()
                  notify.error(t('Failed to reload project after import!'))
                })
            },
            (response) => {
              this.resetImportUrlButton()
              this.notifyImportFailure(response, importUrl ? this.getFilenameFromURI(importUrl) : null)
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
                  // TODO: Getting asset outside of actions.resources.loadAsset
                  // is not going to notify all the listeners, causing some hard
                  // to identify bugs.
                  // Until we switch this code to use actions we HACK it so other
                  // places are notified.
                  // See: https://github.com/kobotoolbox/kpi/issues/3919
                  actions.resources.loadAsset.completed(finalAsset)

                  if (this.props.context === PROJECT_SETTINGS_CONTEXTS.REPLACE) {
                    // when replacing, we omit PROJECT_DETAILS step
                    this.goToFormLanding()
                  } else {
                    this.applyAssetToState(finalAsset)
                    this.displayStep(this.STEPS.PROJECT_DETAILS)
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

    const fieldsWithErrors: string[] = []

    // simple non-empty name validation
    if (!this.state.fields.name.trim()) {
      fieldsWithErrors.push('name')
    }

    // superuser-configured metadata
    const descriptionFieldMeta = envStore.data.getProjectMetadataField('description')
    if (
      descriptionFieldMeta &&
      typeof descriptionFieldMeta !== 'boolean' &&
      descriptionFieldMeta.required &&
      !this.state.fields.description.trim()
    ) {
      fieldsWithErrors.push('description')
    }
    const sectorFieldMeta = envStore.data.getProjectMetadataField('sector')
    if (
      sectorFieldMeta &&
      typeof sectorFieldMeta !== 'boolean' &&
      sectorFieldMeta.required &&
      !this.state.fields.sector
    ) {
      fieldsWithErrors.push('sector')
    }
    const countryFieldMeta = envStore.data.getProjectMetadataField('country')
    if (
      countryFieldMeta &&
      typeof countryFieldMeta !== 'boolean' &&
      countryFieldMeta.required &&
      !this.state.fields.country?.length
    ) {
      fieldsWithErrors.push('country')
    }
    const operationalPurposeFieldMeta = envStore.data.getProjectMetadataField('operational_purpose')
    if (
      operationalPurposeFieldMeta &&
      typeof operationalPurposeFieldMeta !== 'boolean' &&
      operationalPurposeFieldMeta.required &&
      !this.state.fields.operational_purpose
    ) {
      fieldsWithErrors.push('operational_purpose')
    }
    const collectsPiiFieldMeta = envStore.data.getProjectMetadataField('collects_pii')
    if (
      collectsPiiFieldMeta &&
      typeof collectsPiiFieldMeta !== 'boolean' &&
      collectsPiiFieldMeta.required &&
      !this.state.fields.collects_pii
    ) {
      fieldsWithErrors.push('collects_pii')
    }

    envStore.data.extra_project_metadata_fields.forEach((field) => {
      if (!field.required) return

      const val = this.state.fields.extra_metadata_fields[field.name]

      if (field.type === EXTRA_PROJECT_METADATA_FIELD_TYPES.MULTI_SELECT) {
        if (!Array.isArray(val) || val.length === 0) {
          fieldsWithErrors.push(field.name)
        }
        return
      }

      if (field.type === EXTRA_PROJECT_METADATA_FIELD_TYPES.SINGLE_SELECT) {
        if (!val) {
          fieldsWithErrors.push(field.name)
        }
        return
      }

      // Default to text fields
      if (typeof val !== 'string' || !val.trim()) {
        fieldsWithErrors.push(field.name)
      }
    })

    // Will set either an empty array (no errors) or a list of fieldNames.
    this.setState({ fieldsWithErrors: fieldsWithErrors })

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

  getNameInputLabel(nameVal: string) {
    let label = t('Project Name')
    if (nameVal.length >= NAME_MAX_LENGTH - 99) {
      label += ` (${t('##count## characters left').replace('##count##', String(NAME_MAX_LENGTH - nameVal.length))})`
    }
    return label
  }

  checkModalStyle() {
    return this.props.context !== PROJECT_SETTINGS_CONTEXTS.EXISTING ? styles.modal : null
  }

  renderChooseTemplateButton() {
    return (
      <button onClick={this.displayStep.bind(this, this.STEPS.CHOOSE_TEMPLATE)}>
        <i className='k-icon k-icon-template' />
        {t('Use a template')}
      </button>
    )
  }

  renderStepFormSource() {
    return (
      <form className={this.checkModalStyle() || undefined}>
        {this.props.context !== PROJECT_SETTINGS_CONTEXTS.REPLACE && (
          <div className={styles.modalSubheader}>
            {t(
              'Choose one of the options below to continue. You will be prompted to enter name and other details in further steps.',
            )}
          </div>
        )}

        <div className={styles.sourceButtons}>
          {this.props.context === PROJECT_SETTINGS_CONTEXTS.NEW && (
            <button onClick={this.displayStep.bind(this, this.STEPS.PROJECT_DETAILS)}>
              <i className='k-icon k-icon-edit' />
              {t('Build from scratch')}
            </button>
          )}

          {this.props.context === PROJECT_SETTINGS_CONTEXTS.NEW && this.renderChooseTemplateButton()}

          <button onClick={this.displayStep.bind(this, this.STEPS.UPLOAD_FILE)}>
            <i className='k-icon k-icon-upload' />
            {t('Upload an XLSForm')}
          </button>

          <button onClick={this.displayStep.bind(this, this.STEPS.IMPORT_URL)}>
            <i className='k-icon k-icon-link' />
            {t('Import an XLSForm via URL')}
          </button>

          {this.props.context !== PROJECT_SETTINGS_CONTEXTS.NEW && this.renderChooseTemplateButton()}
        </div>
      </form>
    )
  }

  renderStepChooseTemplate() {
    return (
      <form className={cx(styles.chooseTemplate, this.checkModalStyle())}>
        <TemplatesList onSelectTemplate={this.onTemplateChange} />

        <footer className={styles.modalFooter}>
          {this.renderBackButton()}

          <Button
            type='primary'
            size='l'
            onClick={this.applyTemplate.bind(this)}
            isDisabled={!this.state.chosenTemplateUid || this.state.isApplyTemplatePending}
            label={this.state.applyTemplateButton}
          />
        </footer>
      </form>
    )
  }

  renderStepUploadFile() {
    return (
      <form className={this.checkModalStyle() || undefined}>
        <div className={styles.modalSubheader}>{t('Import an XLSForm from your computer.')}</div>

        {!this.state.isUploadFilePending && (
          <Dropzone onDrop={this.onFileDrop.bind(this)} multiple={false} accept={validFileTypes()}>
            {({ getRootProps, getInputProps, isDragActive, isDragReject }) => (
              <div
                {...getRootProps({
                  className: cx('kobo-dropzone', { 'dropzone-active': isDragActive, 'dropzone-reject': isDragReject }),
                })}
              >
                <input {...getInputProps()} />
                <i className='k-icon k-icon-file-xls' />
                {t(' Drag and drop the XLSForm file here or click to browse')}
              </div>
            )}
          </Dropzone>
        )}
        {this.state.isUploadFilePending && (
          <div className='dropzone'>
            <LoadingSpinner message={t('Uploading file…')} />
          </div>
        )}

        <footer className={styles.modalFooter}>{this.renderBackButton()}</footer>
      </form>
    )
  }

  renderStepImportUrl() {
    return (
      <form className={this.checkModalStyle() || undefined}>
        <div className={styles.uploadInstructions}>
          {t('Enter a valid XLSForm URL in the field below.')}
          <br />

          {envStore.isReady && envStore.data.support_url && (
            <a href={envStore.data.support_url + VIA_URL_SUPPORT_URL} target='_blank'>
              {t('Having issues? See this help article.')}
            </a>
          )}
        </div>

        <div className={styles.input}>
          <TextBox
            type='url'
            label={t('URL')}
            placeholder='https://'
            value={this.state.importUrl}
            onChange={this.onImportUrlChange}
          />
        </div>

        <footer className={styles.modalFooter}>
          {this.renderBackButton()}

          <Button
            type='primary'
            size='l'
            isSubmit
            onClick={this.importFromURL.bind(this)}
            isDisabled={!this.state.importUrlButtonEnabled}
            label={this.state.importUrlButton}
          />
        </footer>
      </form>
    )
  }

  onProjectDetailsFormChange = () => {}

  renderStepProjectDetails() {
    const sectorFieldResult = envStore.data.getProjectMetadataField('sector')
    const sectorField = sectorFieldResult && typeof sectorFieldResult !== 'boolean' ? sectorFieldResult : null
    const sectors = envStore.data.sector_choices
    const countryFieldResult = envStore.data.getProjectMetadataField('country')
    const countryField = countryFieldResult && typeof countryFieldResult !== 'boolean' ? countryFieldResult : null
    const countries = envStore.data.country_choices
    const bothCountryAndSector = sectorField && countryField
    const operationalPurposeFieldResult = envStore.data.getProjectMetadataField('operational_purpose')
    const operationalPurposeField =
      operationalPurposeFieldResult && typeof operationalPurposeFieldResult !== 'boolean'
        ? operationalPurposeFieldResult
        : null
    const operationalPurposes = envStore.data.operational_purpose_choices
    const collectsPiiFieldResult = envStore.data.getProjectMetadataField('collects_pii')
    const collectsPiiField =
      collectsPiiFieldResult && typeof collectsPiiFieldResult !== 'boolean' ? collectsPiiFieldResult : null
    const descriptionFieldResult = envStore.data.getProjectMetadataField('description')
    const descriptionField =
      descriptionFieldResult && typeof descriptionFieldResult !== 'boolean' ? descriptionFieldResult : null

    return (
      <form
        onSubmit={this.handleSubmit}
        onChange={this.onProjectDetailsFormChange}
        className={cx(styles.projectDetails, this.checkModalStyle() ?? styles.projectDetailsView)}
      >
        {this.props.context === PROJECT_SETTINGS_CONTEXTS.EXISTING && (
          <div className={styles.saveChanges}>
            <Button type='primary' size='l' isSubmit onClick={this.handleSubmit.bind(this)} label={t('Save Changes')} />
          </div>
        )}
        <div className={styles.inputWrapper}>
          {/* Project Name */}
          <div className={styles.input}>
            <TextBox
              value={this.state.fields.name}
              onChange={this.onNameChange.bind(this)}
              errors={this.hasFieldError('name') ? t('Please enter a title for your project!') : false}
              label={addRequiredToLabel(this.getNameInputLabel(this.state.fields.name))}
              placeholder={t('Enter title of project here')}
            />
          </div>

          {/* Description */}
          {descriptionField && (
            <div className={styles.input}>
              <TextBox
                type='text-multiline'
                value={this.state.fields.description}
                onChange={this.onDescriptionChange.bind(this)}
                errors={this.hasFieldError('description') ? t('Please enter a description for your project') : false}
                label={addRequiredToLabel(descriptionField.label, descriptionField.required)}
                placeholder={t('Enter short description here')}
              />
            </div>
          )}

          {/* Sector */}
          {sectorField && (
            <div className={cx(styles.input, bothCountryAndSector ? styles.sector : null)}>
              <WrappedSelect
                label={addRequiredToLabel(sectorField.label, sectorField.required)}
                value={this.state.fields.sector}
                onChange={(newValue) => this.onAnyFieldChange('sector', newValue as LabelValuePair | null)}
                options={sectors}
                isLimitedHeight
                menuPlacement='top'
                isClearable
                error={this.hasFieldError('sector') ? t('Please choose a sector') : undefined}
              />
            </div>
          )}

          {/* Country */}
          {countryField && (
            <div className={cx(styles.input, bothCountryAndSector ? styles.country : null)}>
              <WrappedSelect
                label={addRequiredToLabel(countryField.label, countryField.required)}
                isMulti
                value={this.state.fields.country}
                onChange={(newValue) => this.onAnyFieldChange('country', newValue as LabelValuePair[] | null)}
                options={countries}
                isLimitedHeight
                menuPlacement='top'
                isClearable
                error={this.hasFieldError('country') ? t('Please select at least one country') : undefined}
              />
            </div>
          )}

          {/* Operational Purpose of Data */}
          {operationalPurposeField && (
            <div className={styles.input}>
              <WrappedSelect
                label={addRequiredToLabel(operationalPurposeField.label, operationalPurposeField.required)}
                value={this.state.fields.operational_purpose}
                onChange={(newValue) => this.onAnyFieldChange('operational_purpose', newValue as LabelValuePair | null)}
                options={operationalPurposes}
                isLimitedHeight
                isClearable
                error={
                  this.hasFieldError('operational_purpose')
                    ? t('Please specify the operational purpose of your project')
                    : undefined
                }
              />
            </div>
          )}

          {/* Does this project collect personally identifiable information? */}
          {collectsPiiField && (
            <div className={styles.input}>
              <WrappedSelect
                label={addRequiredToLabel(collectsPiiField.label, collectsPiiField.required)}
                value={this.state.fields.collects_pii}
                onChange={(newValue) => this.onAnyFieldChange('collects_pii', newValue as LabelValuePair | null)}
                options={[
                  { value: 'Yes', label: t('Yes') },
                  { value: 'No', label: t('No') },
                ]}
                isClearable
                error={
                  this.hasFieldError('collects_pii')
                    ? t('Please indicate whether or not your project collects personally identifiable information')
                    : undefined
                }
              />
            </div>
          )}

          {/* Extra Project Metadata */}
          <ExtraProjectMetadataFields
            values={this.state.fields.extra_metadata_fields}
            onChange={this.onAnyFieldChange}
            hasFieldError={this.hasFieldError}
            fieldClassName={styles.input}
          />

          {(this.props.context === PROJECT_SETTINGS_CONTEXTS.NEW ||
            this.props.context === PROJECT_SETTINGS_CONTEXTS.REPLACE) && (
            <div className={styles.modalFooter}>
              {/* Don't allow going back if asset already exist */}
              {!this.state.formAsset && this.renderBackButton()}

              <Button
                type='primary'
                size='l'
                isSubmit
                onClick={this.handleSubmit.bind(this)}
                isDisabled={this.state.isSubmitPending}
                label={
                  <>
                    {this.state.isSubmitPending && t('Please wait…')}
                    {!this.state.isSubmitPending &&
                      this.props.context === PROJECT_SETTINGS_CONTEXTS.NEW &&
                      t('Create project')}
                    {!this.state.isSubmitPending &&
                      this.props.context === PROJECT_SETTINGS_CONTEXTS.REPLACE &&
                      t('Save')}
                  </>
                }
              />
            </div>
          )}

          {userCan('manage_asset', this.state.formAsset) &&
            this.props.context === PROJECT_SETTINGS_CONTEXTS.EXISTING && (
              <div className={styles.input}>
                <div className={cx(styles.input, styles.inputInline)}>
                  {this.isArchived() && (
                    <Button type='secondary' size='l' label={t('Unarchive Project')} onClick={this.unarchiveProject} />
                  )}

                  {this.isArchivable() && (
                    <Button type='secondary' size='l' label={t('Archive Project')} onClick={this.archiveProject} />
                  )}
                </div>

                {this.isArchivable() && (
                  <div className={cx(styles.input, styles.inputInline)}>
                    {t('Archive project to stop accepting submissions.')}
                  </div>
                )}
                {this.isArchived() && (
                  <div className={cx(styles.input, styles.inputInline)}>
                    {t('Unarchive project to resume accepting submissions.')}
                  </div>
                )}
              </div>
            )}

          {this.userCanViewDeleteButton() && this.props.context === PROJECT_SETTINGS_CONTEXTS.EXISTING && (
              <div className={styles.input}>
                <Button
                  type='danger'
                  size='l'
                  label={
                    this.state.formAsset!.deployment__submission_count > 0
                      ? t('Delete Project and Data')
                      : t('Delete Project')
                  }
                  onClick={this.deleteProject}
                />
              </div>
            )}
        </div>
      </form>
    )
  }

  renderBackButton() {
    if (this.state.previousStep) {
      const isBackButtonDisabled =
        this.state.isSubmitPending ||
        this.state.isApplyTemplatePending ||
        this.state.isImportFromURLPending ||
        this.state.isUploadFilePending
      return (
        <Button
          type='secondary'
          size='l'
          onClick={this.displayPreviousStep.bind(this)}
          isDisabled={isBackButtonDisabled}
          label={t('Back')}
        />
      )
    } else {
      return false
    }
  }

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

    let content
    switch (this.state.currentStep) {
      case this.STEPS.FORM_SOURCE:
        content = this.renderStepFormSource()
        break
      case this.STEPS.CHOOSE_TEMPLATE:
        content = this.renderStepChooseTemplate()
        break
      case this.STEPS.UPLOAD_FILE:
        content = this.renderStepUploadFile()
        break
      case this.STEPS.IMPORT_URL:
        content = this.renderStepImportUrl()
        break
      case this.STEPS.PROJECT_DETAILS:
        content = this.renderStepProjectDetails()
        break
      default:
        throw new Error(`Unknown step: ${this.state.currentStep}!`)
    }

    return <>{content}</>
  }
}

// NOTE: dmix mixin is causing a full asset load after component mounts
reactMixin(ProjectSettings.prototype, mixins.dmix)

export default withRouter(ProjectSettings)
