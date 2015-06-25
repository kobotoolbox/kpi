var mixins = {};

import Dropzone from './libs/dropzone';
import {notify, getAnonymousUserPermission, formatTime, anonUsername, parsePermissions, log, t} from './utils';
import {dataInterface} from './dataInterface';
import stores from './stores';
import React from 'react/addons';
import Router from 'react-router';
var Link = Router.Link;
import bem from './bem';
import actions from './actions';
import ui from './ui';
var assign = require('react/lib/Object.assign');
// var Reflux = require('reflux');

var dmix = {
  assetTypeRenderers: {
    block: {
      renderTypeHeader () {
        return (
            <bem.AssetView__assetTypeWrap m={'type-block'}>
              <bem.AssetView__assetType>
                <i />
                {t('reusable question block')}
              </bem.AssetView__assetType>
              <hr />
            </bem.AssetView__assetTypeWrap>
          );
      },
      innerRender: function () {
        return (
            <bem.AssetView m={['type-block']}>
              {this.renderAncestors()}
              <ui.Panel margin="thin" className="ui-panel--overflowhidden">
                {this.renderTypeHeader()}
                <bem.AssetView__content>
                  {this.renderName()}
                  {this.renderTimes()}
                  {this.renderTags()}
                  {this.renderUsers()}
                  {this.renderIsPublic()}
                  {this.renderLanguages()}
                  {this.renderButtons()}
                </bem.AssetView__content>
              </ui.Panel>
            </bem.AssetView>
          );
      }
    },
    question: {
      renderTypeHeader () {
        return (
            <bem.AssetView__assetTypeWrap m={'type-question'}>
              <bem.AssetView__assetType>
                <i />
                {t('reusable question')}
              </bem.AssetView__assetType>
              <hr />
            </bem.AssetView__assetTypeWrap>
          );
      },
      innerRender: function () {
        return (
            <bem.AssetView m={['type-question']}>
              {this.renderAncestors()}
              <ui.Panel margin="thin">
                {this.renderTypeHeader()}
                <bem.AssetView__content>
                  {this.renderName()}
                  {this.renderTimes()}
                  {this.renderTags()}
                  {this.renderUsers()}
                  {this.renderIsPublic()}
                  {this.renderLanguages()}
                  {this.renderButtons()}
                </bem.AssetView__content>
              </ui.Panel>
            </bem.AssetView>
          );
      },
    },
    survey: {
      renderTypeHeader () {
        return (
            <bem.AssetView__assetTypeWrap m={'type-survey'}>
              <bem.AssetView__assetType>
                <i />
                {t('survey')}
              </bem.AssetView__assetType>
              <hr />
            </bem.AssetView__assetTypeWrap>
            );
      },
      innerRender: function () {
        return (
            <bem.AssetView m={['type-survey']}>
              {this.renderAncestors()}
              <ui.Panel margin="thin">
                {this.renderTypeHeader()}
                <bem.AssetView__content>
                  {this.renderName()}
                  {this.renderTimes()}
                  {this.renderTags()}
                  {this.renderUsers()}
                  {this.renderIsPublic()}
                  {this.renderLanguages()}
                  {this.renderButtons()}
                  {this.renderRowCount()}
                  {this.renderDeployments()}
                </bem.AssetView__content>
              </ui.Panel>
            </bem.AssetView>
          );
      }
    }
  },
  renderAncestors () {
    var ancestors = [{
      children: 'forms',
      to: 'forms',
      params: {}      
    }];
    return this.renderAncestorBreadcrumb(ancestors)
  },
  renderName () {
    return (
        <bem.AssetView__name m={[
              this.state.name ? 'named' : 'untitled'
            ]}>
          <i />
          {this.state.name || t('no name')}
        </bem.AssetView__name>
      );
  },
  renderTimes () {
    return (
        <bem.AssetView__times>
          <bem.AssetView__iconwrap><i /></bem.AssetView__iconwrap>
          <bem.AssetView__col m="revisions">
            {t('r')}{this.state.version_count}
          </bem.AssetView__col>
          <bem.AssetView__col m="date-modified">
            <bem.AssetView__colsubtext>
              {t('modified')}
            </bem.AssetView__colsubtext>
            {formatTime(this.state.date_modified)}
          </bem.AssetView__col>
          <bem.AssetView__col m="date-created">
            <bem.AssetView__colsubtext>
              {t('created')}
            </bem.AssetView__colsubtext>
            {formatTime(this.state.date_created)}
          </bem.AssetView__col>
        </bem.AssetView__times>
      );
  },
  _renderTag (tag) {
    return <bem.AssetView__tags__tag>{tag}</bem.AssetView__tags__tag>
  },
  renderTags () {
    return (
        <bem.AssetView__tags>
          <bem.AssetView__iconwrap><i /></bem.AssetView__iconwrap>
          {
            this.renderTaggedAssetTags()
          }
        </bem.AssetView__tags>
      );
  },
  renderUsers () {
    var editorCount = Object.keys(this.state.access.change).length
    var viewerCount = Object.keys(this.state.access.view).length
    return (
        <bem.AssetView__users>
          <bem.AssetView__iconwrap><i /></bem.AssetView__iconwrap>
          <bem.AssetView__col m="users">
            <bem.AssetView__span m="owner">
              <i />
              {t('owner:')} {this.state.owner__username}
            </bem.AssetView__span>
            <bem.AssetView__span m="can-edit">
              {editorCount} {t('can edit')}
            </bem.AssetView__span>
            <bem.AssetView__span m="can-edit">
              {editorCount} {t('can edit')}
            </bem.AssetView__span>
            <bem.AssetView__span m="can-view">
              {viewerCount} {t('can view')}
            </bem.AssetView__span>
            <bem.AssetView__link m="sharing" href={this.makeHref('form-sharing', {assetid: this.state.uid})}>
              <i />
              {t('sharing')}
            </bem.AssetView__link>
          </bem.AssetView__col>
        </bem.AssetView__users>
      );
  },
  renderIsPublic () {
    var is_public = this.state.access.isPublic;
    return (
        <bem.AssetView__inlibrary>
          <bem.AssetView__iconwrap><i /></bem.AssetView__iconwrap>
          <bem.AssetView__col m={['publicshared', is_public ? 'public' : 'private' ]}>
            {
              is_public ? 'in library' : 'private'
            }
          </bem.AssetView__col>
        </bem.AssetView__inlibrary>
      );
  },
  renderRowCount () {
    return (
        <bem.AssetView__row>
          <bem.AssetView__iconwrap><i /></bem.AssetView__iconwrap>
          <bem.AssetView__key>
            {t('number of questions')}:
          </bem.AssetView__key>
          <bem.AssetView__val>
            {this.state.summary.row_count}
          </bem.AssetView__val>
        </bem.AssetView__row>
      );
  },
  renderLanguages () {
    return (
        <bem.AssetView__langs>
          <bem.AssetView__iconwrap><i /></bem.AssetView__iconwrap>
          <bem.AssetView__col m="languages">
            <bem.AssetView__label>
              {t('languages') + ':'}
            </bem.AssetView__label>
            <bem.AssetView__value>
              {this.state.summary.languages.length}
            </bem.AssetView__value>
            <bem.AssetView__colsubtext>
              {this.state.summary.languages.join(', ')}
            </bem.AssetView__colsubtext>
          </bem.AssetView__col>
        </bem.AssetView__langs>
      );
  },
  renderButtons () {
    return (
        <bem.AssetView__buttons>
          <bem.AssetView__iconwrap><i /></bem.AssetView__iconwrap>
          <bem.AssetView__buttoncol>
            <bem.AssetView__link m={['edit', {
              disabled: !this.state.userCanEdit,
                }]} href={this.makeHref('form-edit', {assetid: this.state.uid})}>
              <i />
              {t('edit')}
            </bem.AssetView__link>
          </bem.AssetView__buttoncol>
          <bem.AssetView__buttoncol>
            <bem.AssetView__link m="preview" href={this.makeHref('form-preview-enketo', {assetid: this.state.uid})}>
              <i />
              {t('preview')}
            </bem.AssetView__link>
          </bem.AssetView__buttoncol>
          <bem.AssetView__buttoncol>
            <bem.AssetView__link m="download" href={this.makeHref('form-download', {assetid: this.state.uid})}>
              <i />
              {t('download')}
            </bem.AssetView__link>
          </bem.AssetView__buttoncol>
          <bem.AssetView__buttoncol>
            <Dropzone fileInput onDropFiles={this.onDrop}
                  disabled={!this.state.userCanEdit}>
              <bem.AssetView__button m={['update', {
                disabled: !this.state.userCanEdit
                  }]}>
                <i />
                {t('update')}
              </bem.AssetView__button>
            </Dropzone>
          </bem.AssetView__buttoncol>
        </bem.AssetView__buttons>
      );
  },
  deployAsset () {
    actions.resources.deployAsset(this.state.url);
  },
  renderDeployments () {
    return (
        <bem.AssetView__row>
          <bem.AssetView__deployments>
            <i />
            {
              this.state.deployment_count ? 
                `${t('deployments')}: ${this.state.deployment_count}`
                :
                t('no deployments')
            }
            <bem.AssetView__deploybutton onClick={this.deployAsset}>
              <i />
              {t('deploy')}
            </bem.AssetView__deploybutton>
          </bem.AssetView__deployments>
        </bem.AssetView__row>
      );
  },
  onDrop (files) {
    if (files.length !== 1) {
      throw new Error("Only 1 file can be uploaded in this case");
    }
    const VALID_ASSET_UPLOAD_FILE_TYPES = [
      'application/vnd.ms-excel'
    ]
    var file = files[0];
    if (VALID_ASSET_UPLOAD_FILE_TYPES.indexOf(file.type) === -1) {
      throw new Error(`Invalid filetype: ${file.type}`);
    }
    actions.resources.updateAsset(this.state.uid, {
      base64Encoded: 'ENCODE ASSET IN KPI/JS/MIXINS.ES6'
    });
  },
  summaryDetails () {
    return (
      <pre>
        <code>
          {this.state.asset_type}
          <br />
          {`[${Object.keys(this.state).join(', ')}]`}
          <br />
          {JSON.stringify(this.state.summary, null, 4)}
        </code>
      </pre>
      );
  },
  asJson(){
    return (
        <pre>
          <code>
            {JSON.stringify(this.state, null, 4)}
          </code>
        </pre>
      );
  },
  innerRender () {
    return (
        <bem.AssetView m='loadin g'>
          <ui.Panel>
            <i />
            {t('loading asset')}
          </ui.Panel>
        </bem.AssetView>
      );
  },
  _createPanel () {
    return this.innerRender()
  },
  isOwner() {
    if (!this.state.owner__username || !this.state.currentUsername) {
      return false;
    }
    return this.state.currentUsername === this.state.owner__username;
  },
  getCurrentUserPermissions ({access}, {currentUsername}) {
    var ownerUsername = access && access.ownerUsername;
    var isOwner = currentUsername === ownerUsername;
    var canEdit;
    var canView;
    canEdit = isOwner || access && access.change[currentUsername];
    canView = isOwner || access && access.view[currentUsername];
    return {
      userCanEdit: !!canEdit,
      userCanView: !!canView,
      isOwner: isOwner
    };
  },
  dmixSessionStoreChange (val) {
    var currentUsername = val && val.currentAccount && val.currentAccount.username;
    this.setState(assign({
        currentUsername: currentUsername
      },
      this.getCurrentUserPermissions(this.state, {currentUsername: currentUsername})
    ));
  },
  getInitialState () {
    return {
      userCanEdit: false,
      userCanView: true,
      currentUsername: stores.session.currentAccount && stores.session.currentAccount.username,
    };
  },
  dmixAssetStoreChange (data) {
    var uid = this.props.params.assetid || this.props.uid || this.props.params.uid,
      asset = data[uid];
    if (asset) {
      if (!this.extended_by_asset_type) {
        var _mx = dmix.assetTypeRenderers[asset.asset_type];
        if ('asset_type' in asset && _mx) {
          assign(this, _mx, {
            extended_by_asset_type: true
          });
        }
      }
      this.setState(assign({},
          data[uid],
          this.getCurrentUserPermissions(data[uid], this.state)
        ));
    }
  },
  componentDidMount () {
    this.listenTo(stores.session, this.dmixSessionStoreChange);
    this.listenTo(stores.asset, this.dmixAssetStoreChange)

    var uid = this.props.params.assetid || this.props.uid || this.props.params.uid;
    if (this.props.randdelay && uid) {
      window.setTimeout(()=>{
        actions.resources.loadAsset({id: uid})
      }, Math.random() * 3000);
    } else if (uid) {
      actions.resources.loadAsset({id: uid})
    }
  }
};
mixins.dmix = dmix;

