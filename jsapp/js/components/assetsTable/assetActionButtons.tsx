/**
 * This is intended to be displayed in multiple places:
 * - library asset landing page
 * - library listing row
 * - project landing page (see: https://github.com/kobotoolbox/kpi/issues/2758)
 * - projects listing row (see: https://github.com/kobotoolbox/kpi/issues/2758)
 */

import React from 'react';
import autoBind from 'react-autobind';
import debounce from 'lodash.debounce';
import PopoverMenu from 'js/popoverMenu';
import bem from 'js/bem';
import {actions} from 'js/actions';
import assetUtils from 'js/assetUtils';
import {ASSET_TYPES, ACCESS_TYPES} from 'js/constants';
import {ROUTES} from 'js/router/routerConstants';
import mixins from 'js/mixins';
import type {AssetResponse, AssetDownloads} from 'js/dataInterface';
import {
  isAnyLibraryItemRoute,
  getRouteAssetUid,
  isAnyFormRoute,
} from 'js/router/routerUtils';
import managedCollectionsStore from 'js/components/library/managedCollectionsStore';
import type {ManagedCollectionsStoreData} from 'js/components/library/managedCollectionsStore';
import './assetActionButtons.scss';
import {withRouter} from 'jsapp/js/router/legacy';
import type {WithRouterProps} from 'jsapp/js/router/legacy';
import {
  archiveAsset,
  deleteAsset,
  unarchiveAsset,
  cloneAsset,
  cloneAssetAsSurvey,
  cloneAssetAsTemplate,
  manageAssetSharing,
  replaceAssetForm,
  modifyAssetTags,
  manageAssetLanguages,
  manageAssetSettings
} from 'jsapp/js/assetQuickActions';
import {userCan} from 'js/components/permissions/utils';
import {Link} from 'react-router-dom';
import Button from 'js/components/common/button';
import type {ButtonType} from 'js/components/common/button';
import type {IconName} from 'jsapp/fonts/k-icons';

interface AssetActionButtonsProps extends WithRouterProps {
  asset: AssetResponse;
  has_deployment?: boolean;
  deployment__active?: boolean;
}

interface AssetActionButtonsState {
  managedCollections: AssetResponse[];
  shouldHidePopover: boolean;
  isPopoverVisible: boolean;
  isSubscribePending: boolean;
}

class AssetActionButtons extends React.Component<
  AssetActionButtonsProps,
  AssetActionButtonsState
