import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import {
  isSelfOwned,
  getAssetDisplayName,
} from 'js/assetUtils';
import {isAnyLibraryRoute} from 'js/router/routerUtils';
import myLibraryStore from './myLibraryStore';
import publicCollectionsStore from './publicCollectionsStore';
import {ROOT_BREADCRUMBS} from './libraryConstants';
import {
  ACCESS_TYPES,
  ASSET_TYPES,
} from 'js/constants';
import './assetBreadcrumbs.scss';

/**
 * @prop asset
 */
class AssetBreadcrumbs extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  getRootBreadcrumb() {
    const parentAssetData = this.getParentAssetData();

    if (
      isAnyLibraryRoute() &&
      isSelfOwned(this.props.asset)
    ) {
      // case for self owned asset
      return ROOT_BREADCRUMBS.MY_LIBRARY;
    } else if (
      isAnyLibraryRoute() &&
      this.props.asset &&
      this.props.asset.asset_type === ASSET_TYPES.collection.id &&
      this.props.asset.access_types !== null &&
      this.props.asset.access_types.includes(ACCESS_TYPES.public) &&
      !this.props.asset.access_types.includes(ACCESS_TYPES.subscribed) &&
      !this.props.asset.access_types.includes(ACCESS_TYPES.shared)
    ) {
      // case for a collection that is public
      return ROOT_BREADCRUMBS.PUBLIC_COLLECTIONS;
    } else if (
      isAnyLibraryRoute() &&
      this.props.asset &&
      this.props.asset.asset_type !== ASSET_TYPES.collection.id &&
      parentAssetData &&
      parentAssetData.access_types !== null &&
      parentAssetData.access_types.includes(ACCESS_TYPES.public) &&
      !parentAssetData.access_types.includes(ACCESS_TYPES.subscribed) &&
      !parentAssetData.access_types.includes(ACCESS_TYPES.shared)
    ) {
      // case for an asset that has parent collection that is public
      return ROOT_BREADCRUMBS.PUBLIC_COLLECTIONS;
    } else if (isAnyLibraryRoute()) {
      // all the other library assets
      return ROOT_BREADCRUMBS.MY_LIBRARY;
    } else {
      return ROOT_BREADCRUMBS.PROJECTS;
    }
  }

  getParentAssetData() {
    let foundParent = null;
    const parentUid = this.getParentUid();
    if (parentUid) {
      foundParent = myLibraryStore.findAsset(this.getParentUid());
    }
    if (parentUid && !foundParent) {
      foundParent = publicCollectionsStore.findAsset(this.getParentUid());
    }
    return foundParent;
  }

  getParentUid() {
    if (this.props.asset.parent) {
      const parentArr = this.props.asset.parent.split('/');
      const parentAssetUid = parentArr[parentArr.length - 2];
      return parentAssetUid;
    } else {
      return null;
    }
  }

  getParentName() {
    const parentAssetData = this.getParentAssetData();

    if (parentAssetData) {
      return getAssetDisplayName(parentAssetData).final;
    } else {
      return t('Parent Collection');
    }
  }

  getParentHref() {
    const parentUid = this.getParentUid();
    if (parentUid) {
      return `#/library/asset/${this.getParentUid()}`;
    } else {
      return '#';
    }
  }

  render() {
    if (!this.props.asset) {
      return null;
    }

    const assetName = getAssetDisplayName(this.props.asset);
    const rootBreadcrumb = this.getRootBreadcrumb();

    return (
      <bem.Breadcrumbs>
        <bem.Breadcrumbs__crumb href={rootBreadcrumb.href}>
          {rootBreadcrumb.label}
        </bem.Breadcrumbs__crumb>
        <i className='k-icon k-icon-next'/>

        {this.props.asset.parent !== null &&
          <React.Fragment>
          <bem.Breadcrumbs__crumb href={this.getParentHref()}>
            {this.getParentName()}
          </bem.Breadcrumbs__crumb>
          <i className='k-icon k-icon-next'/>
          </React.Fragment>
        }

        <bem.Breadcrumbs__crumb>
          {assetName.final}
        </bem.Breadcrumbs__crumb>
      </bem.Breadcrumbs>
    );
  }
}

export default AssetBreadcrumbs;