mixins.droppable = {
  dropFiles (files, params) {
    if (files.length > 1) {
      notify('cannot load multiple files');
    } else {
      files.map(function(file){
        var reader = new FileReader();
        reader.onload = (e)=>{
          actions.resources.createAsset({
            base64Encoded: e.target.result,
            name: file.name,
            lastModified: file.lastModified,
            contentType: file.type
          });
        }
        reader.readAsDataURL(file);
      });
    }
  }
};

mixins.ancestorBreadcrumb = {
  componentDidMount () {
  },
  // getInitialState () {
  //   return {}
  // },
  renderAncestorBreadcrumb (ancestors) {
    return (
        <ui.Breadcrumb>
          {ancestors.map(this._breadcrumbItem)}
        </ui.Breadcrumb>
      );
  },
  _breadcrumbItem (item) {
    return (
        <ui.BreadcrumbItem>
          <Link {...item} />
        </ui.BreadcrumbItem>
      );
  },
};

mixins.cmix = {
  componentDidMount () {
    this.listenTo(stores.session, this.cmixSessionStoreChange);
    if (this.props.searchParams) {
      this.listenTo(stores.assetSearch, this.assetSearchChange);
    }
    if (this.props.listAssetsParams) {
      this.listenTo(stores.allAssets, this.allAssetsSearchChange);
    }
    if (this.props.uid) {
      this.listenTo(stores.collectionAssets, this.collectionAssetsChange);
      actions.resources.readCollection.failed.listen(this.collectionAssetsFailed)
      actions.resources.readCollection({uid: this.props.uid});
    } else {
      actions.resources.listAssets();
    }
  },
  cmixSessionStoreChange () {

  },
  getInitialState () {
    return {
      searchPlaceholder: 'search',
      expandAddOptions: false
    }
  },
  allAssetsSearchChange () {

  },
  collectionAssetsFailed (reqDetails, request, errcode, errmessage) {
    if (reqDetails.uid === this.props.uid) {
      this.setState({
        loadError: `${errmessage}`
      });
    }
  },
  collectionAssetsChange (data) {
  },
  assetSearchChange (data) {
  },
  panelHeader () {
    var ancestors = [{
      children: 'forms',
      to: 'forms',
      params: {}      
    }];
    return this.renderAncestorBreadcrumb(ancestors);
  },
  panelName (placeholder) {
    if (!this.state.name) {
      return (
          <bem.ListView__attr m={['name', 'placeholder']}>
            {placeholder}
          </bem.ListView__attr>
        );
    }
    return (
        <bem.ListView__attr m='name'>
          {this.state.name}
        </bem.ListView__attr>
      );
  },
  panelSearchBar () {
    return (
        <bem.ListView__search>
          <ui.SmallInputBox placeholder={this.state.searchPlaceholder} />
          <bem.ListView__searchcriteria>
            <bem.ListView__searchcriterion>
              <label>
                <input type="checkbox" />
                {t('my forms')}
              </label>
            </bem.ListView__searchcriterion>
            <bem.ListView__searchcriterion>
              <label>
                <input type="radio" />
                {t('shared with me')}
              </label>
            </bem.ListView__searchcriterion>
            <bem.ListView__searchcriterion>
              <label>
                <input type="radio" />
                {t('public')}
              </label>
            </bem.ListView__searchcriterion>
          </bem.ListView__searchcriteria>
        </bem.ListView__search>
      );
  },
  expandAddOptions () {
    this.setState({
      expandAddOptions: !this.state.expandAddOptions
    })
  },
  panelButtons () {
    return (
        <bem.ListView__headerbutton m={{
          add: true,
          expanded: this.state.addOptionsExpanded
        }} onClick={this.expandAddOptions}>
          <i />
        </bem.ListView__headerbutton>
      )
  },
  panelContents () {
    if (this.state.loadError) {
      return (
          <bem.Message m="error">
            <strong>{t('error loading data')}</strong>
            <br />
            {this.state.loadError}
          </bem.Message>
        );
    } else if (this.state.results) {
      return (
          <bem.Message m="loaded">
            <strong>{t('results loaded')}</strong>
            <br />
            {this.state.results.length}
          </bem.Message>
        );
    } else {
      return (
          <bem.Message m="loading">
            <i />
            {t('loading')}
          </bem.Message>
        );

    }
  },
  _createPanel () {
    return (
        <bem.ListView>
          {
            this.panelHeader()
          }
          <ui.Panel margin="thin">
            {this.panelName(this.props.name)}
            {this.panelButtons()}
            {this.panelSearchBar()}
            {
              this.panelContents()
            }
          </ui.Panel>
        </bem.ListView>
      )
  }
}


export default mixins;