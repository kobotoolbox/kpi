import React from 'react/addons';
import Router from 'react-router';
import bem from '../bem';
import ui from '../ui';
import stores from '../stores';

import {notify, getAnonymousUserPermission, formatTime, anonUsername, t} from '../utils';

var Navigation = Router.Navigation;
var assign = require('react/lib/Object.assign');
var $ = require('jquery');

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
      stores.selectedAsset.toggleSelect(this.props.uid);
    }
  },
  preventDefault (evt) {
    evt.preventDefault();
  },
  render () {
    var selfowned = this.props.owner__username == this.props.currentUsername;
    var perm = this.props.perm;
    var isPublic = this.props.owner__username === anonUsername;
    var _rc = this.props.summary && this.props.summary.row_count;
    var isCollection = this.props.kind === 'collection',
        hrefTo = isCollection ? 'collection-page' : 'form-landing',
        hrefKey = isCollection ? 'uid' : 'assetid',
        hrefParams = {},
        tags = this.props.tags || [];
    var isDeployable = !isCollection && this.props.asset_type && this.props.asset_type === 'survey';
    hrefParams[hrefKey] = this.props.uid;
    return (
        <bem.AssetRow m={{
                            'selected': this.props.isSelected,
                            'deleted': this.props.deleted,
                          }}
                        onClick={this.clickAsset}
                      >
          <bem.AssetRow__cell m={['icon',
                    `kind-${this.props.kind}`,
                    this.props.asset_type ? `assettype-${this.props.asset_type}` : null
                  ]}>
              <i />
          </bem.AssetRow__cell>

          <bem.AssetRow__celllink m={['name', this.props.name ? 'titled' : 'untitled']}
                data-action='view'
                data-disabled={true}
                data-kind={this.props.kind}
                data-asset-type={this.props.kind}
                href={this.makeHref( hrefTo, hrefParams)}
              >
            <bem.AssetRow__name>
              <ui.AssetName {...this.props} />
            </bem.AssetRow__name>
          </bem.AssetRow__celllink>
          <bem.AssetRow__cellmeta>
            <bem.AssetRow__cell m={'userlink'}>
              <bem.AssetRow__sharingIcon
                  href="#"
                  m={{
                    'self-owned': selfowned,
                    'public-owned': isPublic,
                  }}>
                <i />
                {
                  selfowned ?
                    t('me') :
                  <bem.AssetRow__sharingIcon__owner>
                    {this.props.owner__username}
                  </bem.AssetRow__sharingIcon__owner>
                }
              </bem.AssetRow__sharingIcon>
            </bem.AssetRow__cell>
            <bem.AssetRow__cell m={'date-modified'}>
              <span className="date date--modified">{t('Modified')} {formatTime(this.props.date_modified)}</span>
            </bem.AssetRow__cell>
            <bem.AssetRow__cell m={'row-count'}>
              {{
                'undefined': 'collection of ',
                'survey': 'survey with ',
                'question': '',
                'block': 'block of ',
              }[this.props.asset_type]}{`${_rc === 1 ? t('1 question') : t('___ questions').replace('___', _rc)}`}
            </bem.AssetRow__cell>
          </bem.AssetRow__cellmeta>
          { tags.length > 0 &&
            <bem.AssetRow__cellmeta>
              <bem.AssetRow__cell m={'tags'}>
                <bem.AssetRow__tags>
                  <i />
                  {tags.map((tag)=>{
                    return <bem.AssetRow__tags__tag>{tag}</bem.AssetRow__tags__tag>
                  })}
                </bem.AssetRow__tags>
              </bem.AssetRow__cell>
            </bem.AssetRow__cellmeta>
          }
          <bem.AssetRow__cell m={'asset-buttons'}>
            <bem.AssetRow__cell m={'action-icons'}>
              { this.props.kind === 'asset' &&
                ['view',
                      // 'edit', 'preview',
                      'download', 'clone', 'delete',
                      ].map((actn)=>{
                  return (
                        <bem.AssetRow__actionIcon
                            m={actn}
                            data-action={actn}
                            data-asset-type={this.props.kind}
                            data-disabled={false}
                            >
                          <i />
                        </bem.AssetRow__actionIcon>
                      );
                })
              }
              { this.props.kind === 'collection' &&
              ['view', 'sharing', 'delete'].map((actn)=>{
                  return (
                        <bem.AssetRow__actionIcon
                          m={actn === 'view' ? 'view-collection' : actn}
                            data-action={actn}
                            data-asset-type={this.props.kind}
                            data-disabled={false}
                            >
                          <i />
                        </bem.AssetRow__actionIcon>
                      );
                })
              }
            </bem.AssetRow__cell>
            { isDeployable &&
              <bem.AssetRow__actionIcon
                    m={'deploy'}
                    data-action={'deploy'}
                    data-asset-type={this.props.kind}
                  >
                <i />
              </bem.AssetRow__actionIcon>
            }
          </bem.AssetRow__cell>
        </bem.AssetRow>
      );
  }
});

export default AssetRow;