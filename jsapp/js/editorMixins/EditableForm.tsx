import React from 'react'

import { Text } from '@mantine/core'
import alertify from 'alertifyjs'
import cx from 'classnames'
import clonedeep from 'lodash.clonedeep'
import debounce from 'lodash.debounce'
import last from 'lodash.last'
import DocumentTitle from 'react-document-title'
import ReactDOM from 'react-dom'
import Markdown from 'react-markdown'
import { unstable_usePrompt as usePrompt } from 'react-router-dom'
import Select from 'react-select'
import type { AssetSnapshotResponse } from '#/api/models/assetSnapshotResponse'
import assetUtils from '#/assetUtils'
import bem, { makeBem } from '#/bem'
import Alert from '#/components/common/alert'
import Button from '#/components/common/button'
import LoadingSpinner from '#/components/common/loadingSpinner'
import Modal from '#/components/common/modal'
import {
  type KoboMatrixParserParams,
  getFormBuilderAssetType,
  koboMatrixParser,
  surveyToValidJson,
  unnullifyTranslations,
} from '#/components/formBuilder/formBuilderUtils'
import FormLockedMessage from '#/components/locking/formLockedMessage'
import { LOCKING_UI_CLASSNAMES, LockingRestrictionName } from '#/components/locking/lockingConstants'
import {
  hasAssetAnyLocking,
  hasAssetRestriction,
  isAssetAllLocked,
  isAssetLockable,
} from '#/components/locking/lockingUtils'
import MetadataEditor from '#/components/metadataEditor'
import {
  ASSET_TYPES,
  AVAILABLE_FORM_STYLES,
  AssetTypeName,
  type FormStyleDefinition,
  type FormStyleName,
  NAME_MAX_LENGTH,
  QuestionTypeName,
  type UpdateStatesValue,
  update_states,
} from '#/constants'
import envStore from '#/envStore'
import type { RouterProp } from '#/router/legacy'
import { ROUTES } from '#/router/routerConstants'
import dkobo_xlform from '../../xlform/src/_xlform.init'
import type { Survey } from '../../xlform/src/model.survey'
import type { SurveyDetail } from '../../xlform/src/model.surveyDetail'
import type { SurveyApp } from '../../xlform/src/view.surveyApp'
import { actions } from '../actions'
import {
  type AssetContent,
  type AssetRequestObject,
  type AssetResponse,
  type AssetResponseFile,
  type FailResponse,
  dataInterface,
} from '../dataInterface'
import SurveyScope from '../models/surveyScope'
import { type SurveyStateStoreData, stores } from '../stores'
import { escapeHtml, recordKeys } from '../utils'
import AssetNavigator from './assetNavigator'

const ErrorMessage = makeBem(null, 'error-message')
const ErrorMessage__strong = makeBem(null, 'error-message__header', 'strong')
bem.CascadePopup = makeBem(null, 'cascade-popup')
bem.CascadePopup__message = makeBem(bem.CascadePopup, 'message')
bem.CascadePopup__buttonWrapper = makeBem(bem.CascadePopup, 'buttonWrapper')

const WEBFORM_STYLES_SUPPORT_URL = 'alternative_enketo.html'
const CHOICE_LIST_SUPPORT_URL = 'cascading_select.html'

const UNSAVED_CHANGES_WARNING = t('You have unsaved changes. Leave form without saving?')
/** Use usePrompt directly instead for functional components */
const Prompt = () => {
  usePrompt({ when: true, message: UNSAVED_CHANGES_WARNING })
  return <></>
}

const ASIDE_CACHE_NAME = 'kpi.editable-form.aside'
const LOCKING_SUPPORT_URL = 'library_locking.html'
const RECORDING_SUPPORT_URL = 'recording-interviews.html'

interface LaunchAppData {
  name: string
  savedName?: string
  settings__style?: FormStyleName
  files: AssetResponseFile[]
  asset_type: AssetTypeName
  asset: AssetResponse
}

interface EditableFormButtonStates {
  previewDisabled?: boolean
  groupable?: boolean
  showAllOpen?: boolean
  showAllAvailable?: boolean
  name?: string
  hasSettings?: boolean
  styleValue?: FormStyleName
  allButtonsDisabled?: boolean
  saveButtonText?: string
}

interface AsideSettings {
  asideLayoutSettingsVisible: boolean
  asideLibrarySearchVisible: boolean
}

interface EditableFormProps {
  asset_updated: UpdateStatesValue
  multioptionsExpanded: boolean
  surveyAppRendered: boolean
  name: string
  assetUid?: string
  isNewAsset?: boolean
  backRoute: string | null
  parentAssetUid?: string
  router: RouterProp
}

