import { Group, Stack } from '@mantine/core'
import { IconWorldFilled } from '@tabler/icons-react'
import React from 'react'
import autoBind from 'react-autobind'
import CopyToClipboard from 'react-copy-to-clipboard'
import DocumentTitle from 'react-document-title'
import reactMixin from 'react-mixin'
import { Link } from 'react-router-dom'
import Reflux from 'reflux'
import { actions } from '#/actions'
import { cloneAssetAsTemplate, deployAsset, unarchiveAsset } from '#/assetQuickActions'
import bem from '#/bem'
import AnonymousSubmission from '#/components/anonymousSubmission.component'
import ToggleSwitch from '#/components/common/toggleSwitch'
import ButtonNew from '#/components/common/ButtonNew'
import Menu from '#/components/common/Menu'
import Button from '#/components/common/button'
import InlineMessage from '#/components/common/inlineMessage'
import LoadingSpinner from '#/components/common/loadingSpinner'
import NewFeatureDialog from '#/components/newFeatureDialog.component'
import permConfig from '#/components/permissions/permConfig'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import { userCan, userCanRemoveSharedProject } from '#/components/permissions/utils'
import { COLLECTION_METHODS, HELP_ARTICLE_ANON_SUBMISSIONS_URL, MODAL_TYPES } from '#/constants'
import envStore from '#/envStore'
import mixins from '#/mixins'
import pageState from '#/pageState.store'
import { openFormLanguagesModal } from '#/project/FormLanguagesManager'
import CollectMethodSelector from '#/project/collectMethodSelector.component'
import { withRouter } from '#/router/legacy'
import { ROUTES } from '#/router/routerConstants'
import sessionStore from '#/stores/session'
import { ANON_USERNAME, buildUserUrl } from '#/users/utils'
import { formatTime, notify, recordKeys } from '#/utils'
import LimitNotifications from '../usageLimits/limitNotifications.component'
import FormHistory from './FormHistory'

const ANON_CAN_ADD_PERM_URL = permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.add_submissions).url

