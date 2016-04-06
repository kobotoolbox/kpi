import React from 'react/addons';
import {Navigation} from 'react-router';
import $ from 'jquery';

import bem from '../bem';
import ui from '../ui';
import stores from '../stores';
import {
  formatTime,
  anonUsername,
  t,
  assign,
} from '../utils';

var AssetTypeIcon = bem.create('asset-type-icon');

var AssetRow = React.createClass({
  mixins: [
    Navigation
  ],
  clickAsset (evt) {
    var clickedActionIcon = $(evt.target).closest('[data-action]').get(0);
    if (clickedActionIcon && this.props.isSelected) {
      this.props.onActionButtonClick(assign(evt, {
        actionIcon: clickedActionIcon,
      }));
    } else {
      // this click was not intended for a button
      evt.nativeEvent.preventDefault();
      evt.nativeEvent.stopImmediatePropagation();
      evt.preventDefault();

      // if no asset is selected, then this asset
      // otherwise, toggle selection (unselect if already selected)
      let forceSelect = (stores.selectedAsset.uid === false);
      stores.selectedAsset.toggleSelect(this.props.uid, forceSelect);
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
    return (
        <bem.AssetRow m={{
                            'selected': this.props.isSelected,
                            'active': this.props.isSelected,
                            'inactive': !this.props.isSelected,
                            'deleted': this.props.deleted,
                            'deleting': this.props.deleting,
                          }}
                        onClick={this.clickAsset}
                        className="mdl-grid"
                      >
          <i />

          <bem.AssetRow__cell m={'title'} className="mdl-cell mdl-cell--6-col mdl-cell--3-col-tablet">
            <AssetTypeIcon m={[this.props.asset_type, 'medium']}><i /></AssetTypeIcon>
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
          </bem.AssetRow__cell>
          { tags.length > 0 && this.props.isSelected &&
            <bem.AssetRow__cell m={'tags'} className="mdl-cell mdl-cell--12-col">
                <bem.AssetRow__tags>
                  {tags.map((tag)=>{
                    return (
                          <bem.AssetRow__tags__tag>{tag}</bem.AssetRow__tags__tag>
                      );
                  })}
                </bem.AssetRow__tags>
            </bem.AssetRow__cell>
          }
          { this.props.isSelected &&
            <bem.AssetRow__buttons>
                { this.props.kind === 'asset' &&
                  ['edit', 'view', 'download', 'clone'].map((actn)=>{
                    return (
                          <bem.AssetRow__actionIcon
                              m={actn}
                              data-action={actn}
                              data-asset-type={this.props.kind}
                              data-disabled={false}
                              title={actn}
                              >
                            <i />
                          </bem.AssetRow__actionIcon>
                        );
                  })
                }
                { isDeployable &&
                  <bem.AssetRow__actionIcon
                        m={'deploy'}
                        data-action={'deploy'}
                        data-asset-type={this.props.kind}
                        title={t('deploy')}
                      >
                    <i />
                    {this.props.deployed_version_id === null ?
                       t('deploy') : t('redeploy')}
                  </bem.AssetRow__actionIcon>
                }
                { this.props.asset_type && this.props.asset_type === 'survey' &&
                  <bem.AssetRow__actionIcon
                        m={'refresh'}
                        data-action={'refresh'}
                        data-asset-type={this.props.kind}
                        title={t('refresh')}
                      >
                    <i />
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
                              title={actn}
                              >
                            <i />
                          </bem.AssetRow__actionIcon>
                        );
                  })
                }
                <bem.AssetRow__actionIcon
                      m={'delete'}
                      data-action={'delete'}
                      data-asset-type={this.props.kind}
                      title={t('delete')}
                    >
                  <i />
                </bem.AssetRow__actionIcon>
            </bem.AssetRow__buttons>
          }
        </bem.AssetRow>
      );
  }
});

export default AssetRow;