interface EditableFormState extends SurveyStateStoreData {
  isNewAsset?: boolean
  backRoute?: string
  asideLayoutSettingsVisible: boolean
  asideLibrarySearchVisible: boolean
  asset: AssetResponse | undefined
  asset_updated: UpdateStatesValue
  cascadeMessage?: {
    msgType: 'ready' | 'warning'
    addCascadeMessage?: string
    message?: string
  }
  cascadeReady: boolean
  cascadeReadySurvey?: Survey
  cascadeTextareaValue: string
  desiredAssetType: AssetTypeName | undefined
  enketopreviewError?: string
  enketopreviewOverlay: string | undefined
  isBackgroundAudioBannerDismissed: boolean
  name: string
  preventNavigatingOut: boolean
  settings__style?: FormStyleName
  showCascadePopup: boolean
  cascadeLastSelectedRowIndex?: number
  surveyAppRendered: boolean
  surveyLoadError: string | undefined
  surveySaveFail: boolean
}

/**
 * This is a component that displays Form Builder's header and aside. It is also
 * responsible for rendering the survey editor app (all our coffee code). See
 * the `launchAppForSurveyContent` method below for all the magic.
 */
export default class EditableForm extends React.Component<EditableFormProps, EditableFormState> {
  onSurveyChangeDebounced: () => void = Function

  app?: SurveyApp

  constructor(props: EditableFormProps) {
    super(props)
    this.state = {
      asideLayoutSettingsVisible: false,
      asideLibrarySearchVisible: false,
      asset: undefined,
      asset_updated: update_states.UP_TO_DATE,
      cascadeMessage: undefined,
      cascadeReady: false,
      cascadeTextareaValue: '',
      desiredAssetType: undefined,
      enketopreviewOverlay: undefined,
      isBackgroundAudioBannerDismissed: false,
      name: props.name,
      preventNavigatingOut: false,
      showCascadePopup: false,
      surveyAppRendered: props.surveyAppRendered,
      surveyLoadError: undefined,
      surveySaveFail: false,
      isNewAsset: props.isNewAsset,
      backRoute: props.backRoute === null ? undefined : props.backRoute,
      groupButtonIsActive: false,
      multioptionsExpanded: props.multioptionsExpanded,
    }
  }

  componentDidMount() {
    this.loadAsideSettings()

    if (this.state.isNewAsset) {
      this.launchAppForSurveyContent()
    } else {
      const uid = this.props.assetUid
      stores.allAssets.whenLoaded(uid, (originalAsset: AssetResponse) => {
        // Store asset object is mutable and there is no way to predict all the
        // bugs that come from this fact. Form Builder code is already changing
        // the content of the object, so we want to cut all the bugs at the
        // very start of the process.
        const asset = clonedeep(originalAsset)

        this.setState({ asset: asset })

        // HACK switch to setState callback after updating to React 16+
        //
        // This needs to be called at least a single render after the state's
        // asset is being set, because `.form-wrap` node needs to exist for
        // `launchAppForSurveyContent` to work.
        window.setTimeout(() => {
          let settingsStyle: FormStyleName | undefined
          if (asset.content?.settings && !Array.isArray(asset.content?.settings)) {
            settingsStyle = asset.content.settings.style
          }
          this.launchAppForSurveyContent(asset.content, {
            name: asset.name,
            settings__style: settingsStyle,
            files: asset.files,
            asset_type: asset.asset_type,
            asset: asset,
          })
        }, 0)
      })
    }

    this.onSurveyChangeDebounced = debounce(this.onSurveyChange.bind(this), 200)

    stores.surveyState.listen(this.surveyStateChanged.bind(this))
  }

  componentWillUnmount() {
    if (this.app && this.app.survey) {
      this.app.survey.off('change')
    }
    this.unpreventClosingTab()
  }

  routerWillLeave() {
    if (this.state.preventNavigatingOut) {
      return UNSAVED_CHANGES_WARNING
    }
    return ''
  }

  loadAsideSettings() {
    const asideSettings = sessionStorage.getItem(ASIDE_CACHE_NAME)
    if (asideSettings) {
      this.setState(JSON.parse(asideSettings))
    }
  }

  saveAsideSettings(asideSettings: AsideSettings) {
    sessionStorage.setItem(ASIDE_CACHE_NAME, JSON.stringify(asideSettings))
  }

  onMetadataEditorChange() {
    this.onSurveyChangeDebounced()
  }

  surveyStateChanged(state: SurveyStateStoreData) {
    this.setState(state)
  }

  onStyleChange(newStyle: null | FormStyleDefinition) {
    let settingsStyle
    if (newStyle !== null) {
      settingsStyle = newStyle.value
    }

    this.setState({
      settings__style: settingsStyle,
    })
    this.onSurveyChangeDebounced()
  }

  getStyleSelectVal(optionVal?: FormStyleName) {
    return AVAILABLE_FORM_STYLES.find((option) => option.value === optionVal)
  }

  onSurveyChange() {
    if (!this.state.asset_updated !== update_states.UNSAVED_CHANGES) {
      this.preventClosingTab()
    }
    this.setState({
      asset_updated: update_states.UNSAVED_CHANGES,
    })
  }