class FormLanding extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      selectedCollectMethod: COLLECTION_METHODS.offline_url.id,
      anonymousSubmissions: false,
      anonymousPermissions: [],
    }
    autoBind(this)
  }
  componentDidMount() {
    this.listenTo(actions.permissions.getAssetPermissions.completed, this.onAssetPermissionsUpdated)
    this.listenTo(actions.resources.loadAsset.completed, this.onAssetPermissionsUpdated)

    actions.resources.loadAsset({ id: this.props.params.uid })
  }

  onAssetPermissionsUpdated(res) {
    let response = res
    if (response.permissions) {
      response = res.permissions
    }
    const publicPerms = response.filter((assignment) => assignment.user === buildUserUrl(ANON_USERNAME))
    const anonCanAdd = publicPerms.filter((perm) => perm.permission === ANON_CAN_ADD_PERM_URL)[0]
    this.setState({
      anonymousPermissions: publicPerms,
      anonymousSubmissions: Boolean(anonCanAdd),
    })
  }
  updateAssetAnonymousSubmissions() {
    const permission = this.state.anonymousPermissions.find(
      (perm) => perm.permission === permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.add_submissions).url,
    )
    if (this.state.anonymousSubmissions) {
      actions.permissions.removeAssetPermission(this.props.params.uid, permission.url, undefined, undefined, undefined)
    } else {
      actions.permissions.assignAssetPermission(this.props.params.uid, {
        user: buildUserUrl(ANON_USERNAME),
        permission: ANON_CAN_ADD_PERM_URL,
      })
    }
  }
  togglePrintSetting() {
    const settings = { ...this.state.settings }
    const currentHide = settings.hide_print === true
    if (currentHide) {
      settings.hide_print = false
    } else {
      settings.hide_print = true
    }
    this.setState({ settings: settings })
    actions.resources.updateAsset(this.state.uid, { settings: settings })
  }
  toggleMenuSetting() {
    const settings = { ...this.state.settings }
    const currentHide = settings.hide_menu === true
    if (currentHide) {
      settings.hide_menu = false
    } else {
      settings.hide_menu = true
    }
    this.setState({ settings: settings })
    actions.resources.updateAsset(this.state.uid, { settings: settings })
  }
  getFormattedCollectLink(originalLink) {
    if (!originalLink) {
      return originalLink
    }
    const settings = this.state.settings || {}
    let url
    try {
      url = new URL(originalLink)
      if (settings.hide_print === true) {
        url.searchParams.set('hide_print', 'true')
      }
      if (settings.hide_menu === true) {
        url.searchParams.set('hide_menu', 'true')
      }
      return url.toString()
    } catch (e) {
      let link = originalLink
      if (settings.hide_print === true) {
        link += (link.includes('?') ? '&' : '?') + 'hide_print=true'
      }
      if (settings.hide_menu === true) {
        link += (link.includes('?') ? '&' : '?') + 'hide_menu=true'
      }
      return link
    }
  }
  enketoPreviewModal(evt) {
    evt.preventDefault()
    pageState.showModal({
      type: MODAL_TYPES.ENKETO_PREVIEW,
      assetUrl: this.state.url,
    })
  }
  callUnarchiveAsset() {
    // This component is using `mixins.dmix`, so the asset object is being stored in state
    unarchiveAsset(this.state, () => {
      actions.resources.loadAsset({ id: this.props.params.uid }, true)
    })
  }
  renderFormInfo(userCanEdit) {
    var dvcount = this.state.deployed_versions.count
    var undeployedVersion
    if (!this.isCurrentVersionDeployed()) {
      undeployedVersion = `(${t('undeployed')})`
      dvcount = dvcount + 1
    }
    return (
      <bem.FormView__cell m={['columns', 'padding']}>
        <bem.FormView__cell>
          <bem.FormView__cell m='version'>{dvcount > 0 ? `v${dvcount}` : ''}</bem.FormView__cell>
          {undeployedVersion && userCanEdit && (
            <bem.FormView__cell m='undeployed'>&nbsp;{undeployedVersion}</bem.FormView__cell>
          )}
          <bem.FormView__cell m='date'>
            {t('Last Modified')}&nbsp;:&nbsp;
            {formatTime(this.state.date_modified)}&nbsp;-&nbsp;
            <span className='question-count'>
              {this.state.summary.row_count || '0'}&nbsp;
              {t('questions')}
            </span>
          </bem.FormView__cell>
        </bem.FormView__cell>
        <bem.FormView__cell m='buttons'>
          {userCanEdit && this.state.deployment_status === 'deployed' && (
            <Button
              type='primary'
              size='l'
              isUpperCase
              onClick={() => {
                deployAsset(this.state)
              }}
              label={t('redeploy')}
            />
          )}
          {userCanEdit && this.state.deployment_status === 'draft' && (
            <Button
              type='primary'
              size='l'
              isUpperCase
              onClick={() => {
                deployAsset(this.state)
              }}
              label={t('deploy')}
            />
          )}
          {userCanEdit && this.state.deployment_status === 'archived' && (
            <Button
              type='primary'
              size='l'
              isUpperCase
              onClick={this.callUnarchiveAsset.bind(this)}
              label={t('unarchive')}
            />
          )}
        </bem.FormView__cell>
      </bem.FormView__cell>
    )
  }
  showSharingModal(evt) {
    evt.preventDefault()
    pageState.showModal({
      type: MODAL_TYPES.SHARING,
      assetid: this.state.uid,
    })
  }
  showReplaceProjectModal(evt) {
    evt.preventDefault()
    pageState.showModal({
      type: MODAL_TYPES.REPLACE_PROJECT,
      asset: this.state,
    })
  }
  isCurrentVersionDeployed() {
    if (this.state.deployment__active && this.state.deployed_versions.count > 0 && this.state.deployed_version_id) {
      const deployed_version = this.state.deployed_versions.results.find(
        (version) => version.uid === this.state.deployed_version_id,
      )
      return deployed_version.content_hash === this.state.version__content_hash
    }
    return false
  }
  isFormRedeploymentNeeded() {
    return !this.isCurrentVersionDeployed() && userCan('change_asset', this.state)
  }
  hasLanguagesDefined(translations) {
    return translations && (translations.length > 1 || translations[0] !== null)
  }
  showLanguagesModal(evt) {
    evt.preventDefault()
    openFormLanguagesModal(this.state)
  }
  renderHistory() {
    return (
      <bem.FormView__row className={this.state.historyExpanded ? 'historyExpanded' : 'historyHidden'}>
        <bem.FormView__cell m={['columns', 'label', 'first', 'history-label']}>
          <bem.FormView__cell m='label'>{t('Form history')}</bem.FormView__cell>
        </bem.FormView__cell>

        <bem.FormView__cell m={['history-table']}>
          <FormHistory
            isEnabled={Boolean(this.state.historyExpanded)}
            assetUid={this.props.params.uid}
            deployedVersionId={this.state.deployed_version_id}
            deployedVersionsCount={this.state.deployed_versions.count}
            deploymentActive={this.state.deployment__active}
            deploymentStatus={this.state.deployment_status}
            onClone={(versionUid) => this.saveCloneAs(versionUid)}
          />
        </bem.FormView__cell>
        {this.state.deployed_versions.count > 1 && (
          <Group justify='center' gap='md' pt={this.state.historyExpanded ? 'md' : 0}>
            <ButtonNew
              size='md'
              onClick={this.toggleDeploymentHistory.bind(this)}
              leftIcon={this.state.historyExpanded ? 'angle-up' : 'angle-down'}
              variant='transparent'
            >
              {this.state.historyExpanded ? t('Hide full history') : t('Show full history')}
            </ButtonNew>
          </Group>
        )}
      </bem.FormView__row>
    )
  }
  renderCollectData() {
    const deployment__links_list = []
    recordKeys(COLLECTION_METHODS).forEach((methodId) => {
      const methodDef = COLLECTION_METHODS[methodId]
      deployment__links_list.push({
        key: methodDef.id,
        label: methodDef.label,
        desc: methodDef.desc,
      })
    })

    const chosenMethod = this.state.selectedCollectMethod
    const chosenMethodLink = this.state.deployment__links[chosenMethod] || null

    return (
      <bem.FormView__row>
        <bem.FormView__cell m={['label', 'first']}>{t('Collect data')}</bem.FormView__cell>
        <bem.FormView__cell m='box' style={{ overflow: 'visible' }}>
          <bem.FormView__cell m={['columns', 'padding', 'collect-header']}>
            <bem.FormView__cell>
              <CollectMethodSelector
                onChange={(newMethod) => {
                  this.setCollectMethod(newMethod)
                }}
                selectedMethod={chosenMethod}
              />
            </bem.FormView__cell>

            <bem.FormView__cell className='collect-header-actions'>{this.renderCollectLink()}</bem.FormView__cell>
          </bem.FormView__cell>

          <Stack pb='lg' pl='lg' pr='lg' className='collect-meta-description'>
            {chosenMethod !== COLLECTION_METHODS.android.id && COLLECTION_METHODS[chosenMethod].desc}

            {chosenMethod === COLLECTION_METHODS.iframe_url.id && (
              <pre>{`<iframe src="${chosenMethodLink}" width="800" height="600"></iframe>`}</pre>
            )}

            {chosenMethod === COLLECTION_METHODS.android.id && (
              <ol>
                <li>
                  {t('Install DataUMSA Collect on your Android device from:')}
                  &nbsp;
                  <a
                    href={COLLECTION_METHODS.android.url}
                    target='_blank'
                  >
                    https://dataumsa.sociest.org/app-movil/descargas/
                  </a>
                </li>
                <li>
                  {t('Enter your project credentials to connect, as the URL is automatically configured within the DataUMSA Collect app.')}
                </li>
                <li>{t('Select "Download form" and select this project')}</li>
                <li>{t('Select "Start New Form"')}</li>
                <li>{t('Select this project from the list of downloaded projects')}</li>
              </ol>
            )}
          </Stack>

          {userCan('change_asset', this.state) && (
            <bem.FormView__cell m={['padding', 'anonymous-submissions', 'bordertop']}>
              <NewFeatureDialog
                content={t(
                  'You can now control whether to allow anonymous submissions for each project. Previously, this was an account-wide setting.',
                )}
                supportArticle={envStore.data.support_url + HELP_ARTICLE_ANON_SUBMISSIONS_URL}
                featureKey='anonymousSubmissions'
                disabled={pageState.state?.modal}
                pointerClass='anonymousSubmissionPointer'
                dialogClass='anonymousSubmissionDialog'
              >
                <AnonymousSubmission
                  checked={this.state.anonymousSubmissions}
                  onChange={() => this.updateAssetAnonymousSubmissions()}
                />
              </NewFeatureDialog>
            </bem.FormView__cell>
          )}

          {userCan('change_asset', this.state) && (
            <bem.FormView__cell m={['padding', 'bordertop']} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <ToggleSwitch
                  checked={!this.state.settings?.hide_print}
                  onChange={this.togglePrintSetting}
                  label={t('Enable print button in the digital form')}
                />
              </div>
              <div>
                <ToggleSwitch
                  checked={!this.state.settings?.hide_menu}
                  onChange={this.toggleMenuSetting}
                  label={t('Enable navigation menu in the digital form')}
                />
              </div>
            </bem.FormView__cell>
          )}
        </bem.FormView__cell>
      </bem.FormView__row>
    )
  }

  renderCollectLink() {
    const chosenMethod = this.state.selectedCollectMethod
    const rawLink = this.state.deployment__links[chosenMethod] || null
    const chosenMethodLink = this.getFormattedCollectLink(rawLink)

    if (chosenMethod === COLLECTION_METHODS.android.id) {
      return (
        <Button
          type='secondary'
          size='m'
          onClick={() => {
            window.open(COLLECTION_METHODS.android.url, '_blank')
          }}
          label={t('Download DataUMSA Collect')}
        />
      )
    }

    if (chosenMethodLink === null) {
      return (
        <span
          className='collect-link-missing right-tooltip'
          data-tip={t("Try reloading the page, if problem doesn't go away, contact support.")}
        >
          <i className='k-icon k-icon-alert' />
          {t('Link missing')}
        </span>
      )
    }

    if (chosenMethod === COLLECTION_METHODS.iframe_url.id) {
      return (
        <CopyToClipboard
          text={`<iframe src=${chosenMethodLink} width="800" height="600"></iframe>`}
          onCopy={() => {
            notify(t('Copied to clipboard'))
          }}
          options={{ format: 'text/plain' }}
        >
          <Button type='secondary' size='m' label={t('Copy')} />
        </CopyToClipboard>
      )
    }

    return (
      <React.Fragment>
        <CopyToClipboard
          text={chosenMethodLink}
          onCopy={() => {
            notify(t('Copied to clipboard'))
          }}
          options={{ format: 'text/plain' }}
        >
          <Button type='secondary' size='m' label={t('Copy')} />
        </CopyToClipboard>

        <Button
          type='secondary'
          size='m'
          onClick={() => {
            window.open(chosenMethodLink, '_blank')
          }}
          label={t('Open')}
        />
      </React.Fragment>
    )
  }

  setCollectMethod(newMethod) {
    this.setState({ selectedCollectMethod: newMethod })
  }

  goToProjectsList() {
    this.props.router.navigate(ROUTES.FORMS)
  }
  nonOwnerSelfRemoval(evt) {
    evt.preventDefault()
    // Listen for permission removal here to avoid manage_asset user removal
    // from triggering redirect
    this.nonOwnerSelfRemovalListener = this.listenTo(
      actions.permissions.removeAssetPermission.completed,
      this.nonOwnerSelfRemovalCompleted,
    )
    this.removeSharing()
  }
  nonOwnerSelfRemovalCompleted() {
    // Remove listener after self removal
    if (this.nonOwnerSelfRemovalListener) {
      this.stopListeningTo(actions.permissions.removeAssetPermission.completed)
    }
    this.goToProjectsList()
  }
  handleEditClick(evt) {
    evt.preventDefault()
    const warningMessage = t(
      'Warning: If this form was originally created using advanced XLSForm features, editing it in the Form Builder could result in the loss of some special configurations or data.\n\nDo you want to continue to the Form Builder?'
    )
    if (window.confirm(warningMessage)) {
      this.props.router.navigate(ROUTES.FORM_EDIT.replace(':uid', this.state.uid))
    }
  }
  renderButtons(userCanEdit) {
    var downloads = []
    if (this.state.downloads) {
      downloads = this.state.downloads
    }

    const isLoggedIn = sessionStore.isLoggedIn

    return (
      <React.Fragment>
        {userCanEdit ? (
          <Button
            type='text'
            size='m'
            startIcon='edit'
            tooltip={t('Edit in Form Builder')}
            tooltipPosition='right'
            onClick={this.handleEditClick.bind(this)}
          />
        ) : (
          <Button
            type='text'
            size='m'
            startIcon='edit'
            tooltip={t('Editing capabilities not granted, you can only view this form')}
            tooltipPosition='right'
            isDisabled
          />
        )}

        <Button
          type='text'
          size='m'
          startIcon='view'
          tooltip={t('Preview')}
          tooltipPosition='right'
          onClick={this.enketoPreviewModal.bind(this)}
          isDisabled={!this.state.url}
        />

        {userCanEdit && (
          <Button
            type='text'
            size='m'
            startIcon='replace'
            tooltip={t('Replace form')}
            tooltipPosition='right'
            onClick={this.showReplaceProjectModal.bind(this)}
          />
        )}

        <Menu>
          <Menu.Target>
            <ButtonNew variant='transparent' size='md' leftIcon='more' tooltip={t('More actions')} />
          </Menu.Target>
          <Menu.Dropdown>
            {downloads.map((dl) => (
              <Menu.Item
                component='a'
                href={dl.url}
                key={`dl-${dl.format}`}
                leftSection={<i className={`k-icon k-icon-file-${dl.format}`} />}
              >
                {t('Download')}&nbsp;
                {dl.format.toString().toUpperCase()}
              </Menu.Item>
            ))}

            {userCanEdit && (
              <Menu.Item onClick={this.showSharingModal} leftSection={<i className='k-icon k-icon-user-share' />}>
                {t('Share this project')}
              </Menu.Item>
            )}

            {isLoggedIn && userCanRemoveSharedProject(this.state) && (
              <Menu.Item onClick={this.nonOwnerSelfRemoval} leftSection={<i className='k-icon k-icon-trash' />}>
                {t('Remove shared project')}
              </Menu.Item>
            )}

            {isLoggedIn && (
              <Menu.Item onClick={() => this.saveCloneAs()} leftSection={<i className='k-icon k-icon-duplicate' />}>
                {t('Clone this project')}
              </Menu.Item>
            )}

            {isLoggedIn && (
              <Menu.Item
                onClick={() => {
                  cloneAssetAsTemplate(this.state.uid, this.state.name)
                }}
                leftSection={<i className='k-icon k-icon-template' />}
              >
                {t('Create template')}
              </Menu.Item>
            )}
          </Menu.Dropdown>
        </Menu>
      </React.Fragment>
    )
  }
  renderLanguages(canEdit) {
    const translations = this.state.content.translations

    return (
      <bem.FormView__cell m={['columns', 'padding', 'bordertop']}>
        <bem.FormView__cell m='translation-list'>
          <strong>{t('Languages:')}</strong>
          &nbsp;
          {!this.hasLanguagesDefined(translations) && t('This project has no languages defined yet')}
          {this.hasLanguagesDefined(translations) && (
            <ul>
              {translations.map((langString, n) => (
                <li key={n}>{langString || t('Unnamed language')}</li>
              ))}
            </ul>
          )}
        </bem.FormView__cell>

        {canEdit && (
          <bem.FormView__cell>
            <ButtonNew
              variant='outline'
              size='md'
              rightIcon={IconWorldFilled}
              onClick={this.showLanguagesModal.bind(this)}
            >
              {t('Manage')}
            </ButtonNew>
          </bem.FormView__cell>
        )}
      </bem.FormView__cell>
    )
  }
  render() {
    var docTitle = this.state.name || t('Untitled')
    const userCanEdit = userCan('change_asset', this.state)
    const isLoggedIn = sessionStore.isLoggedIn

    if (this.state.uid === undefined) {
      return <LoadingSpinner />
    }

    return (
      <DocumentTitle title={`${docTitle} | DATAUMSA`}>
        <bem.FormView m='form'>
          <LimitNotifications />
          <bem.FormView__row>
            <bem.FormView__cell m={['columns', 'first']}>
              <bem.FormView__cell m='label'>
                {this.state.deployment__active
                  ? t('Current version')
                  : this.state.has_deployment
                    ? t('Archived version')
                    : t('Draft version')}
              </bem.FormView__cell>
              <bem.FormView__cell m='action-buttons'>{this.renderButtons(userCanEdit)}</bem.FormView__cell>
            </bem.FormView__cell>
            <bem.FormView__cell m='box'>
              {this.isFormRedeploymentNeeded() && (
                <Stack pt='lg' pl='lg' pr='lg'>
                  <InlineMessage
                    icon='alert'
                    type='warning'
                    message={t('If you want to make these changes public, you must deploy this form.')}
                  />
                </Stack>
              )}
              {this.renderFormInfo(userCanEdit)}
              {this.renderLanguages(userCanEdit)}
            </bem.FormView__cell>
          </bem.FormView__row>
          {this.state.deployed_versions.count > 0 && this.renderHistory()}
          {this.state.deployed_versions.count > 0 &&
            this.state.deployment__active &&
            isLoggedIn &&
            this.renderCollectData()}
        </bem.FormView>
      </DocumentTitle>
    )
  }
}

reactMixin(FormLanding.prototype, mixins.dmix)
reactMixin(FormLanding.prototype, Reflux.ListenerMixin)

export default withRouter(FormLanding)