> {
  private unlisteners: Function[] = [];
  hidePopoverDebounced = debounce(() => {
    if (this.state.isPopoverVisible) {
      this.setState({shouldHidePopover: true});
    }
  }, 500);

  constructor(props: AssetActionButtonsProps) {
    super(props);
    this.state = {
      managedCollections: managedCollectionsStore.data.collections,
      shouldHidePopover: false,
      isPopoverVisible: false,
      isSubscribePending: false,
    };
    autoBind(this);
  }

  componentDidMount() {
    managedCollectionsStore.listen(
      this.onManagedCollectionsStoreChanged.bind(this),
      this
    );
    this.unlisteners.push(
      actions.library.subscribeToCollection.completed.listen(
        this.onSubscribingCompleted.bind(this)
      ),
      actions.library.unsubscribeFromCollection.completed.listen(
        this.onSubscribingCompleted.bind(this)
      )
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb();
    });
  }

  onSubscribingCompleted() {
    this.setState({isSubscribePending: false});
  }

  onManagedCollectionsStoreChanged(storeData: ManagedCollectionsStoreData) {
    this.setState({managedCollections: storeData.collections});
  }

  // methods for inner workings of component

  /**
   * Allow for some time for user to go back to the popover menu.
   * Then force hide popover in next render cycle (PopoverMenu interface
   * handles it this way)
   */
  onMouseLeave() {
    this.hidePopoverDebounced();
  }

  onMouseEnter() {
    this.hidePopoverDebounced.cancel();
  }

  onPopoverSetVisible() {
    this.setState({isPopoverVisible: true});
  }

  // Methods for managing the asset

  modifyDetails() {
    manageAssetSettings(this.props.asset);
  }

  editLanguages() {
    manageAssetLanguages(this.props.asset.uid);
  }

  share() {
    manageAssetSharing(this.props.asset.uid);
  }

  showTagsModal() {
    modifyAssetTags(this.props.asset);
  }

  replace() {
    replaceAssetForm(this.props.asset);
  }

  delete() {
    deleteAsset(
      this.props.asset,
      assetUtils.getAssetDisplayName(this.props.asset).final,
      this.onDeleteComplete.bind(this, this.props.asset.uid)
    );
  }

  /**
   * Navigates out of nonexistent paths after asset was successfully deleted
   */
  onDeleteComplete(assetUid: string) {
    if (isAnyLibraryItemRoute() && getRouteAssetUid() === assetUid) {
      this.props.router.navigate(ROUTES.LIBRARY);
    }
    if (isAnyFormRoute() && getRouteAssetUid() === assetUid) {
      this.props.router.navigate(ROUTES.FORMS);
    }
  }

  deploy() {
    mixins.dmix.deployAsset(this.props.asset);
  }

  archive() {
    archiveAsset(this.props.asset);
  }

  unarchive() {
    unarchiveAsset(this.props.asset);
  }

  clone() {
    cloneAsset(this.props.asset);
  }

  cloneAsSurvey() {
    cloneAssetAsSurvey(
      this.props.asset.uid,
      assetUtils.getAssetDisplayName(this.props.asset).final
    );
  }

  cloneAsTemplate() {
    cloneAssetAsTemplate(
      this.props.asset.uid,
      assetUtils.getAssetDisplayName(this.props.asset).final
    );
  }

  /** Pass `null` to remove from collection. */
  moveToCollection(collectionUrl: string | null) {
    actions.library.moveToCollection(this.props.asset.uid, collectionUrl);
  }

  subscribeToCollection() {
    this.setState({isSubscribePending: true});
    actions.library.subscribeToCollection(this.props.asset.url);
  }

  unsubscribeFromCollection() {
    this.setState({isSubscribePending: true});
    actions.library.unsubscribeFromCollection(this.props.asset.uid);
  }

  viewContainingCollection() {
    if (this.props.asset.parent === null) {
      return;
    }
    const parentArr = this.props.asset.parent.split('/');
    const parentAssetUid = parentArr[parentArr.length - 2];
    this.props.router.navigate(
      ROUTES.LIBRARY_ITEM.replace(':uid', parentAssetUid)
    );
  }

  getFormBuilderLink() {
    let link = ROUTES.EDIT_LIBRARY_ITEM.replace(':uid', this.props.asset.uid);

    // when editing a child from within a collection page
    // make sure the "Return to list" button goes back to collection
    const currentAssetUid = getRouteAssetUid();
    if (
      this.props.asset.asset_type !== ASSET_TYPES.collection.id &&
      this.props.asset.parent !== null &&
      currentAssetUid !== null &&
      this.props.asset.parent.includes(currentAssetUid)
    ) {
      const backPath = ROUTES.LIBRARY_ITEM.replace(':uid', currentAssetUid);
      link += `?back=${backPath}`;
    }

    return link;
  }

  renderMoreActionsTrigger() {
    const assetType = this.props.asset.asset_type;
    const userCanDelete = userCan('delete_submissions', this.props.asset);

    if (assetType === ASSET_TYPES.collection.id && !userCanDelete) {
      return null;
    }

    return (
      <Button
        type='text'
        size='m'
        tooltip={t('More actions')}
        tooltipPosition='right'
        startIcon='more'
      />
    );
  }

  renderMoreActions() {
    const assetType = this.props.asset.asset_type;
    let downloads: AssetDownloads = [];
    if (assetType !== ASSET_TYPES.collection.id) {
      downloads = this.props.asset.downloads;
    }
    const userCanEdit = userCan('change_asset', this.props.asset);
    const userCanDelete = userCan('delete_submissions', this.props.asset);
    const isDeployable =
      assetType === ASSET_TYPES.survey.id &&
      this.props.asset.deployed_version_id === null;

    // avoid rendering empty menu
    if (!userCanEdit && downloads.length === 0) {
      return null;
    }

    return (
      <PopoverMenu
        triggerLabel={this.renderMoreActionsTrigger()}
        clearPopover={this.state.shouldHidePopover}
        popoverSetVisible={this.onPopoverSetVisible}
      >
        {userCanEdit && isDeployable && (
          <bem.PopoverMenu__link onClick={this.deploy}>
            <i className='k-icon k-icon-deploy' />
            {t('Deploy')}
          </bem.PopoverMenu__link>
        )}

        {userCanEdit && assetType === ASSET_TYPES.survey.id && (
          <bem.PopoverMenu__link onClick={this.replace}>
            <i className='k-icon k-icon-replace' />
            {t('Replace form')}
          </bem.PopoverMenu__link>
        )}

        {userCanEdit && assetType !== ASSET_TYPES.collection.id && (
          <bem.PopoverMenu__link onClick={this.editLanguages}>
            <i className='k-icon k-icon-language' />
            {t('Manage translations')}
          </bem.PopoverMenu__link>
        )}

        {userCanEdit && assetType === ASSET_TYPES.survey.id && (
          <bem.PopoverMenu__link onClick={this.cloneAsTemplate}>
            <i className='k-icon k-icon-template' />
            {t('Create template')}
          </bem.PopoverMenu__link>
        )}

        {downloads.map((dl) => (
          <bem.PopoverMenu__link href={dl.url} key={`dl-${dl.format}`}>
            <i className={`k-icon k-icon-file-${dl.format}`} />
            {t('Download')}&nbsp;{dl.format.toString().toUpperCase()}
          </bem.PopoverMenu__link>
        ))}

        {userCanEdit &&
          assetType !== ASSET_TYPES.survey.id &&
          assetType !== ASSET_TYPES.collection.id &&
          this.props.asset.parent !== null && (
            <bem.PopoverMenu__link
              onClick={this.moveToCollection.bind(this, null)}
            >
              <i className='k-icon k-icon-folder-out' />
              {t('Remove from collection')}
            </bem.PopoverMenu__link>
          )}

        {userCanEdit &&
          assetType !== ASSET_TYPES.survey.id &&
          assetType !== ASSET_TYPES.collection.id &&
          this.state.managedCollections.length > 0 && [
            <bem.PopoverMenu__heading key='heading'>
              {t('Move to')}
            </bem.PopoverMenu__heading>,
            <bem.PopoverMenu__moveTo key='list'>
              {this.state.managedCollections.map((collection) => {
                const modifiers = ['move-coll-item'];
                const isAssetParent =
                  collection.url === this.props.asset.parent;
                if (isAssetParent) {
                  modifiers.push('move-coll-item-parent');
                }
                const displayName =
                  assetUtils.getAssetDisplayName(collection).final;
                return (
                  <bem.PopoverMenu__item
                    onClick={this.moveToCollection.bind(this, collection.url)}
                    key={collection.uid}
                    title={displayName}
                    m={modifiers}
                  >
                    {isAssetParent && <i className='k-icon k-icon-check' />}
                    {!isAssetParent && (
                      <i className='k-icon k-icon-folder-in' />
                    )}
                    {displayName}
                  </bem.PopoverMenu__item>
                );
              })}
            </bem.PopoverMenu__moveTo>,
          ]}

        {userCanEdit &&
          assetType === ASSET_TYPES.survey.id &&
          this.props.has_deployment &&
          !this.props.deployment__active && (
            <bem.PopoverMenu__link onClick={this.unarchive}>
              <i className='k-icon k-icon-archived' />
              {t('Unarchive')}
            </bem.PopoverMenu__link>
          )}

        {userCanEdit &&
          assetType === ASSET_TYPES.survey.id &&
          this.props.has_deployment &&
          this.props.deployment__active && (
            <bem.PopoverMenu__link onClick={this.archive}>
              <i className='k-icon k-icon-archived' />
              {t('Archive')}
            </bem.PopoverMenu__link>
          )}

        {userCanEdit && userCanDelete && (
          <bem.PopoverMenu__link onClick={this.delete} m='red'>
            <i className='k-icon k-icon-trash' />
            {t('Delete')}
          </bem.PopoverMenu__link>
        )}
      </PopoverMenu>
    );
  }

  renderSubButton() {
    const isSelfOwned = assetUtils.isSelfOwned(this.props.asset);
    const isPublic = assetUtils.isAssetPublic(this.props.asset.permissions);
    const isUserSubscribed =
      this.props.asset.access_types &&
      this.props.asset.access_types.includes(ACCESS_TYPES.subscribed);

    if (
      !isSelfOwned &&
      isPublic &&
      this.props.asset.asset_type === ASSET_TYPES.collection.id
    ) {
      let type: ButtonType = 'secondary';
      let callbackFunction = this.subscribeToCollection.bind(this);
      let icon: IconName = 'subscribe';
      let label = t('Subscribe');

      if (isUserSubscribed) {
        type = 'secondary-danger';
        callbackFunction = this.unsubscribeFromCollection.bind(this);
        icon = 'close';
        label = t('Unsubscribe');
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
      );
    }

    return null;
  }

  render() {
    if (!this.props.asset) {
      return null;
    }

    const assetType = this.props.asset.asset_type;
    const userCanEdit = userCan('change_asset', this.props.asset);
    const hasDetailsEditable =
      assetType === ASSET_TYPES.template.id ||
      assetType === ASSET_TYPES.collection.id;

    const routeAssetUid = getRouteAssetUid();

    return (
      <menu
        className='asset-action-buttons'
        onMouseLeave={this.onMouseLeave}
        onMouseEnter={this.onMouseEnter}
      >
        {this.renderSubButton()}

        {userCanEdit && assetType !== ASSET_TYPES.collection.id && (
          <Link to={this.getFormBuilderLink()}>
            <Button
              type='text'
              size='m'
              tooltip={t('Edit in Form Builder')}
              tooltipPosition='right'
              startIcon='edit'
            />
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

        {routeAssetUid &&
          this.props.asset.parent !== null &&
          !this.props.asset.parent.includes(routeAssetUid) && (
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
    );
  }
}

export default withRouter(AssetActionButtons);
