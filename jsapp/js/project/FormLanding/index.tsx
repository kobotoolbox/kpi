import { Group, Stack } from '@mantine/core'
import { IconWorldFilled } from '@tabler/icons-react'
import React from 'react'
import CopyToClipboard from 'react-copy-to-clipboard'
import DocumentTitle from 'react-document-title'
import reactMixin from 'react-mixin'
import { Link } from 'react-router-dom'
import { actions } from '#/actions'
import { cloneAssetAsTemplate, deployAsset, unarchiveAsset } from '#/assetQuickActions'
import bem from '#/bem'
import AnonymousSubmission from '#/components/anonymousSubmission.component'
import ButtonNew from '#/components/common/ButtonNew'
import Menu from '#/components/common/Menu'
import Button from '#/components/common/button'
import InlineMessage from '#/components/common/inlineMessage'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { openSharingModal } from '#/components/permissions/openSharingModal'
import permConfig from '#/components/permissions/permConfig'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import { userCan, userCanRemoveSharedProject } from '#/components/permissions/utils'
import LimitNotifications from '#/components/usageLimits/limitNotifications.component'
import { COLLECTION_METHODS, CollectionMethodName, MODAL_TYPES } from '#/constants'
import type { AssetResponse, PermissionResponse } from '#/dataInterface'
import envStore from '#/envStore'
import mixins from '#/mixins'
import pageState from '#/pageState.store'
import { openFormLanguagesModal } from '#/project/FormLanguagesManager'
import { openReplaceProjectModal } from '#/project/ProjectSettings/openReplaceProjectModal'
import CollectMethodSelector from '#/project/collectMethodSelector.component'
import { type WithRouterProps, withRouter } from '#/router/legacy'
import { ROUTES } from '#/router/routerConstants'
import sessionStore from '#/stores/session'
import { ANON_USERNAME, buildUserUrl } from '#/users/utils'
import { formatTime, notify } from '#/utils'
import FormHistory from './FormHistory'

/** `mixins.dmix` reads the asset uid out of the route params. */
type FormLandingProps = WithRouterProps & { params: { uid?: string } }

/**
 * `mixins.dmix` assigns the whole loaded asset onto this component's state, but the state starts out without it -
 * hence all the asset properties being optional here.
 */
type FormLandingState = Partial<AssetResponse> & {
  selectedCollectMethod: CollectionMethodName
  anonymousSubmissions: boolean
  anonymousPermissions: PermissionResponse[]
  /** Toggled by `mixins.dmix`'s `toggleDeploymentHistory`. */
  historyExpanded?: boolean
}

/**
 * URL of the permission that lets anonymous users submit data to a project. This is a function rather than a module
 * constant, because `permConfig` throws when asked before the app has fetched its config.
 */
function getAnonCanAddSubmissionsPermUrl() {
  return permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.add_submissions)?.url
}

/**
 * The URL for collecting data with given method. `null` for the Android app, which has no link, and for methods the
 * deployment didn't give us a link for.
 */
function getCollectMethodLink(asset: AssetResponse, method: CollectionMethodName): string | null {
  if (method === CollectionMethodName.android) {
    return null
  }
  return asset.deployment__links[method] || null
}

class FormLanding extends React.Component<FormLandingProps, FormLandingState> {
  private unlisteners: Function[] = []
  private nonOwnerSelfRemovalUnlistener?: Function

  // These come from `mixins.dmix`, applied through `reactMixin` at the bottom of this file. Keep the `declare` -
  // without it TypeScript emits real fields set to `undefined`, which would shadow the mixin's methods.
  declare removeSharing: () => void
  declare saveCloneAs: (versionId?: string) => void
  declare toggleDeploymentHistory: () => void

  constructor(props: FormLandingProps) {
    super(props)
    this.state = {
      selectedCollectMethod: CollectionMethodName.offline_url,
      anonymousSubmissions: false,
      anonymousPermissions: [],
    }
  }

