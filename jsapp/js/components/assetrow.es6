import React from 'react/addons';
import {Navigation} from 'react-router';
import $ from 'jquery';
import ReactTooltip from 'react-tooltip';

import bem from '../bem';
import ui from '../ui';
import stores from '../stores';
import mixins from '../mixins';
import {
  formatTime,
  anonUsername,
  t,
  assign,
} from '../utils';

var AssetTypeIcon = bem.create('asset-type-icon');

var AssetRow = React.createClass({
  mixins: [
    Navigation,
    mixins.taggedAsset
  ],
  getInitialState () {
    return {tags: this.props.tags};
  },
  clickAsset (evt) {
    // this click was not intended for a button
    evt.nativeEvent.preventDefault();
    evt.nativeEvent.stopImmediatePropagation();
    evt.preventDefault();

    // if no asset is selected, then this asset
    // otherwise, toggle selection (unselect if already selected)
    let forceSelect = (stores.selectedAsset.uid === false);
    stores.selectedAsset.toggleSelect(this.props.uid, forceSelect);
  },
  clickAssetButton (evt) {
    var clickedActionIcon = $(evt.target).closest('[data-action]').get(0);
    if (clickedActionIcon && this.props.isSelected) {
      this.props.onActionButtonClick(assign(evt, {
        actionIcon: clickedActionIcon,
      }));
    }
  },
  toggleAssetMoreActions (evt) {
  var isBlur = evt.type === 'blur',
      $popoverMenu;
  if (isBlur) {
    $popoverMenu = $(this.refs['asset-popover'].getDOMNode());
    // if we setState and immediately hide popover then the
    // download links will not register as clicked
    $popoverMenu.fadeOut(250, () => {
      this.setState({
        selectedAssetMoreActions: false,
      });
    });
  } else {
    this.setState({
      selectedAssetMoreActions: true,
    });
  }
},

  preventDefault (evt) {
    evt.preventDefault();
  },
  render () {
    var selfowned = this.props.owner__username === this.props.currentUsername;
    // var perm = this.props.perm;
    var isPublic = this.props.owner__username === anonUsername;
    var _rc = this.props.summary && this.props.summary.row_count;
    var isCollection = this.props.kind === 'collection',
        hrefTo = isCollection ? 'collection-page' : 'form-landing',
        hrefKey = isCollection ? 'uid' : 'assetid',
        hrefParams = {},
        tags = this.props.tags || [];
    if (isCollection) {
      _rc = this.props.assets_count + this.props.children_count;
    }
    var isDeployable = !isCollection && this.props.asset_type && this.props.asset_type === 'survey';
    hrefParams[hrefKey] = this.props.uid;

    // check-round icon temporarily removed from selected asset
    return (
        <bem.AssetRow m={{
                            'selected': this.props.isSelected,
                            'active': this.props.isSelected,
                            'inactive': !this.props.isSelected,
                            'deleted': this.props.deleted,
                            'deleting': this.props.deleting,
                          }}
                        className="mdl-grid"
                      >
          <bem.AssetRow__cell m={'asset-details'} onClick={this.clickAsset}>
            <bem.AssetRow__cell m={'title'} className="mdl-cell mdl-cell--6-col mdl-cell--3-col-tablet">
              { this.props.isSelected ? 
                <AssetTypeIcon m={[this.props.asset_type]} ><i /></AssetTypeIcon>
                
              : 
                <AssetTypeIcon m={[this.props.asset_type]} ><i /></AssetTypeIcon>
              }
              <bem.AssetRow__celllink m={['name', this.props.name ? 'titled' : 'untitled']}
                    data-kind={this.props.kind}
                    data-asset-type={this.props.kind}
                    href={this.makeHref( hrefTo, hrefParams)}
                  >
                <bem.AssetRow__name>
                  <ui.AssetName {...this.props} />
                </bem.AssetRow__name>
              </bem.AssetRow__celllink>
            </bem.AssetRow__cell>
            <bem.AssetRow__cell m={'userlink'} className="mdl-cell mdl-cell--2-col mdl-cell--2-col-tablet">
              {
                selfowned ?
                  t('me') :
                  this.props.owner__username
              }
            </bem.AssetRow__cell>
            <bem.AssetRow__cell m={'date-modified'} className="mdl-cell mdl-cell--3-col mdl-cell--2-col-tablet">
              <span className="date date--modified">{formatTime(this.props.date_modified)}</span>
            </bem.AssetRow__cell>
            <bem.AssetRow__cell m={'row-count'} className="mdl-cell mdl-cell--1-col mdl-cell--1-col-tablet">
              {()=>{
                if (this.props.asset_type === 'question') {
                  return '-';
                } else {
                  return _rc;
                }
              }()}
              <i className="k-asset-arrow-icon" />
            </bem.AssetRow__cell>
          </bem.AssetRow__cell>
          { this.props.isSelected &&
            <bem.AssetRow__cell m={'tags'} className="mdl-cell mdl-cell--12-col">
              {this.renderTaggedAssetTags()}
            </bem.AssetRow__cell>
          }
          { this.props.isSelected &&
            <bem.AssetRow__buttons onClick={this.clickAssetButton}>
                { this.props.kind === 'asset' &&
                  ['view', 'edit', 'download'].map((actn)=>{
                    var icon = 'ki-' + actn;
                    return (
                          <bem.AssetRow__actionIcon
                              m={actn}
                              data-action={actn}
                              data-tip={actn}
                              data-asset-type={this.props.kind}
                              data-disabled={false}
                              >
                            <i />
                          </bem.AssetRow__actionIcon>
                        );
                  })
                }
                { this.props.asset_type && this.props.asset_type === 'survey' &&
                  <bem.AssetRow__actionIcon m={'more-actions'} 
                        onFocus={this.toggleAssetMoreActions}
                        onBlur={this.toggleAssetMoreActions}>
                    <button>
                      <i className="k-icon-more-actions" />
                    </button>
                    { (this.state.selectedAssetMoreActions) ?
                      <bem.PopoverMenu ref='asset-popover'>
                        <bem.PopoverMenu__link 
                            m={'clone'}
                            data-action={'clone'} 
                            data-asset-type={this.props.kind}>
                          <i className="k-icon-clone" />
                          {t('Clone this project')}
                        </bem.PopoverMenu__link>
                        { isDeployable &&
                          <bem.PopoverMenu__link 
                              m={'deploy'}
                              data-action={'deploy'} 
                              data-asset-type={this.props.kind}>
                            <i className="k-icon-deploy" />
                            {this.props.deployed_version_id === null ? t('Deploy this project') : t('Redeploy this project')}
                          </bem.PopoverMenu__link>
                        }
                        { this.props.asset_type && this.props.asset_type === 'survey' &&
                          <bem.PopoverMenu__link
                                m={'refresh'}
                                data-action={'refresh'}
                                data-asset-type={this.props.kind}
                              >
                            <i className="k-icon-replace" />
                            {t('Replace with XLS')}
                          </bem.PopoverMenu__link>
                        }
                        <bem.PopoverMenu__link
                              m={'delete'}
                              data-action={'delete'}
                              data-asset-type={this.props.kind}
                            >
                          <i className="k-icon-trash" />
                          {t('Delete')}
                        </bem.PopoverMenu__link>

                      </bem.PopoverMenu>
                    : null }
                  </bem.AssetRow__actionIcon>
                }
                { this.props.kind === 'collection' &&
                  ['view', 'sharing'].map((actn)=>{
                    return (
                          <bem.AssetRow__actionIcon
                            m={actn === 'view' ? 'view-collection' : actn}
                              data-action={actn}
                              data-asset-type={this.props.kind}
                              data-disabled={false}
                              data-tip={actn}
                              >
                            <i />
                          </bem.AssetRow__actionIcon>
                        );
                  })
                }
                { this.props.asset_type && this.props.asset_type != 'survey' &&
                  ['clone', 'delete'].map((actn)=>{
                    return (
                          <bem.AssetRow__actionIcon
                            m={actn}
                              data-action={actn}
                              data-asset-type={this.props.kind}
                              data-disabled={false}
                              data-tip={actn}
                              >
                            <i />
                          </bem.AssetRow__actionIcon>
                        );
                  })
                }
              <ReactTooltip effect="float" place="bottom" />
            </bem.AssetRow__buttons>
          }
        </bem.AssetRow>
      );
  }
});

export default AssetRow;