  preventClosingTab() {
    this.setState({ preventNavigatingOut: true })
    $(window).on('beforeunload.noclosetab', () => UNSAVED_CHANGES_WARNING)
  }

  unpreventClosingTab() {
    this.setState({ preventNavigatingOut: false })
    $(window).off('beforeunload.noclosetab')
  }

  nameChange(evt: React.ChangeEvent<HTMLInputElement>) {
    this.setState({
      name: assetUtils.removeInvalidChars(evt.target.value),
    })
    this.onSurveyChangeDebounced()
  }

  groupQuestions() {
    this.app?.groupSelectedRows()
  }

  showAll(evt: React.TouchEvent<HTMLButtonElement>) {
    evt.preventDefault()
    evt.currentTarget.blur()
    this.app?.expandMultioptions()
  }

  hasMetadataAndDetails() {
    return (
      this.app &&
      this.state.asset &&
      (this.state.asset.asset_type === ASSET_TYPES.survey.id ||
        this.state.asset.asset_type === ASSET_TYPES.template.id ||
        this.state.desiredAssetType === ASSET_TYPES.template.id)
    )
  }

  needsSave() {
    return this.state.asset_updated === update_states.UNSAVED_CHANGES
  }

  previewForm(evt: React.TouchEvent<HTMLButtonElement>) {
    // At this point app should really be defined, and if not, there is no point in doing anything
    if (!this.app) {
      console.error('this.app is not defined!')
      return
    }

    if (evt && evt.preventDefault) {
      evt.preventDefault()
    }

    if (this.state.settings__style !== undefined) {
      this.app?.survey.settings.set('style', this.state.settings__style)
    }

    if (this.state.name) {
      this.app?.survey.settings.set('title', this.state.name)
    }

    let surveyJSON = surveyToValidJson(this.app?.survey)
    if (this.state.asset?.content) {
      surveyJSON = unnullifyTranslations(surveyJSON, this.state.asset.content)
    }
    let params: KoboMatrixParserParams & { asset?: string } = { source: surveyJSON }

    params = koboMatrixParser(params)

    if (this.state.asset && this.state.asset.url) {
      params.asset = this.state.asset.url
    }

    dataInterface
      .createAssetSnapshot(params)
      .done((content: AssetSnapshotResponse) => {
        this.setState({
          enketopreviewOverlay: content.enketopreviewlink,
        })
      })
      .fail((jqxhr: FailResponse) => {
        let err
        if (jqxhr && jqxhr.responseJSON && jqxhr.responseJSON.error) {
          err = jqxhr.responseJSON.error
        } else {
          err = t('Unknown Enketo preview error')
        }
        this.setState({
          enketopreviewError: err,
        })
      })
  }

  saveForm(evt: React.TouchEvent<HTMLButtonElement>) {
    if (evt && evt.preventDefault) {
      evt.preventDefault()
    }
    // At this point app should really be defined, and if not, there is no point in doing anything
    if (!this.app) {
      console.error('this.app is not defined!')
      return
    }

    if (this.state.settings__style !== undefined) {
      this.app.survey.settings.set('style', this.state.settings__style)
    }

    let surveyJSON = surveyToValidJson(this.app.survey)
    if (this.state.asset?.content) {
      const surveyJSONWithMatrix = koboMatrixParser({ source: surveyJSON }).source
      if (surveyJSONWithMatrix) {
        surveyJSON = unnullifyTranslations(surveyJSONWithMatrix, this.state.asset.content)
      }
    }
    // We normally have `content` as an actual object, not a stringified representation, but since
    // `actions.resources.updateAsset` already works with JSON string, let's extend the types
    const params: Partial<AssetRequestObject> & { content: string } = { content: surveyJSON }

    if (this.state.name) {
      params.name = this.state.name
    }

    if (this.state.isNewAsset) {
      // we're intentionally leaving after creating new asset,
      // so there is nothing unsaved here
      this.unpreventClosingTab()

      // create new asset
      if (this.state.desiredAssetType) {
        params.asset_type = this.state.desiredAssetType
      } else {
        params.asset_type = AssetTypeName.block
      }
      if (this.props.parentAssetUid) {
        params.parent = assetUtils.buildAssetUrl(this.props.parentAssetUid)
      }
      actions.resources.createResource.triggerAsync(params).then(() => {
        if (this.props.router && this.state.backRoute) {
          this.props.router.navigate(this.state.backRoute)
        }
      })
    } else if (this.props.assetUid) {
      // update existing asset
      const uid = this.props.assetUid

      actions.resources.updateAsset
        .triggerAsync(uid, params)
        .then(() => {
          this.unpreventClosingTab()
          this.setState({
            asset_updated: update_states.UP_TO_DATE,
            surveySaveFail: false,
          })
        })
        .catch((resp: FailResponse) => {
          var errorMsg = `${t('Your changes could not be saved, likely because of a lost internet connection.')}&nbsp;${t('Keep this window open and try saving again while using a better connection.')}`
          if (resp.statusText !== 'error') {
            errorMsg = escapeHtml(resp.statusText)
          }

          alertify.defaults.theme.ok = 'ajs-cancel'
          const dialog = alertify.dialog('alert')
          const opts = {
            title: t('Error saving form'),
            message: errorMsg,
            label: t('Dismiss'),
          }
          dialog.set(opts).show()

          this.setState({
            surveySaveFail: true,
            asset_updated: update_states.SAVE_FAILED,
          })
        })
    }
    this.setState({
      asset_updated: update_states.PENDING_UPDATE,
    })
  }

