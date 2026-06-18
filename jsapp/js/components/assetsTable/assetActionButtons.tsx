/**
 * This is intended to be displayed in multiple places:
 * - library asset landing page
 * - library listing row
 * - project landing page (see: https://github.com/kobotoolbox/kpi/issues/2758)
 * - projects listing row (see: https://github.com/kobotoolbox/kpi/issues/2758)
 */
import './assetActionButtons.scss'

import React from 'react'

import { IconWorldFilled } from '@tabler/icons-react'
import autoBind from 'react-autobind'
import { Link } from 'react-router-dom'
import { actions } from '#/actions'
import {
  archiveAsset,
  cloneAsset,
  cloneAssetAsSurvey,
  cloneAssetAsTemplate,
  deployAsset,
  manageAssetLanguages,
  manageAssetSettings,
  manageAssetSharing,
  modifyAssetTags,
  replaceAssetForm,
  unarchiveAsset,
} from '#/assetQuickActions'
import assetUtils from '#/assetUtils'
import { openDeleteAssetModal } from '#/components/DeleteAssetModal/openDeleteAssetModal'
import Button from '#/components/common/button'
import type { ButtonType } from '#/components/common/button'
import ButtonNew from '#/components/common/ButtonNew'
import Menu from '#/components/common/Menu'
import managedCollectionsStore from '#/components/library/managedCollectionsStore'
import type { ManagedCollectionsStoreData } from '#/components/library/managedCollectionsStore'
import { userCan } from '#/components/permissions/utils'
import { ACCESS_TYPES, ASSET_TYPES } from '#/constants'
import type { AssetDownloads, AssetResponse } from '#/dataInterface'
import type { IconName } from '#/k-icons'
import { withRouter } from '#/router/legacy'
import type { WithRouterProps } from '#/router/legacy'
import { ROUTES } from '#/router/routerConstants'
import { getRouteAssetUid, isAnyFormRoute, isAnyLibraryItemRoute } from '#/router/routerUtils'
import KoboIcon from '../common/KoboIcon'

interface AssetActionButtonsProps extends WithRouterProps {
  asset: AssetResponse
  has_deployment?: boolean
  deployment__active?: boolean
}

interface AssetActionButtonsState {
  managedCollections: AssetResponse[]
  isSubscribePending: boolean
}

class AssetActionButtons extends React.Component<AssetActionButtonsProps, AssetActionButtonsState> {
  private unlisteners: Function[] = []

  constructor(props: AssetActionButtonsProps) {
    super(props)
    this.state = {
      managedCollections: managedCollectionsStore.data.collections,
      isSubscribePending: false,
    }
    autoBind(this)
  }

