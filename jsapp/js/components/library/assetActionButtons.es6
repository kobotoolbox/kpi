// TODO: double check the display logic for buttons (permissions)

/**
 * This is intended to be displayed in multiple places:
 * - library asset landing page
 * - library listing row
 * - project landing page (TODO in future)
 * - projects listing row (TODO in future)
 */

import React from 'react';
import Reflux from 'reflux';
import autoBind from 'react-autobind';
import {hashHistory} from 'react-router';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import _ from 'lodash';
import PopoverMenu from 'js/popoverMenu';
import bem from 'js/bem';
import {actions} from 'js/actions';
import assetUtils from 'js/assetUtils';
import {
  ASSET_TYPES,
  ACCESS_TYPES,
} from 'js/constants';
import {ROUTES} from 'js/router/routerConstants';
import mixins from 'js/mixins';
import ownedCollectionsStore from './ownedCollectionsStore';
import './assetActionButtons.scss';

const assetActions = mixins.clickAssets.click.asset;

/**
 * @prop {object} asset
 */
class AssetActionButtons extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      ownedCollections: ownedCollectionsStore.data.collections,
      shouldHidePopover: false,
      isPopoverVisible: false,
      isSubscribePending: false
    };
    this.unlisteners = [];
    this.hidePopoverDebounced = _.debounce(() => {
      if (this.state.isPopoverVisible) {
        this.setState({shouldHidePopover: true});
      }
    }, 500);
    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(ownedCollectionsStore, this.onOwnedCollectionsStoreChanged);
    this.unlisteners.push(
      actions.library.subscribeToCollection.completed.listen(this.onSubscribingCompleted),
      actions.library.unsubscribeFromCollection.completed.listen(this.onSubscribingCompleted),
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  onSubscribingCompleted() {
    this.setState({ isSubscribePending: false });
  }

  onOwnedCollectionsStoreChanged(storeData) {
    this.setState({
      ownedCollections: storeData.collections
    });
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
    assetUtils.modifyDetails(this.props.asset);
  }

  editLanguages() {
    assetUtils.editLanguages(this.props.asset);
  }

  share() {
    assetUtils.share(this.props.asset);
  }

  showTagsModal() {
    assetUtils.editTags(this.props.asset);
  }

  replace() {
    assetUtils.replaceForm(this.props.asset);
  }

  delete() {
    assetActions.delete(
      this.props.asset,
      assetUtils.getAssetDisplayName(this.props.asset).final,
      this.onDeleteComplete.bind(this, this.props.asset.uid)
    );
  }

  /**
   * Navigates out of nonexistent paths after asset was successfuly deleted
   */
  onDeleteComplete(assetUid) {
    if (this.isLibrarySingle() && this.currentAssetID() === assetUid) {
      hashHistory.push(ROUTES.LIBRARY);
    }
    if (this.isFormSingle() && this.currentAssetID() === assetUid) {
      hashHistory.push(ROUTES.FORMS);
    }
  }

  deploy() {
    mixins.dmix.deployAsset(this.props.asset);
  }

  archive() {
    assetActions.archive(this.props.asset);
  }

  unarchive() {
    assetActions.unarchive(this.props.asset);
  }

  clone() {
    assetActions.clone(this.props.asset);
  }

  cloneAsSurvey() {
    assetActions.cloneAsSurvey(
      this.props.asset.uid,
      assetUtils.getAssetDisplayName(this.props.asset).final
    );
  }

  cloneAsTemplate() {
    assetActions.cloneAsTemplate(
      this.props.asset.uid,
      assetUtils.getAssetDisplayName(this.props.asset).final
    );
  }

  moveToCollection(collectionUrl) {
    actions.library.moveToCollection(this.props.asset.uid, collectionUrl);
  }

  subscribeToCollection() {
    this.setState({ isSubscribePending: true });
    actions.library.subscribeToCollection(this.props.asset.url);
  }

  unsubscribeFromCollection() {
    this.setState({ isSubscribePending: true });
    actions.library.unsubscribeFromCollection(this.props.asset.uid);
  }

  viewContainingCollection() {
    const parentArr = this.props.asset.parent.split('/');
    const parentAssetUid = parentArr[parentArr.length - 2];
    hashHistory.push(`/library/asset/${parentAssetUid}`);
    hashHistory.push(ROUTES.LIBRARY_ITEM.replace(':uid', parentAssetUid));
  }

  getFormBuilderLink() {
    let link = '#' + ROUTES.EDIT_LIBRARY_ITEM.replace(':uid', this.props.asset.uid);

    // when editing a child from within a collection page
    // make sure the "Return to list" button goes back to collection
    const currentAssetUid = this.currentAssetID();
    if (
      this.props.asset.asset_type !== ASSET_TYPES.collection.id &&
      this.props.asset.parent !== null &&
      this.props.asset.parent.includes(currentAssetUid)
    ) {
      const backPath = ROUTES.LIBRARY_ITEM.replace(':uid', currentAssetUid);
      link += `?back=${backPath}`;
    }

    return link;
  }

  renderMoreActionsTrigger() {
    return (
      <div
        className='right-tooltip'
        data-tip={t('More actions')}
      >
        <i className='k-icon k-icon-more'/>
      </div>
    );
  }

  renderMoreActions() {
    const assetType = this.props.asset.asset_type;
    let downloads = [];
    if (assetType !== ASSET_TYPES.collection.id) {
      downloads = this.props.asset.downloads;
    }
    const userCanEdit = this.userCan('change_asset', this.props.asset);
    const isDeployable = (
      assetType === ASSET_TYPES.survey.id &&
      this.props.asset.deployed_version_id === null
    );

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
        {userCanEdit && isDeployable &&
          <bem.PopoverMenu__link onClick={this.deploy}>
            <i className='k-icon k-icon-deploy'/>
            {t('Deploy')}
          </bem.PopoverMenu__link>
        }

        {userCanEdit && assetType === ASSET_TYPES.survey.id &&
          <bem.PopoverMenu__link onClick={this.replace}>
            <i className='k-icon k-icon-replace'/>
            {t('Replace form')}
          </bem.PopoverMenu__link>
        }

        {userCanEdit && assetType !== ASSET_TYPES.collection.id &&
          <bem.PopoverMenu__link onClick={this.editLanguages}>
            <i className='k-icon k-icon-language'/>
            {t('Manage translations')}
          </bem.PopoverMenu__link>
        }

        {userCanEdit && assetType === ASSET_TYPES.survey.id &&
          <bem.PopoverMenu__link onClick={this.cloneAsTemplate}>
            <i className='k-icon k-icon-template'/>
            {t('Create template')}
          </bem.PopoverMenu__link>
        }

        {downloads.map((dl) => {
          return (
            <bem.PopoverMenu__link
              href={dl.url}
              key={`dl-${dl.format}`}
            >
              <i className={`k-icon k-icon-${dl.format}-file`}/>
              {t('Download')}&nbsp;{dl.format.toString().toUpperCase()}
            </bem.PopoverMenu__link>
          );
        })}

        {userCanEdit &&
          assetType !== ASSET_TYPES.survey.id &&
          assetType !== ASSET_TYPES.collection.id &&
          this.props.asset.parent !== null &&
          <bem.PopoverMenu__link onClick={this.moveToCollection.bind(this, null)}>
            <i className='k-icon k-icon-folder-out'/>
            {t('Remove from collection')}
          </bem.PopoverMenu__link>
        }

        {userCanEdit &&
          assetType !== ASSET_TYPES.survey.id &&
          assetType !== ASSET_TYPES.collection.id &&
          this.state.ownedCollections.length > 0 && [
          <bem.PopoverMenu__heading key='heading'>
            {t('Move to')}
          </bem.PopoverMenu__heading>,
          <bem.PopoverMenu__moveTo key='list'>
            {this.state.ownedCollections.map((collection) => {
              const modifiers = ['move-coll-item'];
              const isAssetParent = collection.url === this.props.asset.parent;
              if (isAssetParent) {
                modifiers.push('move-coll-item-parent');
              }
              const displayName = assetUtils.getAssetDisplayName(collection).final;
              return (
                <bem.PopoverMenu__item
                  onClick={this.moveToCollection.bind(this, collection.url)}
                  key={collection.uid}
                  title={displayName}
                  m={modifiers}
                >
                  {isAssetParent &&
                    <i className='k-icon k-icon-check'/>
                  }
                  {!isAssetParent &&
                    <i className='k-icon k-icon-folder-in'/>
                  }
                  {displayName}
                </bem.PopoverMenu__item>
              );
            })}
          </bem.PopoverMenu__moveTo>
        ]}

        {userCanEdit &&
          assetType === ASSET_TYPES.survey.id &&
          this.props.has_deployment &&
          !this.props.deployment__active &&
          <bem.PopoverMenu__link onClick={this.unarchive}>
            <i className='k-icon k-icon-archived'/>
            {t('Unarchive')}
          </bem.PopoverMenu__link>
        }

        {userCanEdit &&
          assetType === ASSET_TYPES.survey.id &&
          this.props.has_deployment &&
          this.props.deployment__active &&
          <bem.PopoverMenu__link onClick={this.archive}>
            <i className='k-icon k-icon-archived'/>
            {t('Archive')}
          </bem.PopoverMenu__link>
        }

        {userCanEdit &&
          <bem.PopoverMenu__link onClick={this.delete}>
            <i className='k-icon k-icon-trash'/>
            {t('Delete')}
          </bem.PopoverMenu__link>
        }
      </PopoverMenu>
    );
  }

  renderSubButton() {
    const isSelfOwned = assetUtils.isSelfOwned(this.props.asset);
    const isPublic = assetUtils.isAssetPublic(this.props.asset.permissions);
    const isUserSubscribed = (
      this.props.asset.access_types &&
      this.props.asset.access_types.includes(ACCESS_TYPES.subscribed)
    );

    if (
      !isSelfOwned &&
      isPublic &&
      this.props.asset.asset_type === ASSET_TYPES.collection.id
    ) {
      const modifiers = isUserSubscribed ? ['off'] : ['on'];
      const fn = isUserSubscribed ? this.unsubscribeFromCollection.bind(this) : this.subscribeToCollection.bind(this);
      if (this.state.isSubscribePending) {
        modifiers.push('pending');
      }
      let icon = null;
      let title = t('Pending…');
      if (!this.state.isSubscribePending) {
        if (isUserSubscribed) {
          icon = (<i className='k-icon k-icon-close'/>);
          title = t('Unsubscribe');
        } else {
          icon = (<i className='k-icon k-icon-subscribe'/>);
          title = t('Subscribe');
        }
      }

      return (
        <bem.AssetActionButtons__button
          m={modifiers}
          onClick={fn}
          disabled={this.state.isSubscribePending}
        >
          {icon}
          {title}
        </bem.AssetActionButtons__button>
      );
    }

    return null;
  }

  render() {
    if (!this.props.asset) {
      return null;
    }

    const assetType = this.props.asset.asset_type;
    const userCanEdit = this.userCan('change_asset', this.props.asset);
    const hasDetailsEditable = (
      assetType === ASSET_TYPES.template.id ||
      assetType === ASSET_TYPES.collection.id
    );

    return (
      <bem.AssetActionButtons
        onMouseLeave={this.onMouseLeave}
        onMouseEnter={this.onMouseEnter}
      >
        {this.renderSubButton()}

        {userCanEdit && assetType !== ASSET_TYPES.collection.id &&
          <bem.AssetActionButtons__iconButton
            href={this.getFormBuilderLink()}
            data-tip={t('Edit in Form Builder')}
            className='right-tooltip'
          >
            <i className='k-icon k-icon-edit'/>
          </bem.AssetActionButtons__iconButton>
        }

        {userCanEdit && hasDetailsEditable &&
          <bem.AssetActionButtons__iconButton
            onClick={this.modifyDetails}
            data-tip={t('Modify details')}
            className='right-tooltip'
          >
            <i className='k-icon k-icon-settings' />
          </bem.AssetActionButtons__iconButton>
        }

        {userCanEdit &&
          <bem.AssetActionButtons__iconButton
            onClick={this.showTagsModal}
            data-tip= {t('Edit Tags')}
            className='right-tooltip'
          >
            <i className='k-icon k-icon-tag'/>
          </bem.AssetActionButtons__iconButton>
        }

        {userCanEdit &&
          <bem.AssetActionButtons__iconButton
            onClick={this.share}
            data-tip= {t('Share')}
            className='right-tooltip'
          >
            <i className='k-icon k-icon-user-share'/>
          </bem.AssetActionButtons__iconButton>
        }

        {assetType !== ASSET_TYPES.collection.id &&
          <bem.AssetActionButtons__iconButton
            onClick={this.clone}
            data-tip={t('Clone')}
            className='right-tooltip'
          >
            <i className='k-icon k-icon-clone'/>
          </bem.AssetActionButtons__iconButton>
        }

        {assetType === ASSET_TYPES.template.id &&
          <bem.AssetActionButtons__iconButton
            onClick={this.cloneAsSurvey}
            data-tip={t('Create project')}
            className='right-tooltip'
          >
            <i className='k-icon k-icon-projects'/>
          </bem.AssetActionButtons__iconButton>
        }

        {this.props.asset.parent !== null &&
          !this.props.asset.parent.includes(this.currentAssetID()) &&
          <bem.AssetActionButtons__iconButton
            onClick={this.viewContainingCollection}
            data-tip={t('View containing Collection')}
            className='right-tooltip'
          >
            <i className='k-icon k-icon-folder'/>
          </bem.AssetActionButtons__iconButton>
        }

        {this.renderMoreActions()}
      </bem.AssetActionButtons>
    );
  }
}

reactMixin(AssetActionButtons.prototype, mixins.contextRouter);
reactMixin(AssetActionButtons.prototype, mixins.permissions);
reactMixin(AssetActionButtons.prototype, Reflux.ListenerMixin);
AssetActionButtons.contextTypes = {
  router: PropTypes.object
};

export default AssetActionButtons;
