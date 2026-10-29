import { when } from 'mobx'
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { actions } from '#/actions'
import { archiveAsset, unarchiveAsset } from '#/assetQuickActions'
import assetUtils from '#/assetUtils'
import { openDeleteAssetModal } from '#/components/DeleteAssetModal/openDeleteAssetModal'
import InlineMessage from '#/components/common/inlineMessage'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { LockingRestrictionName } from '#/components/locking/lockingConstants'
import { hasAssetRestriction } from '#/components/locking/lockingUtils'
import { NAME_MAX_LENGTH, PROJECT_SETTINGS_CONTEXTS } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import { dataInterface } from '#/dataInterface'
import { type ImportErrorResponse, applyFileToAsset, applyUrlToAsset } from '#/dropzone.utils'
import pageState from '#/pageState.store'
import { router } from '#/router/legacy'
import { ROUTES } from '#/router/routerConstants'
import profileStore from '#/stores/profile'
import { escapeHtml, isAValidUrl, join, notify } from '#/utils'
import styles from './ProjectSettings.module.scss'
import { STEPS, type StepName, getStepTitle } from './constants'
import StepChooseTemplate from './steps/StepChooseTemplate'
import StepFormSource from './steps/StepFormSource'
import StepImportUrl from './steps/StepImportUrl'
import StepProjectDetails from './steps/StepProjectDetails'
import StepUploadFile from './steps/StepUploadFile'
import type { ProjectSettingsContext, ProjectSettingsFields, ProjectSettingsProps } from './types'
import { getFilenameFromURI, getInitialFieldsFromAsset, getSettingsForEndpoint, validateProjectFields } from './utils'

interface Steps {
  /** Current step in the wizard (null while an initial template is being cloned) */
  current: StepName | null
  /** Previous step (used for back button navigation) */
  previous: StepName | null
}

function getInitialStep(context: ProjectSettingsContext, initialTemplateUid?: string | null): StepName | null {
  switch (context) {
    case PROJECT_SETTINGS_CONTEXTS.NEW:
    case PROJECT_SETTINGS_CONTEXTS.REPLACE:
      // With an initial template we show a spinner until the clone completes
      if (initialTemplateUid && context === PROJECT_SETTINGS_CONTEXTS.NEW) {
        return null
      }
      return STEPS.FORM_SOURCE
    case PROJECT_SETTINGS_CONTEXTS.EXISTING:
      return STEPS.PROJECT_DETAILS
    default:
      throw new Error(`Unknown context: ${context}!`)
  }
}

function getBaseTitle(context: ProjectSettingsContext) {
  switch (context) {
    case PROJECT_SETTINGS_CONTEXTS.NEW:
      return t('Create project')
    case PROJECT_SETTINGS_CONTEXTS.REPLACE:
      return t('Replace form')
    case PROJECT_SETTINGS_CONTEXTS.EXISTING:
    default:
      return t('Project settings')
  }
}

