import React from 'react';
import Dropzone from 'react-dropzone';
import $ from 'jquery';
import { Link } from 'react-router'; 
import bem from '../bem';
import ui from '../ui';
import stores from '../stores';
import mixins from '../mixins';
import {dataInterface} from '../dataInterface';

import TagInput from '../components/tagInput';

import {
  formatTime,
  anonUsername,
  t,
  assign,
  validFileTypes
} from '../utils';
  
var AssetRow = React.createClass({
  mixins: [
    mixins.droppable,
    mixins.contextRouter
  ],
  getInitialState () {
    return {
      tags: this.props.tags,
      clearPopover: false
    };
  },
  // clickAsset (evt) {
  //   // this click was not intended for a button
  //   evt.nativeEvent.preventDefault();
  //   evt.nativeEvent.stopImmediatePropagation();
  //   evt.preventDefault();
 
  //   // if no asset is selected, then this asset
  //   // otherwise, toggle selection (unselect if already selected)
  //   // let forceSelect = (stores.selectedAsset.uid === false);
  //   // stores.selectedAsset.toggleSelect(this.props.uid, forceSelect);
  // },
  clickAssetButton (evt) {
    var clickedActionIcon = $(evt.target).closest('[data-action]').get(0);
    if (clickedActionIcon) {
      var action = clickedActionIcon.getAttribute('data-action');
      var name = clickedActionIcon.getAttribute('data-asset-name') || t('untitled');
      stores.selectedAsset.toggleSelect(this.props.uid, true);
      this.props.onActionButtonClick(action, this.props.uid, name);
    }
  },
  clickTagsToggle (evt) {
    var tagsToggle = !this.state.displayTags;
      this.setState({
        displayTags: tagsToggle,
      });
  },
  componentDidMount () {
    this.prepParentCollection();
  },
  prepParentCollection () {
    this.setState({
      parent: this.props.parent,
    });
  },
  moveToCollection (evt) {
    var uid = this.props.uid;
    var collid = '/collections/' + evt.currentTarget.dataset.collid + '/';
    var parent = evt.currentTarget.dataset.parent;

    if (parent == 'true') {
      collid = null;
    } 

    dataInterface.patchAsset(uid, {
      parent: collid,
    }).done(()=>{
      this.setState({
        parent: collid,
      });
    });
  },
  preventDefault (evt) {
    evt.preventDefault();
  },
  clearPopover () {
    this.setState({
      clearPopover: true,
    });
  },
  onDrop (files, rejectedFiles) {
    if (files.length === 0) {
      return;
    }
    this.dropFiles(files, rejectedFiles, {url: this.props.url});
  },
  render () {
    var selfowned = this.props.owner__username === this.props.currentUsername;

    var isPublic = this.props.owner__username === anonUsername;
    var _rc = this.props.summary && this.props.summary.row_count || 0;

    var hrefTo = `/forms/${this.props.uid}`,
        linkClassName = this.props.name ? 'asset-row__celllink--titled' : 'asset-row__celllink--untitled',
        tags = this.props.tags || [],
        ownedCollections = [], 
        parent = undefined;

    var isDeployable = this.props.asset_type && this.props.asset_type === 'survey';

    var userCanEdit = false;
    if (selfowned || this.props.access.change[this.props.currentUsername] || stores.session.currentAccount.is_superuser)
      userCanEdit = true;
      
    if (this.isLibrary()) {
      hrefTo = `/library/${this.props.uid}/edit`;
      parent = this.state.parent || undefined;
      ownedCollections = this.props.ownedCollections.map(function(c){
        var p = false;
        if (parent != undefined && parent.indexOf(c.uid) !== -1) {
          p = true;
        }
        return {
          value: c.uid,
          label: c.name || c.uid,
          hasParent: p
        };
      });
    }

    return (
        <bem.AssetRow m={{
                            'display-tags': this.state.displayTags,
                            'deleted': this.props.deleted,
                            'deleting': this.props.deleting,
                          }}
                        className="mdl-grid"
                        key={this.props.uid}
                        onMouseLeave={this.clearPopover}
                      >
          <bem.AssetRow__cell
              m={'asset-details'}
              key={'asset-details'}
              onClick={this.clickAssetButton}
              data-asset-type={this.props.kind}
              >
            <bem.AssetRow__cell m={'title'} 
                className={['mdl-cell', 
                    this.props.asset_type == 'survey' ? 'mdl-cell--5-col mdl-cell--4-col-tablet mdl-cell--2-col-phone' : 'mdl-cell--8-col mdl-cell--5-col-tablet mdl-cell--2-col-phone']}>
              { this.props.asset_type && (this.props.asset_type == 'block' || this.props.asset_type == 'question') &&
                <i className={`row-icon ${_rc > 1 ? 'block' : 'question'}`}>
                  {_rc}
                </i>
              }
              <Link to={hrefTo}
                    data-kind={this.props.kind}
                    data-asset-type={this.props.kind}
                    className={`asset-row__celllink asset-row__celllink-name ${linkClassName}`}>
                <bem.AssetRow__name>
                  <ui.AssetName {...this.props} />
                </bem.AssetRow__name>
              </Link>
              { this.props.asset_type && this.props.asset_type === 'survey' &&
                <bem.AssetRow__description>
                    {this.props.settings.description}
                </bem.AssetRow__description>
              }
            </bem.AssetRow__cell>
            <bem.AssetRow__cell m={'userlink'}
                key={'userlink'}
                  className={['mdl-cell', 
                  this.props.asset_type == 'survey' ? 'mdl-cell--2-col mdl-cell--1-col-tablet mdl-cell--hide-phone' : 'mdl-cell--2-col mdl-cell--2-col-tablet mdl-cell--1-col-phone']}>
              { this.props.asset_type == 'survey' &&
                <span>
                {selfowned ? ' ' : this.props.owner__username}
                </span>
              }
              { this.props.asset_type != 'survey' &&
                <span>
                {selfowned ? t('me') : this.props.owner__username}
                </span>
              }
            </bem.AssetRow__cell>
            { this.props.asset_type == 'survey' &&
              <bem.AssetRow__cell m={'date-created'}
                  key={'date-created'}
                  className="mdl-cell mdl-cell--2-col mdl-cell--hide-tablet mdl-cell--hide-phone"
                  >
                <span className="date date--created">{formatTime(this.props.date_created)}</span>
              </bem.AssetRow__cell>
            }
            <bem.AssetRow__cell m={'date-modified'}
                key={'date-modified'}
                className={['mdl-cell mdl-cell--2-col mdl-cell--2-col-tablet mdl-cell--1-col-phone']}>
              <span className="date date--modified">{formatTime(this.props.date_modified)}</span>
            </bem.AssetRow__cell>
            { this.props.asset_type == 'survey' &&
                <bem.AssetRow__cell m={'submission-count'}
                    key={'submisson-count'}
                    className="mdl-cell mdl-cell--1-col mdl-cell--1-col-tablet mdl-cell--1-col-phone"
                    >
                  {
                    this.props.deployment__submission_count ?
                      this.props.deployment__submission_count : 0
                  }
                </bem.AssetRow__cell>
            }
          </bem.AssetRow__cell>
          { this.state.displayTags &&
            <bem.AssetRow__cell m={'tags'}
                key={'tags'}
                className="mdl-cell mdl-cell--12-col"
                >
              <TagInput uid={this.props.uid} tags={this.props.tags} />
            </bem.AssetRow__cell>
          }
 
          <bem.AssetRow__buttons onClick={this.clickAssetButton}>
            {userCanEdit && 
              <bem.AssetRow__actionIcon
                  m='edit' 
                  key='edit'
                  data-action='edit' 
                  data-tip={t('Edit')}
                  data-asset-type={this.props.kind} 
                  data-disabled={false}
                  >
                <i className='k-icon-edit' />
              </bem.AssetRow__actionIcon>
            } 
            {userCanEdit && 
              <bem.AssetRow__actionIcon
                  m='tagsToggle'
                  onClick={this.clickTagsToggle}
                  data-tip= {t('Tags')}
                  >
                <i className='k-icon-tag' />
              </bem.AssetRow__actionIcon>
            }
            {userCanEdit && 
              <bem.AssetRow__actionIcon
                  m='sharing'
                  key='sharing'
                  data-action='sharing'
                  data-asset-type={this.props.kind} 
                  data-tip= {t('Share')}
                  data-disabled={false}
                  >
                <i className='k-icon-share' />
              </bem.AssetRow__actionIcon>
            }
            <bem.AssetRow__actionIcon
                m='clone'
                key='clone'
                data-action='clone'
                data-tip={t('Clone')}
                data-asset-type={this.props.kind}
                data-asset-name={this.props.name}
                data-disabled={false}
                >
              <i className='k-icon-clone' />
            </bem.AssetRow__actionIcon>
            { this.props.kind === 'collection' &&
              [/*'view',*/ 'sharing'].map((actn)=>{
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
            <ui.PopoverMenu type='assetrow-menu' 
                        triggerLabel={<i className="k-icon-more" />} 
                        triggerTip={t('More Actions')}
                        clearPopover={this.state.clearPopover}>

              { this.props.asset_type && this.props.asset_type === 'survey' && userCanEdit && isDeployable &&
                <bem.PopoverMenu__link 
                    m={'deploy'}
                    data-action={'deploy'} 
                    data-asset-type={this.props.kind}>
                  <i className="k-icon-deploy" />
                  {this.props.deployed_version_id === null ? t('Deploy this project') : t('Redeploy this project')}
                </bem.PopoverMenu__link>
              }
              { this.props.asset_type && this.props.asset_type === 'survey' && userCanEdit &&
                <Dropzone onDrop={this.onDrop} 
                          multiple={false} 
                          className='dropzone' 
                          accept={validFileTypes()}>
                  <bem.PopoverMenu__link
                        m={'refresh'}
                        data-action={'refresh'}
                        data-asset-type={this.props.kind}
                      >
                    <i className="k-icon-replace" />
                    {t('Replace with XLS')}
                  </bem.PopoverMenu__link>
                </Dropzone>
              }
              {this.props.downloads.map((dl)=>{
                return (
                    <bem.PopoverMenu__link m={`dl-${dl.format}`} href={dl.url}
                        key={`dl-${dl.format}`}>
                      <i className={`k-icon-${dl.format}-file`}/>
                      {t('Download')}&nbsp;
                      {dl.format.toString().toUpperCase()}
                    </bem.PopoverMenu__link>
                  );
              })}

              { this.props.asset_type && this.props.asset_type != 'survey' && ownedCollections.length > 0 &&
                <bem.PopoverMenu__heading>
                  {t('Move to')}
                </bem.PopoverMenu__heading>
              }
              { this.props.asset_type && this.props.asset_type != 'survey' && ownedCollections.length > 0 &&
                <bem.PopoverMenu__moveTo>
                  {ownedCollections.map((col)=>{
                    return (
                        <bem.PopoverMenu__item
                         onClick={this.moveToCollection}
                         data-collid={col.value} 
                         data-parent={col.hasParent ? 'true' : 'false'} 
                         key={col.value}
                         title={col.label}
                         m='move-coll-item'>
                            <i className="k-icon-folder" />
                            {col.label}
                            {col.hasParent && 
                              <span className="has-parent">&bull;</span>
                            }
                        </bem.PopoverMenu__item>
                      );
                  })}
                </bem.PopoverMenu__moveTo>
              }

              { this.props.asset_type && this.props.asset_type === 'survey' && this.props.has_deployment && this.props.deployment__active && userCanEdit &&
                <bem.PopoverMenu__link
                      m={'archive'}
                      data-action={'archive'}
                      data-asset-type={this.props.kind}
                    >
                  <i className="k-icon-archived" />
                  {t('Archive')}
                </bem.PopoverMenu__link>
              }

              {userCanEdit &&
                <bem.PopoverMenu__link
                      m={'delete'}
                      data-action={'delete'}
                      data-asset-type={this.props.kind}
                    >
                  <i className="k-icon-trash" />
                  {t('Delete')}
                </bem.PopoverMenu__link>
              }
            </ui.PopoverMenu>
          </bem.AssetRow__buttons>
        </bem.AssetRow>
      );
  }
});
 
export default AssetRow;
