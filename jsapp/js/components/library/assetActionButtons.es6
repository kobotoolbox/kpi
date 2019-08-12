/**
 * This is intended to be displayed in multiple places:
 * - library asset landing page
 * - library listing row
 * - project landing page (TODO in future)
 * - projects listing row (TODO in future)
 */

import React from 'react';
import autoBind from 'react-autobind';
import {hashHistory} from 'react-router';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import ui from 'js/ui';
import bem from 'js/bem';
import {t} from 'js/utils';
import assetUtils from 'js/assetUtils';
import {ASSET_TYPES} from 'js/constants';
import {
  dmix,
  clickAssets,
  contextRouter
} from 'js/mixins';

const assetActions = clickAssets.click.asset;

class AssetActionButtons extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      shouldHidePopover: false,
      isPopoverVisible: false
    };
    autoBind(this);
  }

  // methods for inner workings of component

  onMouseLeave() {
    console.debug('onMouseLeave');
    // force hide popover in next render cycle
    // (ui.PopoverMenu interface handles it this way)
    if (this.state.isPopoverVisible) {
      this.setState({shouldHidePopover: true});
    }
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
      this.props.asset.uid,
      this.props.asset.name,
      this.onDeleteComplete.bind(this, this.props.asset.uid)
    );
  }

  /**
   * Navigates out of nonexistent paths after asset was successfuly deleted
   */
  onDeleteComplete(assetUid) {
    if (this.isLibrarySingle() && this.currentAssetID() === assetUid) {
      hashHistory.push('/library');
    }
    if (this.isFormSingle() && this.currentAssetID() === assetUid) {
      hashHistory.push('/forms');
    }
  }

  deploy() {
    dmix.deployAsset(this.props.asset);
  }

  archive() {
    assetActions.archive(this.props.asset);
  }

  unarchive() {
    assetActions.unarchive(this.props.asset);
  }

  clone() {
    assetActions.clone(this.props.asset.uid);
  }

  cloneAsSurvey() {
    assetActions.cloneAsSurvey(this.props.asset.uid, this.props.asset.name);
  }

  cloneAsTemplate() {
    assetActions.cloneAsTemplate(this.props.asset.uid, this.props.asset.name);
  }

  moveToCollection(collectionId) {
    assetUtils.moveToCollection(this.props.asset.uid, collectionId);
  }

  viewContainingCollection() {
    const parentArr = this.props.asset.parent.split('/');
    const parentCollectionUid = parentArr[parentArr.length - 2];
    hashHistory.push(`/library/collection/${parentCollectionUid}`);
  }

  render() {
    const userCanEdit = true;
    const hasDetailsEditable = (
      this.props.asset.asset_type === ASSET_TYPES.template.id ||
      this.props.asset.asset_type === ASSET_TYPES.collection.id
    );
    const isDeployable = true;
    const isInsideCollection = this.props.asset.parent !== null;
    const ownedCollections = [];
    const downloads = [];

    return (
      <bem.AssetActionButtons onMouseLeave={this.onMouseLeave}>
        {userCanEdit && this.props.asset.asset_type !== ASSET_TYPES.collection.id &&
          <bem.AssetActionButtons__iconButton
            href={`#/library/asset/${this.props.asset.uid}/edit`}
            data-tip={t('Edit in Form Builder')}
            className='right-tooltip'
          >
            <i className='k-icon k-icon-edit'/>
          </bem.AssetActionButtons__iconButton>
        }

        {hasDetailsEditable &&
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

        <bem.AssetActionButtons__iconButton
          onClick={this.clone}
          data-tip={t('Clone')}
          className='right-tooltip'
        >
          <i className='k-icon k-icon-clone'/>
        </bem.AssetActionButtons__iconButton>

        {this.props.asset_type && this.props.asset_type === ASSET_TYPES.template.id && userCanEdit &&
          <bem.AssetActionButtons__iconButton
            onClick={this.cloneAsSurvey}
            data-tip={t('Create project')}
            className='right-tooltip'
          >
            <i className='k-icon k-icon-projects'/>
          </bem.AssetActionButtons__iconButton>
        }

        {isInsideCollection &&
          <bem.AssetActionButtons__iconButton
            onClick={this.viewContainingCollection}
            data-tip={t('View containing Collection')}
            className='right-tooltip'
          >
            <i className='k-icon k-icon-folder'/>
          </bem.AssetActionButtons__iconButton>
        }

        <ui.PopoverMenu
          triggerLabel={<i className='k-icon k-icon-more'/>}
          triggerTip={t('More Actions')}
          triggerClassName='right-tooltip'
          clearPopover={this.state.shouldHidePopover}
          popoverSetVisible={this.onPopoverSetVisible}
        >
          {this.props.asset_type && this.props.asset_type === ASSET_TYPES.survey.id && userCanEdit && isDeployable &&
            <bem.PopoverMenu__link onClick={this.deploy}>
              <i className='k-icon k-icon-deploy'/>
              {t('Deploy')}
            </bem.PopoverMenu__link>
          }

          {this.props.asset_type && this.props.asset_type === ASSET_TYPES.survey.id && this.props.has_deployment && !this.props.deployment__active && userCanEdit &&
            <bem.PopoverMenu__link onClick={this.unarchive}>
              <i className='k-icon k-icon-archived'/>
              {t('Unarchive')}
            </bem.PopoverMenu__link>
          }

          {this.props.asset_type && this.props.asset_type === ASSET_TYPES.survey.id && userCanEdit &&
            <bem.PopoverMenu__link onClick={this.replace}>
              <i className='k-icon k-icon-replace'/>
              {t('Replace form')}
            </bem.PopoverMenu__link>
          }

          {userCanEdit &&
            <bem.PopoverMenu__link onClick={this.editLanguages}>
              <i className='k-icon k-icon-language'/>
              {t('Manage Translations')}
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

          {this.props.asset_type && this.props.asset_type !== ASSET_TYPES.survey.id && ownedCollections.length > 0 &&
            <bem.PopoverMenu__heading>
              {t('Move to')}
            </bem.PopoverMenu__heading>
          }

          {this.props.asset_type && this.props.asset_type !== ASSET_TYPES.survey.id && ownedCollections.length > 0 &&
            <bem.PopoverMenu__moveTo>
              {ownedCollections.map((col) => {
                return (
                  <bem.PopoverMenu__item
                    onClick={this.moveToCollection.bind(this, col.value)}
                    key={col.value}
                    title={col.label}
                    m='move-coll-item'
                  >
                    <i className='k-icon k-icon-folder'/>
                    {col.label}
                  </bem.PopoverMenu__item>
                );
              })}
            </bem.PopoverMenu__moveTo>
          }

          {this.props.asset_type && this.props.asset_type === ASSET_TYPES.survey.id && this.props.has_deployment && this.props.deployment__active && userCanEdit &&
            <bem.PopoverMenu__link onClick={this.archive}>
              <i className='k-icon k-icon-archived'/>
              {t('Archive')}
            </bem.PopoverMenu__link>
          }

          {this.props.asset_type && this.props.asset_type === ASSET_TYPES.survey.id && userCanEdit &&
            <bem.PopoverMenu__link onClick={this.cloneAsTemplate}>
              <i className='k-icon k-icon-template'/>
              {t('Create template')}
            </bem.PopoverMenu__link>
          }

          {userCanEdit &&
            <bem.PopoverMenu__link onClick={this.delete}>
              <i className='k-icon k-icon-trash'/>
              {t('Delete')}
            </bem.PopoverMenu__link>
          }
        </ui.PopoverMenu>
      </bem.AssetActionButtons>
    );
  }
}

reactMixin(AssetActionButtons.prototype, contextRouter);
AssetActionButtons.contextTypes = {
  router: PropTypes.object
};

export default AssetActionButtons;