  buttonStates() {
    var ooo: EditableFormButtonStates = {}
    if (this.app) {
      ooo.previewDisabled = true
      if (this.app && this.app.survey) {
        ooo.previewDisabled = this.app.survey.rows.length < 1
      }
      ooo.groupable = !!this.state.groupButtonIsActive
      ooo.showAllOpen = !!this.state.multioptionsExpanded
      ooo.showAllAvailable = (() => {
        var hasSelect = false
        this.app.survey.forEachRow((row) => {
          if (row._isSelectQuestion()) {
            hasSelect = true
          }
        })
        return hasSelect
      })()
      ooo.name = this.state.name
      ooo.hasSettings = this.state.backRoute === ROUTES.FORMS
      ooo.styleValue = this.state.settings__style
    } else {
      ooo.allButtonsDisabled = true
    }
    if (this.state.isNewAsset) {
      ooo.saveButtonText = t('create')
    } else if (this.state.surveySaveFail) {
      ooo.saveButtonText = `${t('save')} (${t('retry')}) `
    } else {
      ooo.saveButtonText = t('save')
    }
    return ooo
  }

  toggleAsideLibrarySearch(evt: React.TouchEvent<HTMLButtonElement>) {
    evt.currentTarget.blur()
    const asideSettings: AsideSettings = {
      asideLayoutSettingsVisible: false,
      asideLibrarySearchVisible: !this.state.asideLibrarySearchVisible,
    }
    this.setState(asideSettings)
    this.saveAsideSettings(asideSettings)
  }

  toggleAsideLayoutSettings(evt: React.TouchEvent<HTMLButtonElement>) {
    evt.currentTarget.blur()
    const asideSettings: AsideSettings = {
      asideLayoutSettingsVisible: !this.state.asideLayoutSettingsVisible,
      asideLibrarySearchVisible: false,
    }
    this.setState(asideSettings)
    this.saveAsideSettings(asideSettings)
  }

  hidePreview() {
    this.setState({
      enketopreviewOverlay: undefined,
    })
  }

  hideCascade() {
    this.setState({
      showCascadePopup: false,
    })
  }

  /**
   * The de facto function that is running our Form Builder survey editor app.
   * It builds `dkobo_xlform.view.SurveyApp` using asset data and then appends
   * it to `.form-wrap` node.
   */
  launchAppForSurveyContent(assetContent?: AssetContent, _state?: LaunchAppData) {
    const newState: Partial<EditableFormState> & Partial<LaunchAppData> = _state || {}

    if (newState.name) {
      newState.savedName = newState.name
    }

    // asset content is being mutated somewhere during form builder initialisation
    // so we need to make sure this stays untouched
    const rawAssetContent = Object.freeze(clonedeep(assetContent))

    const isEmptySurvey =
      assetContent &&
      assetContent.settings &&
      recordKeys(assetContent.settings).length === 0 &&
      assetContent.survey?.length === 0

    let survey: Survey | null = null

    try {
      if (assetContent) {
        survey = dkobo_xlform.model.Survey.loadDict(assetContent)
        if (newState.files && newState.files.length > 0) {
          survey.availableFiles = newState.files
        }
        if (isEmptySurvey) {
          survey.surveyDetails.importDefaults()
        }
      } else {
        survey = dkobo_xlform.model.Survey.create()
      }
    } catch (err) {
      const errObject = (err as unknown as { message?: string }) || {}
      newState.surveyLoadError = errObject.message || 'dkobo_xlform failed'
      newState.surveyAppRendered = false
    }

    if (survey && !newState.surveyLoadError) {
      newState.surveyAppRendered = true

      var skp = new SurveyScope({
        survey: survey,
        rawSurvey: rawAssetContent,
        assetType: getFormBuilderAssetType(this.state.asset?.asset_type, this.state.desiredAssetType),
      })
      this.app = new dkobo_xlform.view.SurveyApp({
        survey: survey,
        stateStore: stores.surveyState,
        ngScope: skp,
      })

      const formWrapEl = ReactDOM.findDOMNode(this.refs['form-wrap'])

      if (formWrapEl instanceof Element === false) {
        throw new Error('form-wrap element not found!')
      }

      this.app.$el.appendTo(formWrapEl)
      this.app.render()
      survey.rows.on('change', this.onSurveyChange.bind(this))
      survey.rows.on('sort', this.onSurveyChange.bind(this))
      survey.on('change', this.onSurveyChange.bind(this))
    }

    this.setState(newState)
  }