  componentDidMount() {
    this.unlisteners.push(
      actions.permissions.getAssetPermissions.completed.listen(this.onAssetPermissionsUpdated.bind(this)),
      actions.resources.loadAsset.completed.listen(this.onAssetPermissionsUpdated.bind(this)),
    )

    // `PermProtectedRoute` loads the asset before it renders us, so that first `loadAsset.completed` fired before the
    // listener above existed. We ask for the asset again to get the anonymous permissions we render from.
    const assetUid = this.props.params.uid
    if (assetUid) {
      actions.resources.loadAsset({ id: assetUid })
    }
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb()
    })
    this.nonOwnerSelfRemovalUnlistener?.()
  }

  /**
   * The asset that `mixins.dmix` put into the state, or `undefined` while it's still being loaded. As `dmix` only ever
   * assigns the asset as a whole, `uid` being there means the rest of it is there too.
   */
  private getAsset(): AssetResponse | undefined {
    return this.state.uid ? (this.state as AssetResponse) : undefined
  }

  /**
   * Both actions we listen to end up here: `getAssetPermissions` hands us the permissions, while `loadAsset` hands us
   * the whole asset to dig them out of.
   */
  onAssetPermissionsUpdated(response: AssetResponse | PermissionResponse[]) {
    const permissions = Array.isArray(response) ? response : response.permissions
    const anonCanAddPermUrl = getAnonCanAddSubmissionsPermUrl()
    const publicPerms = permissions.filter((assignment) => assignment.user === buildUserUrl(ANON_USERNAME))
    const anonCanAdd = publicPerms.find((perm) => perm.permission === anonCanAddPermUrl)

    this.setState({
      anonymousPermissions: publicPerms,
      anonymousSubmissions: Boolean(anonCanAdd),
    })
  }

  updateAssetAnonymousSubmissions() {
    const assetUid = this.props.params.uid
    if (!assetUid) {
      return
    }

    const anonCanAddPermUrl = getAnonCanAddSubmissionsPermUrl()
    const permission = this.state.anonymousPermissions.find((perm) => perm.permission === anonCanAddPermUrl)

    if (this.state.anonymousSubmissions) {
      if (permission) {
        actions.permissions.removeAssetPermission(assetUid, permission.url, undefined, undefined, undefined)
      }
    } else {
      actions.permissions.assignAssetPermission(assetUid, {
        user: buildUserUrl(ANON_USERNAME),
        permission: anonCanAddPermUrl,
      })
    }
  }

  handleEnketoPreviewClick(evt: React.MouseEvent<HTMLElement>) {
    evt.preventDefault()
    pageState.showModal({
      type: MODAL_TYPES.ENKETO_PREVIEW,
      assetUrl: this.state.url,
    })
  }

  callUnarchiveAsset(asset: AssetResponse) {
    unarchiveAsset(asset, () => {
      const assetUid = this.props.params.uid
      if (assetUid) {
        actions.resources.loadAsset({ id: assetUid }, true)
      }
    })
  }

  renderFormInfo(asset: AssetResponse, userCanEdit: boolean) {
    let dvcount = asset.deployed_versions.count
    let undeployedVersion: string | undefined
    // Undeployed changes count as a version of their own, so the number we show is one ahead of the deployed count.
    if (!this.isCurrentVersionDeployed(asset)) {
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
            {asset.date_modified && formatTime(asset.date_modified)}&nbsp;-&nbsp;
            <span className='question-count'>
              {asset.summary.row_count || '0'}&nbsp;
              {t('questions')}
            </span>
          </bem.FormView__cell>
        </bem.FormView__cell>
        <bem.FormView__cell m='buttons'>
          {userCanEdit && asset.deployment_status === 'deployed' && (
            <Button
              type='primary'
              size='l'
              isUpperCase
              onClick={() => {
                deployAsset(asset)
              }}
              label={t('redeploy')}
            />
          )}
          {userCanEdit && asset.deployment_status === 'draft' && (
            <Button
              type='primary'
              size='l'
              isUpperCase
              onClick={() => {
                deployAsset(asset)
              }}
              label={t('deploy')}
            />
          )}
          {userCanEdit && asset.deployment_status === 'archived' && (
            <Button
              type='primary'
              size='l'
              isUpperCase
              onClick={() => {
                this.callUnarchiveAsset(asset)
              }}
              label={t('unarchive')}
            />
          )}
        </bem.FormView__cell>
      </bem.FormView__cell>
    )
  }

  handleShareClick(evt: React.MouseEvent<HTMLElement>) {
    evt.preventDefault()
    const asset = this.getAsset()
    if (asset) {
      openSharingModal({ asset })
    }
  }

  handleReplaceFormClick(evt: React.MouseEvent<HTMLElement>) {
    evt.preventDefault()
    const asset = this.getAsset()
    if (asset) {
      openReplaceProjectModal({ asset })
    }
  }

  isCurrentVersionDeployed(asset: AssetResponse) {
    if (asset.deployment__active && asset.deployed_versions.count > 0 && asset.deployed_version_id) {
      const deployedVersion = asset.deployed_versions.results.find(
        (version) => version.uid === asset.deployed_version_id,
      )
      return deployedVersion?.content_hash === asset.version__content_hash
    }
    return false
  }

  isFormRedeploymentNeeded(asset: AssetResponse) {
    return !this.isCurrentVersionDeployed(asset) && userCan('change_asset', asset)
  }

  hasLanguagesDefined(translations: Array<string | null> | undefined) {
    return Boolean(translations && (translations.length > 1 || translations[0] !== null))
  }

  showLanguagesModal(evt: React.MouseEvent<HTMLElement>) {
    evt.preventDefault()
    const asset = this.getAsset()
    if (asset) {
      openFormLanguagesModal(asset)
    }
  }

  renderHistory(asset: AssetResponse) {
    return (
      <bem.FormView__row className={this.state.historyExpanded ? 'historyExpanded' : 'historyHidden'}>
        <bem.FormView__cell m={['columns', 'label', 'first', 'history-label']}>
          <bem.FormView__cell m='label'>{t('Form history')}</bem.FormView__cell>
        </bem.FormView__cell>

        <bem.FormView__cell m={['history-table']}>
          <FormHistory
            isEnabled={Boolean(this.state.historyExpanded)}
            assetUid={asset.uid}
            deployedVersionId={asset.deployed_version_id ?? undefined}
            deployedVersionsCount={asset.deployed_versions.count}
            deploymentActive={asset.deployment__active}
            deploymentStatus={asset.deployment_status}
            onClone={(versionUid) => this.saveCloneAs(versionUid)}
          />
        </bem.FormView__cell>
        {asset.deployed_versions.count > 1 && (
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

  renderCollectData(asset: AssetResponse) {
    const chosenMethod = this.state.selectedCollectMethod
    const chosenMethodLink = getCollectMethodLink(asset, chosenMethod)

    // KoboCollect wants just the origin, and `open_rosa_server` is a full URL - let the DOM parse it out for us.
    const openRosaServerAnchor = document.createElement('a')
    openRosaServerAnchor.href = envStore.data.open_rosa_server
    const kobocollectUrl = openRosaServerAnchor.origin

    return (
      <bem.FormView__row>
        <bem.FormView__cell m={['label', 'first']}>{t('Collect data')}</bem.FormView__cell>
        <bem.FormView__cell m='box'>
          <bem.FormView__cell m={['columns', 'padding', 'collect-header']}>
            <bem.FormView__cell>
              <CollectMethodSelector
                onChange={(newMethod) => {
                  this.setCollectMethod(newMethod)
                }}
                selectedMethod={chosenMethod}
              />
            </bem.FormView__cell>

            <bem.FormView__cell className='collect-header-actions'>{this.renderCollectLink(asset)}</bem.FormView__cell>
          </bem.FormView__cell>

          <Stack pb='lg' pl='lg' pr='lg' className='collect-meta-description'>
            {chosenMethod !== CollectionMethodName.android && COLLECTION_METHODS[chosenMethod].desc}

            {chosenMethod === CollectionMethodName.iframe_url && (
              <pre>{`<iframe src="${chosenMethodLink}" width="800" height="600"></iframe>`}</pre>
            )}

            {chosenMethod === CollectionMethodName.android && (
              <ol>
                <li>
                  {t('Install')}
                  &nbsp;
                  <a
                    href='https://play.google.com/store/apps/details?id=org.koboc.collect.android&hl=en'
                    target='_blank'
                  >
                    KoboCollect
                  </a>
                  &nbsp;
                  {t('on your Android device.')}
                </li>
                <li>{t('Select the option "Manually enter project details"')}</li>
                <li>
                  {t('Enter the server URL')}&nbsp;
                  <code>{kobocollectUrl}</code>&nbsp;
                  {t('and your username and password')}
                </li>
                <li>{t('Select "Download form" and select this project')}</li>
                <li>{t('Select "Start New Form"')}</li>
                <li>{t('Select this project from the list of downloaded projects')}</li>
              </ol>
            )}
          </Stack>

          {userCan('change_asset', asset) && (
            <bem.FormView__cell m={['padding', 'anonymous-submissions', 'bordertop']}>
              <AnonymousSubmission
                checked={this.state.anonymousSubmissions}
                // This whole block is already behind a `change_asset` check, so the toggle is always usable here.
                disabled={false}
                onChange={() => this.updateAssetAnonymousSubmissions()}
              />
            </bem.FormView__cell>
          )}
        </bem.FormView__cell>
      </bem.FormView__row>
    )
  }

  renderCollectLink(asset: AssetResponse) {
    const chosenMethod = this.state.selectedCollectMethod
    const chosenMethodLink = getCollectMethodLink(asset, chosenMethod)

    if (chosenMethod === CollectionMethodName.android) {
      return (
        <Button
          type='secondary'
          size='m'
          onClick={() => {
            window.open(COLLECTION_METHODS.android.url, '_blank')
          }}
          label={t('Download KoboCollect')}
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

    if (chosenMethod === CollectionMethodName.iframe_url) {
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

  setCollectMethod(newMethod: CollectionMethodName) {
    this.setState({ selectedCollectMethod: newMethod })
  }

  goToProjectsList() {
    this.props.router.navigate(ROUTES.FORMS)
  }

  handleNonOwnerSelfRemovalClick(evt: React.MouseEvent<HTMLElement>) {
    evt.preventDefault()
    // Subscribe only for this one removal - a `manage_asset` user removing somebody else must not redirect us.
    this.nonOwnerSelfRemovalUnlistener = actions.permissions.removeAssetPermission.completed.listen(
      this.nonOwnerSelfRemovalCompleted.bind(this),
    )
    this.removeSharing()
  }

  nonOwnerSelfRemovalCompleted() {
    this.nonOwnerSelfRemovalUnlistener?.()
    this.nonOwnerSelfRemovalUnlistener = undefined
    this.goToProjectsList()
  }

  renderButtons(asset: AssetResponse, userCanEdit: boolean) {
    const downloads = asset.downloads || []
    const isLoggedIn = sessionStore.isLoggedIn

    return (
      <React.Fragment>
        {userCanEdit ? (
          <Link to={`/forms/${asset.uid}/edit`}>
            {/*
              We put non clickable button inside Link, so that it's possible
              to open it in new tab.
            */}
            <Button type='text' size='m' startIcon='edit' tooltip={t('Edit in Form Builder')} tooltipPosition='right' />
          </Link>
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
          onClick={this.handleEnketoPreviewClick.bind(this)}
          isDisabled={!asset.url}
        />

        {userCanEdit && (
          <Button
            type='text'
            size='m'
            startIcon='replace'
            tooltip={t('Replace form')}
            tooltipPosition='right'
            onClick={this.handleReplaceFormClick.bind(this)}
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
                {dl.format.toUpperCase()}
              </Menu.Item>
            ))}

            {userCanEdit && (
              <Menu.Item
                onClick={this.handleShareClick.bind(this)}
                leftSection={<i className='k-icon k-icon-user-share' />}
              >
                {t('Share this project')}
              </Menu.Item>
            )}

            {isLoggedIn && userCanRemoveSharedProject(asset) && (
              <Menu.Item
                onClick={this.handleNonOwnerSelfRemovalClick.bind(this)}
                leftSection={<i className='k-icon k-icon-trash' />}
              >
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
                  cloneAssetAsTemplate(asset.uid, asset.name)
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

  renderLanguages(asset: AssetResponse, canEdit: boolean) {
    const translations = asset.content?.translations

    return (
      <bem.FormView__cell m={['columns', 'padding', 'bordertop']}>
        <bem.FormView__cell m='translation-list'>
          <strong>{t('Languages:')}</strong>
          &nbsp;
          {!this.hasLanguagesDefined(translations) && t('This project has no languages defined yet')}
          {this.hasLanguagesDefined(translations) && (
            <ul>
              {translations?.map((langString, n) => (
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
    const asset = this.getAsset()

    if (!asset) {
      return <LoadingSpinner />
    }

    const docTitle = asset.name || t('Untitled')
    const userCanEdit = userCan('change_asset', asset)
    const isLoggedIn = sessionStore.isLoggedIn

    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <bem.FormView m='form'>
          <LimitNotifications />
          <bem.FormView__row>
            <bem.FormView__cell m={['columns', 'first']}>
              <bem.FormView__cell m='label'>
                {asset.deployment__active
                  ? t('Current version')
                  : asset.has_deployment
                    ? t('Archived version')
                    : t('Draft version')}
              </bem.FormView__cell>
              <bem.FormView__cell m='action-buttons'>{this.renderButtons(asset, userCanEdit)}</bem.FormView__cell>
            </bem.FormView__cell>
            <bem.FormView__cell m='box'>
              {this.isFormRedeploymentNeeded(asset) && (
                <Stack pt='lg' pl='lg' pr='lg'>
                  <InlineMessage
                    icon='alert'
                    type='warning'
                    message={t('If you want to make these changes public, you must deploy this form.')}
                  />
                </Stack>
              )}
              {this.renderFormInfo(asset, userCanEdit)}
              {this.renderLanguages(asset, userCanEdit)}
            </bem.FormView__cell>
          </bem.FormView__row>
          {asset.deployed_versions.count > 0 && this.renderHistory(asset)}
          {asset.deployed_versions.count > 0 && asset.deployment__active && isLoggedIn && this.renderCollectData(asset)}
        </bem.FormView>
      </DocumentTitle>
    )
  }
}

reactMixin(FormLanding.prototype, mixins.dmix)

export default withRouter(FormLanding)