  componentDidMount() {
    managedCollectionsStore.listen(this.onManagedCollectionsStoreChanged.bind(this), this)
    this.unlisteners.push(
      actions.library.subscribeToCollection.completed.listen(this.onSubscribingCompleted.bind(this)),
      actions.library.unsubscribeFromCollection.completed.listen(this.onSubscribingCompleted.bind(this)),
    )
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb()
    })
  }

  onSubscribingCompleted() {
    this.setState({ isSubscribePending: false })
  }

  onManagedCollectionsStoreChanged(storeData: ManagedCollectionsStoreData) {
    this.setState({ managedCollections: storeData.collections })
  }

  // Methods for managing the asset

  modifyDetails() {
    manageAssetSettings(this.props.asset)
  }

  editLanguages() {
    manageAssetLanguages(this.props.asset)
  }

  share() {
    manageAssetSharing(this.props.asset.uid)
  }

  showTagsModal() {
    modifyAssetTags(this.props.asset)
  }

  replace() {
    replaceAssetForm(this.props.asset)
  }

  delete() {
    openDeleteAssetModal(
      this.props.asset,
      assetUtils.getAssetDisplayName(this.props.asset).final,
      this.onDeleteComplete.bind(this, this.props.asset.uid),
    )
  }

  /**
   * Navigates out of nonexistent paths after asset was successfully deleted
   */
  onDeleteComplete(assetUid: string) {
    if (isAnyLibraryItemRoute() && getRouteAssetUid() === assetUid) {
      this.props.router.navigate(ROUTES.LIBRARY)
    }
    if (isAnyFormRoute() && getRouteAssetUid() === assetUid) {
      this.props.router.navigate(ROUTES.FORMS)
    }
  }

  deploy() {
    deployAsset(this.props.asset)
  }

  archive() {
    archiveAsset(this.props.asset)
  }

  unarchive() {
    unarchiveAsset(this.props.asset)
  }

  clone() {
    cloneAsset(this.props.asset)
  }

  cloneAsSurvey() {
    cloneAssetAsSurvey(this.props.asset.uid, assetUtils.getAssetDisplayName(this.props.asset).final)
  }

  cloneAsTemplate() {
    cloneAssetAsTemplate(this.props.asset.uid, assetUtils.getAssetDisplayName(this.props.asset).final)
  }

  /** Pass `null` to remove from collection. */
  moveToCollection(collectionUrl: string | null) {
    actions.library.moveToCollection(this.props.asset.uid, collectionUrl)
  }

  subscribeToCollection() {
    this.setState({ isSubscribePending: true })
    actions.library.subscribeToCollection(this.props.asset.url)
  }

  unsubscribeFromCollection() {
    this.setState({ isSubscribePending: true })
    actions.library.unsubscribeFromCollection(this.props.asset.uid)
  }

  viewContainingCollection() {
    if (this.props.asset.parent === null) {
      return
    }
    const parentArr = this.props.asset.parent.split('/')
    const parentAssetUid = parentArr[parentArr.length - 2]
    this.props.router.navigate(ROUTES.LIBRARY_ITEM.replace(':uid', parentAssetUid))
  }

  getFormBuilderLink() {
    let link = ROUTES.EDIT_LIBRARY_ITEM.replace(':uid', this.props.asset.uid)

    // when editing a child from within a collection page
    // make sure the "Return to list" button goes back to collection
    const currentAssetUid = getRouteAssetUid()
    if (
      this.props.asset.asset_type !== ASSET_TYPES.collection.id &&
      this.props.asset.parent !== null &&
      currentAssetUid !== null &&
      this.props.asset.parent.includes(currentAssetUid)
    ) {
      const backPath = ROUTES.LIBRARY_ITEM.replace(':uid', currentAssetUid)
      link += `?back=${backPath}`
    }

    return link
  }

  renderMoreActionsTrigger() {
    const assetType = this.props.asset.asset_type
    const userCanDelete = userCan('delete_submissions', this.props.asset)

    if (assetType === ASSET_TYPES.collection.id && !userCanDelete) {
      return null
    }

    return <ButtonNew variant='transparent' size='md' leftIcon='more' tooltip={t('More actions')} />
  }

  renderMoreActions() {
    const assetType = this.props.asset.asset_type
    let downloads: AssetDownloads = []
    if (assetType !== ASSET_TYPES.collection.id) {
      downloads = this.props.asset.downloads
    }
    const userCanEdit = userCan('change_asset', this.props.asset)
    const userCanDelete = userCan('delete_submissions', this.props.asset)
    const isDeployable = assetType === ASSET_TYPES.survey.id && this.props.asset.deployed_version_id === null

    // avoid rendering empty menu
    if (!userCanEdit && downloads.length === 0) {
      return null
    }

    return (
      <Menu>
        <Menu.Target>{this.renderMoreActionsTrigger()}</Menu.Target>

        <Menu.Dropdown>
          {userCanEdit && isDeployable && (
            <Menu.Item onClick={this.deploy} leftSection={<i className='k-icon k-icon-deploy' />}>
              {t('Deploy')}
            </Menu.Item>
          )}

          {userCanEdit && assetType === ASSET_TYPES.survey.id && (
            <Menu.Item onClick={this.replace} leftSection={<i className='k-icon k-icon-replace' />}>
              {t('Replace form')}
            </Menu.Item>
          )}

          {userCanEdit && assetType !== ASSET_TYPES.collection.id && (
            <Menu.Item onClick={this.editLanguages} leftSection={<KoboIcon icon={IconWorldFilled} size={28} />}>
              {t('Manage translations')}
            </Menu.Item>
          )}

          {userCanEdit && assetType === ASSET_TYPES.survey.id && (
            <Menu.Item onClick={this.cloneAsTemplate} leftSection={<i className='k-icon k-icon-template' />}>
              {t('Create template')}
            </Menu.Item>
          )}

          {downloads.map((dl) => (
            <Menu.Item
              component='a'
              href={dl.url}
              key={`dl-${dl.format}`}
              leftSection={<i className={`k-icon k-icon-file-${dl.format}`} />}
            >
              {t('Download')}&nbsp;{dl.format.toString().toUpperCase()}
            </Menu.Item>
          ))}

          {userCanEdit &&
            assetType !== ASSET_TYPES.survey.id &&
            assetType !== ASSET_TYPES.collection.id &&
            this.props.asset.parent !== null && (
              <Menu.Item
                onClick={this.moveToCollection.bind(this, null)}
                leftSection={<i className='k-icon k-icon-folder-out' />}
              >
                {t('Remove from collection')}
              </Menu.Item>
            )}

          {userCanEdit &&
            assetType !== ASSET_TYPES.survey.id &&
            assetType !== ASSET_TYPES.collection.id &&
            this.state.managedCollections.length > 0 && (
              <>
                <Menu.Label>{t('Move to')}</Menu.Label>
                {this.state.managedCollections.map((collection) => {
                  const isAssetParent = collection.url === this.props.asset.parent
                  const displayName = assetUtils.getAssetDisplayName(collection).final
                  return (
                    <Menu.Item
                      onClick={this.moveToCollection.bind(this, collection.url)}
                      key={collection.uid}
                      title={displayName}
                      leftSection={
                        isAssetParent ? (
                          <i className='k-icon k-icon-check' />
                        ) : (
                          <i className='k-icon k-icon-folder-in' />
                        )
                      }
                    >
                      {displayName}
                    </Menu.Item>
                  )
                })}
              </>
            )}

          {userCanEdit &&
            assetType === ASSET_TYPES.survey.id &&
            this.props.has_deployment &&
            !this.props.deployment__active && (
              <Menu.Item onClick={this.unarchive} leftSection={<i className='k-icon k-icon-archived' />}>
                {t('Unarchive')}
              </Menu.Item>
            )}

          {userCanEdit &&
            assetType === ASSET_TYPES.survey.id &&
            this.props.has_deployment &&
            this.props.deployment__active && (
              <Menu.Item onClick={this.archive} leftSection={<i className='k-icon k-icon-archived' />}>
                {t('Archive')}
              </Menu.Item>
            )}

          {userCanEdit && userCanDelete && (
            <Menu.Item onClick={this.delete} leftSection={<i className='k-icon k-icon-trash' />} color='red'>
              {t('Delete')}
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>
    )
  }

  renderSubButton() {
    const isSelfOwned = assetUtils.isSelfOwned(this.props.asset)
    const isPublic = assetUtils.isAssetPublic(this.props.asset.permissions)
    const isUserSubscribed =
      this.props.asset.access_types && this.props.asset.access_types.includes(ACCESS_TYPES.subscribed)

    if (!isSelfOwned && isPublic && this.props.asset.asset_type === ASSET_TYPES.collection.id) {
      let type: ButtonType = 'secondary'
      let callbackFunction = this.subscribeToCollection.bind(this)
      let icon: IconName = 'subscribe'
      let label = t('Subscribe')

      if (isUserSubscribed) {
        type = 'secondary-danger'
        callbackFunction = this.unsubscribeFromCollection.bind(this)
        icon = 'close'
        label = t('Unsubscribe')
      }

      return (
        <Button
          type={type}
          size='m'
          onClick={callbackFunction}
          startIcon={icon}
          label={label}
          isPending={this.state.isSubscribePending}
        />
      )
    }

    return null
  }

  render() {
    if (!this.props.asset) {
      return null
    }

    const assetType = this.props.asset.asset_type
    const userCanEdit = userCan('change_asset', this.props.asset)
    const hasDetailsEditable = assetType === ASSET_TYPES.template.id || assetType === ASSET_TYPES.collection.id

    const routeAssetUid = getRouteAssetUid()

    return (
      <menu className='asset-action-buttons'>
        {this.renderSubButton()}

        {userCanEdit && assetType !== ASSET_TYPES.collection.id && (
          <Link to={this.getFormBuilderLink()}>
            <Button type='text' size='m' tooltip={t('Edit in Form Builder')} tooltipPosition='right' startIcon='edit' />
          </Link>
        )}

        {userCanEdit && hasDetailsEditable && (
          <Button
            type='text'
            size='m'
            onClick={this.modifyDetails.bind(this)}
            tooltip={t('Modify details')}
            tooltipPosition='right'
            startIcon='settings'
          />
        )}

        {userCanEdit && (
          <Button
            type='text'
            size='m'
            onClick={this.showTagsModal.bind(this)}
            tooltip={t('Edit Tags')}
            tooltipPosition='right'
            startIcon='tag'
          />
        )}

        {userCanEdit && (
          <Button
            type='text'
            size='m'
            onClick={this.share.bind(this)}
            tooltip={t('Share')}
            tooltipPosition='right'
            startIcon='user-share'
          />
        )}

        {assetType !== ASSET_TYPES.collection.id && (
          <Button
            type='text'
            size='m'
            onClick={this.clone.bind(this)}
            tooltip={t('Clone')}
            tooltipPosition='right'
            startIcon='duplicate'
          />
        )}

        {assetType === ASSET_TYPES.template.id && (
          <Button
            type='text'
            size='m'
            onClick={this.cloneAsSurvey.bind(this)}
            tooltip={t('Create project')}
            tooltipPosition='right'
            startIcon='projects'
          />
        )}

        {routeAssetUid && this.props.asset.parent !== null && !this.props.asset.parent.includes(routeAssetUid) && (
          <Button
            type='text'
            size='m'
            onClick={this.viewContainingCollection.bind(this)}
            tooltip={t('View containing Collection')}
            tooltipPosition='right'
            startIcon='folder'
          />
        )}

        {this.renderMoreActions()}
      </menu>
    )
  }
}

export default withRouter(AssetActionButtons)