  clearPreviewError() {
    this.setState({
      enketopreviewError: undefined,
    })
  }

  safeNavigateToList() {
    if (this.state.backRoute) {
      this.props.router.navigate(this.state.backRoute)
    } else if (this.props.router.location.pathname.startsWith(ROUTES.LIBRARY)) {
      this.props.router.navigate(ROUTES.LIBRARY)
    } else {
      this.props.router.navigate(ROUTES.FORMS)
    }
  }

  safeNavigateToAsset() {
    if (!this.state.asset || !this.state.backRoute) {
      return
    }

    let targetRoute = this.state.backRoute
    if (this.state.backRoute === ROUTES.FORMS) {
      targetRoute = ROUTES.FORM.replace(':uid', this.state.asset.uid)
    } else if (this.state.backRoute === ROUTES.LIBRARY) {
      // Check if the the uid is undefined to prevent getting an Access Denied screen
      if (this.state.asset.uid !== undefined) {
        targetRoute = ROUTES.LIBRARY_ITEM.replace(':uid', this.state.asset.uid)
      }
    }

    this.props.router.navigate(targetRoute)
  }

  isAddingQuestionsRestricted() {
    return (
      this.state.asset?.content &&
      isAssetLockable(this.state.asset.asset_type) &&
      hasAssetRestriction(this.state.asset.content, LockingRestrictionName.question_add)
    )
  }

  isAddingGroupsRestricted() {
    return (
      this.state.asset?.content &&
      isAssetLockable(this.state.asset.asset_type) &&
      hasAssetRestriction(this.state.asset.content, LockingRestrictionName.group_add)
    )
  }

  isChangingAppearanceRestricted() {
    return (
      this.state.asset?.content &&
      isAssetLockable(this.state.asset.asset_type) &&
      hasAssetRestriction(this.state.asset.content, LockingRestrictionName.form_appearance)
    )
  }

  isChangingMetaQuestionsRestricted() {
    return (
      this.state.asset?.content &&
      isAssetLockable(this.state.asset.asset_type) &&
      hasAssetRestriction(this.state.asset.content, LockingRestrictionName.form_meta_edit)
    )
  }

  hasBackgroundAudio() {
    return this.app?.survey?.surveyDetails.filter(
      (sd: SurveyDetail) => sd.attributes.name === QuestionTypeName['background-audio'],
    )[0].attributes.value
  }

  // rendering methods