function notifyImportFailure(response: ImportErrorResponse, sourceName: string | null) {
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
    // join returns an array of React nodes (strings and JSX elements with <br /> separators).
    // The wrapping <div> is required: the toast container lays out its direct children with
    // `display: flex`, so without a block-level wrapper the lines render side-by-side as columns.
    const message = <div>{join(errLines, <br />)}</div>
    notify.error(message)
  } else {
    // Fallback for responses without structured error messages
    // ImportErrorResponse doesn't have status/statusText, so we use a generic error
    notify.error(t('Import Failed!'))
  }
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
export default function ProjectSettings(props: ProjectSettingsProps) {
  const { context, initialTemplateUid, onSetModalTitle } = props
  const navigate = useNavigate()
  const params = useParams()
  // NEW and REPLACE run as a wizard in a modal, EXISTING is the /settings page
  const isModal = context !== PROJECT_SETTINGS_CONTEXTS.EXISTING

  const [isSessionLoaded, setIsSessionLoaded] = useState(!!profileStore.isLoggedIn)
  const [isSubmitPending, setIsSubmitPending] = useState(false)
  /** The asset being created or edited - populated after template/upload/import */
  const [formAsset, setFormAsset] = useState(props.formAsset)
  // project details
  const [fields, setFields] = useState(() => getInitialFieldsFromAsset(props.formAsset))
  /** List of field names that failed validation */
  const [fieldsWithErrors, setFieldsWithErrors] = useState<string[]>([])
  // steps
  const [steps, setSteps] = useState<Steps>(() => {return {
    current: getInitialStep(context, initialTemplateUid),
    previous: null,
  }})
  // importing url
  const [isImportFromURLPending, setIsImportFromURLPending] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importUrlButtonEnabled, setImportUrlButtonEnabled] = useState(false)
  const [importUrlButton, setImportUrlButton] = useState(t('Import'))
  // template
  const [isApplyTemplatePending, setIsApplyTemplatePending] = useState(false)
  const [applyTemplateButton, setApplyTemplateButton] = useState(t('Next'))
  const [chosenTemplateUid, setChosenTemplateUid] = useState(initialTemplateUid || null)
  // upload files
  const [isUploadFilePending, setIsUploadFilePending] = useState(false)

  // Refs, not state: never rendered, and async callbacks need the current value
  /** Template being cloned. Late responses for other templates are ignored. */
  const pendingTemplateCloneUid = useRef<string | null>(null)
  /** Archive or unarchive waiting to complete before navigating away */
  const awaitingDeploymentChange = useRef<'archive' | 'unarchive' | null>(null)

  /*
   * setup
   */

  // The passed asset may lack `content`, so load the full one
  const routeAssetUid = params.assetid || params.uid
  useEffect(() => {
    if (routeAssetUid) {
      actions.resources.loadAsset({ id: routeAssetUid }, true)
    }
  }, [routeAssetUid])

  useEffect(() => {
    // If an initial template is provided, apply it immediately
    if (initialTemplateUid && context === PROJECT_SETTINGS_CONTEXTS.NEW) {
      cloneTemplateAsSurvey(initialTemplateUid)
    }
    return when(
      () => profileStore.isInitialLoadComplete,
      () => setIsSessionLoaded(true),
    )
  }, [])

  // Shows the step in the modal title, e.g. "Create project: Upload XLSForm"
  useEffect(() => {
    if (onSetModalTitle && steps.current) {
      onSetModalTitle(`${getBaseTitle(context)}: ${getStepTitle(steps.current)}`)
    }
  }, [steps.current, context, onSetModalTitle])

  // Listeners subscribe once, so they go through a ref to reach the latest handlers
  const handlers = { onLoadAssetCompleted, onUpdateAssetCompleted, onUpdateAssetFailed, onSetDeploymentActiveCompleted }
  const listeners = useRef(handlers)
  listeners.current = handlers

  useEffect(() => {
    const unlisteners = [
      actions.resources.loadAsset.completed.listen((response: AssetResponse) =>
        listeners.current.onLoadAssetCompleted(response),
      ),
      actions.resources.updateAsset.completed.listen((response: AssetResponse) =>
        listeners.current.onUpdateAssetCompleted(response),
      ),
      actions.resources.updateAsset.failed.listen(() => listeners.current.onUpdateAssetFailed()),
      actions.resources.setDeploymentActive.failed.listen(() => {
        awaitingDeploymentChange.current = null
      }),
      actions.resources.setDeploymentActive.completed.listen(() => listeners.current.onSetDeploymentActiveCompleted()),
      // User navigated by themselves, so don't redirect them after archiving
      router!.subscribe(() => {
        awaitingDeploymentChange.current = null
      }),
    ]
    return () => unlisteners.forEach((unlisten) => unlisten())
  }, [])

  /** Final step of uploading or importing an XLSForm */
  function onImportCompleted(asset: AssetResponse) {
    if (context === PROJECT_SETTINGS_CONTEXTS.REPLACE) {
      // when replacing, we omit PROJECT_DETAILS step
      goToFormLanding()
    } else {
      setFields(getInitialFieldsFromAsset(asset))
      setIsUploadFilePending(false)
      setIsImportFromURLPending(false)
      setFormAsset(asset)
      displayStep(STEPS.PROJECT_DETAILS)
    }
  }

  function isLoading() {
    return (
      !isSessionLoaded ||
      !steps.current ||
      // this checks if the modal is about existing asset
      // that is not fully loaded yet
      (context !== PROJECT_SETTINGS_CONTEXTS.NEW && typeof formAsset?.content === 'undefined')
    )
  }

  function isReplacingFormLocked() {
    return (
      context === PROJECT_SETTINGS_CONTEXTS.REPLACE &&
      formAsset?.content &&
      hasAssetRestriction(formAsset.content, LockingRestrictionName.form_replace)
    )
  }

  /*
   * handling user input
   */

  function onAnyFieldChange(fieldName: string, newFieldValue: string | string[] | null) {
    setFields((prevFields) => {
      // Check if this is an admin-configured extra field or a standard field
      if (prevFields.extra_metadata_fields?.hasOwnProperty(fieldName)) {
        return {
          ...prevFields,
          extra_metadata_fields: { ...prevFields.extra_metadata_fields, [fieldName]: newFieldValue },
        }
      }

      const newFields: ProjectSettingsFields = { ...prevFields }
      // Type-safe field assignment - switch ensures we handle each field correctly
      switch (fieldName) {
        case 'name':
        case 'description':
          newFields[fieldName] = newFieldValue as string
          break
        case 'sector':
        case 'operational_purpose':
        case 'collects_pii':
          newFields[fieldName] = newFieldValue as string | null
          break
        case 'country':
          // Country is special - it's a multi-select so expects an array
          newFields[fieldName] = newFieldValue as string[] | null
          break
        default:
          // Unrecognized field name - log warning in development to catch typos
          if (process.env.NODE_ENV !== 'production') {
            console.warn(
              `onAnyFieldChange called with unrecognized fieldName: "${fieldName}". ` +
                `Expected one of: name, description, sector, country, operational_purpose, collects_pii, ` +
                `or a key in extra_metadata_fields.`,
            )
          }
          break
      }
      return newFields
    })

    // Clear error for this field when user starts editing it
    // New validation will run on submit if the value is still invalid
    setFieldsWithErrors((prevErrors) => prevErrors.filter((fieldWithErrorName) => fieldWithErrorName !== fieldName))

    props.onProjectDetailsChange?.({
      fieldName: fieldName,
      fieldValue: newFieldValue,
    })
  }

  function onNameChange(newValue: string) {
    onAnyFieldChange('name', assetUtils.removeInvalidChars(newValue).slice(0, NAME_MAX_LENGTH))
  }

  function onDescriptionChange(newValue: string) {
    onAnyFieldChange('description', assetUtils.removeInvalidChars(newValue))
  }

  function onImportUrlChange(value: string) {
    setImportUrl(value)
    setImportUrlButtonEnabled(isAValidUrl(value))
    setImportUrlButton(t('Import'))
  }

  function resetApplyTemplateButton() {
    setIsApplyTemplatePending(false)
    setApplyTemplateButton(t('Choose'))
  }

  function resetImportUrlButton() {
    setIsImportFromURLPending(false)
    setImportUrlButtonEnabled(false)
    setImportUrlButton(t('Import'))
  }

  function deleteProject(evt: React.MouseEvent<HTMLButtonElement>) {
    evt.preventDefault()

    openDeleteAssetModal(formAsset!, formAsset!.name, goToProjectsList)
  }

  // archive flow

  function isArchivable() {
    return formAsset?.deployment_status === 'deployed'
  }

  function isArchived() {
    return formAsset?.deployment_status === 'archived'
  }

  function archiveProject(evt: React.MouseEvent<HTMLButtonElement>) {
    evt.preventDefault()
    archiveAsset(formAsset!)
    awaitingDeploymentChange.current = 'archive'
  }

  function unarchiveProject(evt: React.MouseEvent<HTMLButtonElement>) {
    evt.preventDefault()
    unarchiveAsset(formAsset!)
    awaitingDeploymentChange.current = 'unarchive'
  }

  // when archiving/unarchiving finishes, take user to a route that makes sense
  // unless user navigates by themselves before that happens
  function onSetDeploymentActiveCompleted() {
    if (awaitingDeploymentChange.current === 'archive') {
      goToProjectsList()
    }
    if (awaitingDeploymentChange.current === 'unarchive') {
      goToFormLanding()
    }
    awaitingDeploymentChange.current = null
  }

  /*
   * routes navigation
   */

  function goToFormBuilder(assetUid: string) {
    pageState.hideModal()
    navigate(`/forms/${assetUid}/edit`)
  }

  function goToFormLanding() {
    pageState.hideModal()
    props.onRequestClose?.()

    const targetUid = formAsset?.uid || routeAssetUid
    if (!targetUid) {
      throw new Error('Unknown uid!')
    }

    navigate(ROUTES.FORM_LANDING.replace(':uid', targetUid))
  }

  function goToProjectsList() {
    pageState.hideModal()
    navigate(ROUTES.FORMS)
  }

  /*
   * modal steps navigation
   */

  function displayStep(targetStep: StepName) {
    setSteps((prevSteps) => {
      // No-op if we're already on this step
      if (targetStep === prevSteps.current) {
        return prevSteps
      }
      // Going back: swap current and previous (like a stack pop)
      if (targetStep === prevSteps.previous) {
        return { current: targetStep, previous: null }
      }
      // Going forward: push current step to history
      return { current: targetStep, previous: prevSteps.current }
    })
  }

  function displayPreviousStep() {
    if (steps.previous) {
      displayStep(steps.previous)
    }
  }

  /*
   * handling asset creation
   */

  function onLoadAssetCompleted(response: AssetResponse) {
    if (formAsset?.uid === response.uid) {
      setFormAsset(response)
    }
  }

  function onUpdateAssetCompleted(response: AssetResponse) {
    if (isModal) {
      goToFormLanding()
    }

    // This handles the case when the asset was edited outside the Settings,
    // e.g. the title editor in the header.
    if (!isModal && response.uid === formAsset?.uid) {
      setFormAsset(response)
      setFields(getInitialFieldsFromAsset(response))
    }
  }

  function onUpdateAssetFailed() {
    if (isModal) {
      resetApplyTemplateButton()
    }
  }

  function getOrCreateFormAsset() {
    return new Promise<AssetResponse>((resolve, reject) => {
      if (formAsset) {
        resolve(formAsset)
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
  }

  function createAssetAndOpenInBuilder() {
    dataInterface
      .createResource({
        name: fields.name,
        settings: getSettingsForEndpoint(fields),
        asset_type: 'survey',
      })
      .done((asset: AssetResponse) => {
        goToFormBuilder(asset.uid)
      })
      .fail((r: JQuery.jqXHR) => {
        notify.error(t('Error: new project could not be created.') + ` (code: ${r.statusText})`)
      })
  }

  function updateAndOpenAsset() {
    actions.resources.updateAsset(formAsset!.uid, {
      name: fields.name,
      settings: getSettingsForEndpoint(fields),
    })
  }

  function cloneTemplateAsSurvey(templateUid: string) {
    setIsApplyTemplatePending(true)
    setApplyTemplateButton(t('Please wait…'))
    pendingTemplateCloneUid.current = templateUid

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
        if (pendingTemplateCloneUid.current === templateUid) {
          pendingTemplateCloneUid.current = null
          setFormAsset(asset)
          setFields(getInitialFieldsFromAsset(asset))
          resetApplyTemplateButton()
          displayStep(STEPS.PROJECT_DETAILS)
        }
      })
      .fail(() => {
        if (pendingTemplateCloneUid.current === templateUid) {
          pendingTemplateCloneUid.current = null
          resetApplyTemplateButton()
          notify.error(t('Failed to apply template.'))
          // Special case: if this was an auto-applied template from initialTemplateUid,
          // close the modal since the user was directed here for that specific template
          if (initialTemplateUid === templateUid) {
            pageState.hideModal()
          }
        }
      })
  }

  function applyTemplate(evt: React.MouseEvent<HTMLButtonElement>) {
    evt.preventDefault()

    if (context === PROJECT_SETTINGS_CONTEXTS.REPLACE) {
      setIsApplyTemplatePending(true)
      setApplyTemplateButton(t('Please wait…'))
      actions.resources.updateAsset(formAsset!.uid, {
        clone_from: chosenTemplateUid!,
        name: formAsset!.name,
      })
    } else {
      cloneTemplateAsSurvey(chosenTemplateUid!)
    }
  }

  function importFromURL(evt: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) {
    evt.preventDefault()

    if (isAValidUrl(importUrl)) {
      setIsImportFromURLPending(true)
      setImportUrlButtonEnabled(false)
      setImportUrlButton(t('Retrieving form, please wait...'))

      getOrCreateFormAsset().then(
        (asset) => {
          setFormAsset(asset)

          applyUrlToAsset(importUrl, asset).then(
            (data) => {
              dataInterface
                .getAsset({ id: data.uid })
                .done(onImportCompleted)
                .fail(() => {
                  resetImportUrlButton()
                  notify.error(t('Failed to reload project after import!'))
                })
            },
            (response) => {
              resetImportUrlButton()
              notifyImportFailure(response, importUrl ? getFilenameFromURI(importUrl) : null)
            },
          )
        },
        () => {
          notify.error(t('Could not initialize XLSForm import!'))
        },
      )
    }
  }

  function onFileDrop(files: File[]) {
    if (files.length >= 1) {
      setIsUploadFilePending(true)

      getOrCreateFormAsset().then(
        (asset) => {
          applyFileToAsset(files[0], asset).then(
            (data) => {
              dataInterface
                .getAsset({ id: data.uid })
                .done((finalAsset: AssetResponse) => {
                  // WORKAROUND: dataInterface.getAsset() bypasses the action/store pattern,
                  // so components listening to assetStore won't be notified of the new asset.
                  // We manually trigger the action listener here to maintain consistency.
                  // TODO: Refactor component to use react-query
                  actions.resources.loadAsset.completed(finalAsset)
                  onImportCompleted(finalAsset)
                })
                .fail(() => {
                  setIsUploadFilePending(false)
                  notify.error(t('Failed to reload project after upload!'))
                })
            },
            (response) => {
              setIsUploadFilePending(false)
              notifyImportFailure(response, files[0]?.name)
            },
          )
        },
        () => {
          setIsUploadFilePending(false)
          notify.error(t('Could not import XLSForm!'))
        },
      )
    }
  }

  function hasFieldError(fieldName: string) {
    return fieldsWithErrors.includes(fieldName)
  }

  function handleSubmit(evt: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) {
    evt.preventDefault()

    const newFieldsWithErrors = validateProjectFields(fields)

    setFieldsWithErrors(newFieldsWithErrors)

    if (newFieldsWithErrors.length >= 1) {
      notify.error(t('Some fields contain errors!'))
      return
    }

    setIsSubmitPending(true)

    if (formAsset) {
      updateAndOpenAsset()
    } else {
      createAssetAndOpenInBuilder()
    }
  }

  /*
   * rendering
   */

  if (isLoading()) {
    return <LoadingSpinner />
  }

  if (isReplacingFormLocked()) {
    return (
      <InlineMessage
        type='warning'
        icon='alert'
        message={t("Form replacing is not available due to form's Locking Profile restrictions.")}
      />
    )
  }

  const modalStyle = isModal ? styles.modal : null
  const isBackDisabled = isSubmitPending || isApplyTemplatePending || isImportFromURLPending || isUploadFilePending

  switch (steps.current) {
    case STEPS.FORM_SOURCE:
      return <StepFormSource context={context} modalStyle={modalStyle} onSelectStep={displayStep} />

    case STEPS.CHOOSE_TEMPLATE:
      return (
        <StepChooseTemplate
          chosenTemplateUid={chosenTemplateUid}
          onTemplateChange={setChosenTemplateUid}
          applyTemplateButton={applyTemplateButton}
          isApplyTemplatePending={isApplyTemplatePending}
          onApplyTemplate={applyTemplate}
          previousStep={steps.previous}
          onBack={displayPreviousStep}
          isBackDisabled={isBackDisabled}
          modalStyle={modalStyle}
        />
      )

    case STEPS.UPLOAD_FILE:
      return (
        <StepUploadFile
          isUploadFilePending={isUploadFilePending}
          onFileDrop={onFileDrop}
          previousStep={steps.previous}
          onBack={displayPreviousStep}
          modalStyle={modalStyle}
        />
      )

    case STEPS.IMPORT_URL:
      return (
        <StepImportUrl
          importUrl={importUrl}
          onImportUrlChange={onImportUrlChange}
          importUrlButton={importUrlButton}
          importUrlButtonEnabled={importUrlButtonEnabled}
          onImportFromURL={importFromURL}
          previousStep={steps.previous}
          onBack={displayPreviousStep}
          isBackDisabled={isBackDisabled}
          modalStyle={modalStyle}
        />
      )

    case STEPS.PROJECT_DETAILS:
      return (
        <StepProjectDetails
          context={context}
          fields={fields}
          formAsset={formAsset}
          isSubmitPending={isSubmitPending}
          hasFieldError={hasFieldError}
          onNameChange={onNameChange}
          onDescriptionChange={onDescriptionChange}
          onAnyFieldChange={onAnyFieldChange}
          onSubmit={handleSubmit}
          onArchiveProject={archiveProject}
          onUnarchiveProject={unarchiveProject}
          onDeleteProject={deleteProject}
          isArchivable={isArchivable}
          isArchived={isArchived}
          previousStep={steps.previous}
          onBack={displayPreviousStep}
          modalStyle={modalStyle}
        />
      )

    default:
      throw new Error(`Unknown step: ${steps.current}!`)
  }
}