  renderFormBuilderHeader() {
    const { previewDisabled, groupable, showAllOpen, showAllAvailable, saveButtonText } = this.buttonStates()

    return (
      <bem.FormBuilderHeader>
        <bem.FormBuilderHeader__row m='primary'>
          <bem.FormBuilderHeader__cell
            m={'logo'}
            data-tip={t('Return to list')}
            className='left-tooltip'
            tabIndex='0'
            onClick={this.safeNavigateToList.bind(this)}
          >
            <i className='k-icon k-icon-kobo' />
          </bem.FormBuilderHeader__cell>

          <bem.FormBuilderHeader__cell m='name'>
            <bem.FormModal__item>
              {this.renderAssetLabel()}
              <input
                type='text'
                maxLength={NAME_MAX_LENGTH}
                onChange={this.nameChange.bind(this)}
                value={this.state.name}
                title={this.state.name}
                id='nameField'
                dir='auto'
              />
            </bem.FormModal__item>
          </bem.FormBuilderHeader__cell>

          <bem.FormBuilderHeader__cell m={'buttonsTopRight'}>
            <Button
              type='primary'
              size='l'
              isPending={this.state.asset_updated === update_states.PENDING_UPDATE}
              isDisabled={!this.state.surveyAppRendered || !!this.state.surveyLoadError}
              onClick={this.saveForm.bind(this)}
              isUpperCase
              label={
                <>
                  {saveButtonText}
                  {this.state.asset_updated === update_states.SAVE_FAILED || (this.needsSave() && <>&nbsp;*</>)}
                </>
              }
            />

            <Button type='text' size='l' onClick={this.safeNavigateToAsset.bind(this)} startIcon='close' />
          </bem.FormBuilderHeader__cell>
        </bem.FormBuilderHeader__row>

        <bem.FormBuilderHeader__row m={'secondary'}>
          <bem.FormBuilderHeader__cell m={'toolsButtons'}>
            <Button
              type='text'
              size='m'
              isDisabled={previewDisabled}
              onClick={this.previewForm.bind(this)}
              tooltip={t('Preview form')}
              tooltipPosition='left'
              startIcon='view'
            />

            <Button
              type='text'
              size='m'
              isDisabled={!showAllAvailable}
              onClick={this.showAll.bind(this)}
              tooltip={t('Expand / collapse questions')}
              tooltipPosition='left'
              startIcon='view-all'
            />

            <Button
              type='text'
              size='m'
              isDisabled={!groupable}
              onClick={this.groupQuestions.bind(this)}
              tooltip={
                groupable
                  ? t('Create group with selected questions')
                  : t('Grouping disabled. Please select at least one question.')
              }
              tooltipPosition='left'
              startIcon='group'
              className={cx({
                [LOCKING_UI_CLASSNAMES.DISABLED]: this.isAddingGroupsRestricted(),
              })}
            />

            <Button
              type='text'
              size='m'
              isDisabled={this.toggleCascade === undefined}
              onClick={this.toggleCascade.bind(this)}
              tooltip={t('Insert cascading select')}
              tooltipPosition='left'
              startIcon='cascading'
              className={cx({
                [LOCKING_UI_CLASSNAMES.DISABLED]: this.isAddingGroupsRestricted(),
              })}
            />
          </bem.FormBuilderHeader__cell>

          <bem.FormBuilderHeader__cell m='verticalRule' />

          <bem.FormBuilderHeader__cell m='spacer' />

          <bem.FormBuilderHeader__cell m='verticalRule' />

          <bem.FormBuilderHeader__cell>
            <Button
              type='text'
              size='m'
              onClick={this.toggleAsideLibrarySearch.bind(this)}
              tooltip={t('Add an item from the library')}
              tooltipPosition='left'
              startIcon={this.state.asideLibrarySearchVisible ? 'close' : 'library'}
              label={t('Add from Library')}
            />
          </bem.FormBuilderHeader__cell>

          <bem.FormBuilderHeader__cell m={'verticalRule'} />

          <bem.FormBuilderHeader__cell>
            <Button
              type='text'
              size='m'
              onClick={this.toggleAsideLayoutSettings.bind(this)}
              tooltip={this.hasMetadataAndDetails() ? t('Change form layout and settings') : t('Change form layout')}
              tooltipPosition='left'
              startIcon={this.state.asideLayoutSettingsVisible ? 'close' : 'settings'}
              label={this.hasMetadataAndDetails() ? t('Layout & Settings') : t('Layout')}
            />
          </bem.FormBuilderHeader__cell>
        </bem.FormBuilderHeader__row>
      </bem.FormBuilderHeader>
    )
  }

  renderBackgroundAudioWarning() {
    if (this.state.isBackgroundAudioBannerDismissed) return null
    let bannerText = t(
      'This form will automatically [record audio in the background](##SUPPORT_LINK##). Consider adding with a meaningful consent question to inform respondents or data collectors that they will be recorded while completing this survey.',
    )

    if (envStore.isReady && envStore.data.support_url) {
      bannerText = bannerText.replace('##SUPPORT_LINK##', envStore.data.support_url + RECORDING_SUPPORT_URL)
    } else {
      // Replaces the link for the text only if link is not available
      bannerText = bannerText.replace(/\[(.+)]\(##SUPPORT_LINK##\)/, '$1')
    }

    return (
      <Alert
        type='info'
        iconName='information'
        p='sm'
        maw={1024}
        mb='sm'
        m='auto'
        closeButtonLabel={t('Dismiss')}
        onClose={() => {
          this.setState({ isBackgroundAudioBannerDismissed: true })
        }}
        withCloseButton
      >
        <Markdown
          components={{
            // Custom link component to open link on target _blank
            a: (props) => (
              <a href={props.href} target='_blank'>
                {props.children}
              </a>
            ),
            // Custom paragraph component to use mantine Text instead of <p>
            p: (props) => (
              <Text c='blue.4' mr='lg'>
                {props.children}
              </Text>
            ),
          }}
        >
          {bannerText}
        </Markdown>
      </Alert>
    )
  }

  renderAside() {
    const { styleValue, hasSettings } = this.buttonStates()

    const isAsideVisible = this.state.asideLayoutSettingsVisible || this.state.asideLibrarySearchVisible

    return (
      <bem.FormBuilderAside m={isAsideVisible ? 'visible' : null}>
        {this.state.asideLayoutSettingsVisible && (
          <bem.FormBuilderAside__content>
            <bem.FormBuilderAside__row>
              <bem.FormBuilderAside__header>
                {t('Form style')}

                {envStore.isReady && envStore.data.support_url && (
                  <a
                    href={envStore.data.support_url + WEBFORM_STYLES_SUPPORT_URL}
                    target='_blank'
                    data-tip={t('Read more about form styles')}
                  >
                    <i className='k-icon k-icon-help' />
                  </a>
                )}
              </bem.FormBuilderAside__header>

              <label className='kobo-select__label' htmlFor='webform-style'>
                {hasSettings
                  ? t('Select the form style that you would like to use. This will only affect web forms.')
                  : t(
                      'Select the form style. This will only affect the Enketo preview, and it will not be saved with the question or block.',
                    )}
              </label>

              <Select
                className='kobo-select'
                classNamePrefix='kobo-select'
                id='webform-style'
                name='webform-style'
                ref='webformStyle'
                value={this.getStyleSelectVal(styleValue)}
                onChange={this.onStyleChange.bind(this)}
                placeholder={AVAILABLE_FORM_STYLES[0].label}
                options={AVAILABLE_FORM_STYLES}
                menuPlacement='bottom'
                isDisabled={this.isChangingAppearanceRestricted()}
                isSearchable={false}
              />
            </bem.FormBuilderAside__row>

            {this.hasMetadataAndDetails() && (
              <bem.FormBuilderAside__row>
                <bem.FormBuilderAside__header>{t('Metadata')}</bem.FormBuilderAside__header>

                <MetadataEditor
                  survey={this.app?.survey}
                  onChange={this.onMetadataEditorChange.bind(this)}
                  isDisabled={this.isChangingMetaQuestionsRestricted()}
                  {...this.state}
                />
              </bem.FormBuilderAside__row>
            )}
          </bem.FormBuilderAside__content>
        )}

        {this.state.asideLibrarySearchVisible && (
          <bem.FormBuilderAside__content
            className={this.isAddingQuestionsRestricted() ? LOCKING_UI_CLASSNAMES.DISABLED : ''}
          >
            <bem.FormBuilderAside__row>
              <bem.FormBuilderAside__header>{t('Search Library')}</bem.FormBuilderAside__header>
            </bem.FormBuilderAside__row>

            <bem.FormBuilderAside__row>
              <AssetNavigator />
            </bem.FormBuilderAside__row>
          </bem.FormBuilderAside__content>
        )}
      </bem.FormBuilderAside>
    )
  }

  renderNotLoadedMessage() {
    if (this.state.surveyLoadError) {
      return (
        <ErrorMessage>
          <ErrorMessage__strong>{t('Error loading survey:')}</ErrorMessage__strong>
          <p>{this.state.surveyLoadError}</p>
        </ErrorMessage>
      )
    }

    return <LoadingSpinner />
  }

  renderAssetLabel() {
    if (!this.state.asset) {
      return null
    }

    const assetTypeLabel =
      getFormBuilderAssetType(this.state.asset.asset_type, this.state.desiredAssetType)?.label || 'asset'

    // Case 1: there is no asset yet (creting a new) or asset is not locked
    if (!this.state.asset?.content || !hasAssetAnyLocking(this.state.asset.content)) {
      return assetTypeLabel
      // Case 2: asset is locked fully or partially
    } else {
      let lockedLabel = t('Partially locked ##type##').replace('##type##', assetTypeLabel)
      if (isAssetAllLocked(this.state.asset.content)) {
        lockedLabel = t('Fully locked ##type##').replace('##type##', assetTypeLabel)
      }
      return (
        <span className='locked-asset-type-label'>
          <i className='k-icon k-icon-lock' />

          {lockedLabel}

          {envStore.isReady && envStore.data.support_url && (
            <a
              href={envStore.data.support_url + LOCKING_SUPPORT_URL}
              target='_blank'
              data-tip={t('Read more about Locking')}
            >
              <i className='k-icon k-icon-help' />
            </a>
          )}
        </span>
      )
    }
  }

  toggleCascade() {
    var lastSelectedRow = last(this.app?.selectedRows()),
      lastSelectedRowIndex = lastSelectedRow ? this.app?.survey.rows.indexOf(lastSelectedRow) : -1
    this.setState({
      showCascadePopup: !this.state.showCascadePopup,
      cascadeTextareaValue: '',
      cascadeLastSelectedRowIndex: lastSelectedRowIndex,
    })
  }

  cancelCascade() {
    this.setState({
      cascadeReady: false,
      cascadeReadySurvey: undefined,
      cascadeTextareaValue: '',
      showCascadePopup: false,
    })
  }

  cascadePopupChange() {
    const cascadeEl = ReactDOM.findDOMNode(this.refs.cascade)

    if (cascadeEl === null) {
      return
    }

    const textareaEl = cascadeEl as HTMLTextAreaElement

    var s: Partial<EditableFormState> & Pick<EditableFormState, 'cascadeTextareaValue'> = {
      cascadeTextareaValue: textareaEl.value,
    }
    // if (s.cascadeTextareaValue.length === 0) {
    //   return this.cancelCascade();
    // }
    try {
      var inp = dkobo_xlform.model.utils.split_paste(s.cascadeTextareaValue)
      var tmpSurvey = new dkobo_xlform.model.Survey({
        survey: [],
        choices: inp,
      })
      if (tmpSurvey.choices.length === 0) {
        throw new Error(
          // this message is presented to the user
          t('Paste your formatted table from excel in the box below.'),
        )
      }
      tmpSurvey.choices.at(0).create_corresponding_rows()
      /*
      tmpSurvey._addGroup({
        __rows: tmpSurvey.rows.models,
        label: '',
      });
      */
      var rowCount = tmpSurvey.rows.length
      if (rowCount === 0) {
        throw new Error(
          // this message is presented to the user
          t('Paste your formatted table from excel in the box below.'),
        )
      }
      s.cascadeReady = true
      s.cascadeReadySurvey = tmpSurvey
      s.cascadeMessage = {
        msgType: 'ready',
        addCascadeMessage: t('add cascade with # questions').replace('#', rowCount.toString()),
      }
    } catch (err) {
      const errObject = (err as unknown as { message?: string }) || {}
      s.cascadeReady = false
      s.cascadeMessage = {
        msgType: 'warning',
        message: errObject.message,
      }
    }
    this.setState(s)
  }

  renderCascadePopup() {
    return (
      <bem.CascadePopup>
        {this.state.cascadeMessage ? (
          <bem.CascadePopup__message m={this.state.cascadeMessage.msgType}>
            {this.state.cascadeMessage.message}
          </bem.CascadePopup__message>
        ) : (
          <bem.CascadePopup__message m='instructions'>
            {t('Paste your formatted table from excel in the box below.')}
          </bem.CascadePopup__message>
        )}

        {this.state.cascadeReady ? <bem.CascadePopup__message m='ready'>{t('OK')}</bem.CascadePopup__message> : null}

        <textarea ref='cascade' onChange={this.cascadePopupChange.bind(this)} value={this.state.cascadeTextareaValue} />

        {envStore.isReady && envStore.data.support_url && (
          <div className='cascade-help right-tooltip'>
            <a
              href={envStore.data.support_url + CHOICE_LIST_SUPPORT_URL}
              target='_blank'
              data-tip={t('Learn more about importing cascading lists from Excel')}
            >
              <i className='k-icon k-icon-help' />
            </a>
          </div>
        )}

        <bem.CascadePopup__buttonWrapper>
          <Button
            type='primary'
            size='l'
            isDisabled={!this.state.cascadeReady}
            onClick={() => {
              if (this.state.cascadeReadySurvey) {
                this.app?.survey?.insertSurvey(this.state.cascadeReadySurvey, this.state.cascadeLastSelectedRowIndex)
                this.cancelCascade()
              }
            }}
            label={t('DONE')}
          />
        </bem.CascadePopup__buttonWrapper>
      </bem.CascadePopup>
    )
  }

  render() {
    var docTitle = this.state.name || t('Untitled')

    if (!this.state.isNewAsset && !this.state.asset) {
      return (
        <DocumentTitle title={`${docTitle} | KoboToolbox`}>
          <LoadingSpinner />
        </DocumentTitle>
      )
    }

    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <>
          {
            /*
            TODO: Try to fix quirks that arise from this <Prompt/> usage
            Issue: https://github.com/kobotoolbox/kpi/issues/4154
          */
            this.state.preventNavigatingOut && <Prompt />
          }
          <div className='form-builder-wrapper'>
            {this.renderAside()}

            <bem.FormBuilder>
              {this.renderFormBuilderHeader()}

              <bem.FormBuilder__contents>
                {this.state.asset && <FormLockedMessage asset={this.state.asset} />}

                {this.hasBackgroundAudio() && this.renderBackgroundAudioWarning()}

                <div ref='form-wrap' className='form-wrap'>
                  {!this.state.surveyAppRendered && this.renderNotLoadedMessage()}
                </div>
              </bem.FormBuilder__contents>
            </bem.FormBuilder>

            {this.state.enketopreviewOverlay && (
              <Modal open large onClose={this.hidePreview.bind(this)} title={t('Form Preview')}>
                <Modal.Body>
                  <div className='enketo-holder'>
                    <iframe src={this.state.enketopreviewOverlay} />
                  </div>
                </Modal.Body>
              </Modal>
            )}

            {!this.state.enketopreviewOverlay && this.state.enketopreviewError && (
              // This used to have `error` prop, but `modal.tsx` no longer has the prop. I am leaving this comment here
              // as I am not sure how to test this, and maybe the popup should appear differently?
              <Modal open onClose={this.clearPreviewError.bind(this)} title={t('Error generating preview')}>
                <Modal.Body>{this.state.enketopreviewError}</Modal.Body>
              </Modal>
            )}

            {this.state.showCascadePopup && (
              <Modal open onClose={this.hideCascade.bind(this)} title={t('Import Cascading Select Questions')}>
                <Modal.Body>{this.renderCascadePopup()}</Modal.Body>
              </Modal>
            )}
          </div>
        </>
      </DocumentTitle>
    )
  }
}
