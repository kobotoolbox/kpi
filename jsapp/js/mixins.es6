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
var ReactTooltip = require('react-tooltip');
var assign = require('react/lib/Object.assign');
import Select from 'react-select';
// var Reflux = require('reflux');

var dmix = {
  assetTypeRenderers: {
    block: {
      renderTypeHeader () {
        var effect='solid';
        var atype_tip = t('can be imported into a form from the question library');
        return (
            <bem.AssetView__assetTypeWrap m={'type-block'}>
              <bem.AssetView__assetType>
                <i />
                <span data-tip={atype_tip}>{t('reusable question block')}</span>
              </bem.AssetView__assetType>
              <hr />
              <ReactTooltip effect={effect} />
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
                  {this.renderParentCollection()}
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
                  {this.renderParentCollection()}
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
                {t('form')}
                <small>
                  {t('deployable')}
                </small>
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
                  {/* this.renderParentCollection() */}
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
  renderAncestors () {},
  renderName () {
    return (
        <bem.AssetView__name m={[
              this.state.name ? 'named' : 'untitled'
            ]}>
          <i />
          <ui.AssetName {...this.state} />
        </bem.AssetView__name>
      );
  },
  renderParentCollection () {
    var value = null,
        opts = this.state.collectionOptionList;
    if (this.state.parent && opts && opts.length > 0) {
      opts.forEach((opt) => {
        if (this.state.parent.indexOf(opt.value) > 0) {
          value = opt.value;
          return false;
        }
      })
    }
    return (
        <bem.AssetView__parent m={'parent'}>
          <bem.AssetView__iconwrap><i /></bem.AssetView__iconwrap>
          <bem.AssetView__col m="date-modified">
            <Select
              name="parent_collection"
              value={value}
              allowCreate={true}
              clearable={true}
              addLabelText={t('make new collection: "{label}"')}
              clearValueText={t('none')}
              searchPromptText={t('collection name')}
              placeholder={t('select parent collection')}
              options={this.state.collectionOptionList}
              onChange={this.onCollectionChange}
            />
          </bem.AssetView__col>
        </bem.AssetView__parent>
      );
  },
  onCollectionChange (nameOrId, items, x, y, z) {
    var uid = this.props.params.assetid;
    var item = items[0];
    if (!item) {
      dataInterface.patchAsset(uid, {
          parent: null,
        });
    } else if (item.create) {
      dataInterface.createCollection({
        name: item.value
      }).done((newCollection)=>{
        dataInterface.patchAsset(uid, {
          parent: `/collections/${newCollection.uid}/`,
        });
      });
    } else if (item) {
      dataInterface.patchAsset(uid, {
        parent: `/collections/${item.value}/`,
      });
    }
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
              {t('last saved')}
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
            <bem.AssetView__span m="can-view">
              {viewerCount} { viewerCount === 1 ? t('viewer') : t('viewers') }
            </bem.AssetView__span>
            <bem.AssetView__span m="can-edit">
              {editorCount} { editorCount === 1 ? t('editor') : t('editors') }
            </bem.AssetView__span>
            <bem.AssetView__link m="sharing" href={this.makeHref('form-sharing', {assetid: this.state.uid})}>
              {t('edit')}
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
  toggleDownloads (evt) {
    var isFocusEvent = evt.type === 'focus',
        isBlur = evt.type === 'blur',
        $popoverMenu;
    if (isBlur) {
      $popoverMenu = $(this.refs['dl-popover'].getDOMNode());
      // if we setState and immediately hide popover then the
      // download links will not register as clicked
      $popoverMenu.fadeOut(250, () => {
        this.setState({
          downloadsShowing: false,
        });
      });
    } else {
      this.setState({
        downloadsShowing: true,
      });
    }
  },
  renderButtons () {
    var downloadable = !!this.state.downloads[0],
        downloads = this.state.downloads;

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
          <bem.AssetView__buttoncol
                onFocus={this.toggleDownloads}
                onBlur={this.toggleDownloads}>
            <bem.AssetView__button m={'download'}
                  disabled={!downloadable}>
              <i />
              {t('download')}
            </bem.AssetView__button>
            {(downloadable && this.state.downloadsShowing) ?
              <bem.PopoverMenu ref='dl-popover'>
                {downloads.map((dl)=>{
                  return (
                      <bem.PopoverMenu__link m={`dl-${dl.format}`} href={dl.url}
                          key={`dl-${dl.format}`}>
                        <i />
                        {t(`download-${dl.format}`)}
                      </bem.PopoverMenu__link>
                    );
                })}
              </bem.PopoverMenu>
            :null}
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
              {t('deploy')}
              <i />
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
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]
    var file = files[0];
    if (VALID_ASSET_UPLOAD_FILE_TYPES.indexOf(file.type) === -1) {
      var err = `Invalid filetype: '${file.type}'`;
      console && console.error(err);
      notify(err, 'error');
    } else {
      this.dropFiles(files);
    }
  },
  forEachDroppedFile (evt, file, params) {
    dataInterface.postCreateBase64EncodedImport({
      destination: this.state.url,
      base64Encoded: evt.target.result,
      name: file.name,
      lastModified: file.lastModified,
      contentType: file.type,
    }).done((data, status, jqxhr)=> {
      log('Successfully created import: ', data);
      var importUid = data.uid;
      window.setTimeout((()=>{
        dataInterface.getImportDetails({
          uid: importUid
        }).done((importData, status, jqxhr)=>{
          if (importData.status === 'complete') {
            var assetData = importData.messages.updated || importData.messages.created;
            var assetUid = assetData && assetData.length > 0 && assetData[0].uid;
            if (assetUid) {
              actions.resources.loadAsset({id: assetUid});
            } else {
              notify(t('could not find asset id'), 'error');
            }
          }
          log('import status', importData);
          notify(`import: '${importData.status}'`)
        }).fail((failData)=>{
          notify(t('import failed'))
          log('import failed', failData);
        })
      }), 2500);
      notify(t('successfully created import.'));
    }).fail((jqxhr)=> {
      log('Failed to create import: ', jqxhr);
      notify(t('failed to create import'));
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
      collectionOptionList: [],
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
  collectionStoreChange ({collectionList}) {
    this.setState({
      collectionOptionList:
        collectionList.map(function(c){
            return {
              value: c.uid,
              label: c.name || c.uid,
            }
          })
    });
  },
  componentDidMount () {
    this.listenTo(stores.session, this.dmixSessionStoreChange);
    this.listenTo(stores.asset, this.dmixAssetStoreChange);
    this.listenTo(stores.collections, this.collectionStoreChange);
    actions.resources.listCollections();

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
  _forEachDroppedFile (evt, file, params={}) {
    actions.resources.createImport({
      base64Encoded: e.target.result,
      name: file.name,
      lastModified: file.lastModified,
      contentType: file.type
    });
  },
  dropFiles (files, params={}) {
    files.map((file) => {
      var reader = new FileReader();
      reader.onload = (e)=>{
        var f = this.forEachDroppedFile || this._forEachDroppedFile;
        f.call(this, e, file, params);
      }
      reader.readAsDataURL(file);
    });
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
  ancestorListToParams (ancestorList) {
    return ancestorList.reduce(function(arr, ancestor) {
      arr.push(
        {
          children: ancestor.name,
          to: 'collection-page',
          params: {
            uid: ancestor.uid
          }
        }
      );
      return arr;
    }, [
      {
        children: t('collections'),
        to: 'collections'
      }
    ]);
  },
  _breadcrumbItem (item) {
    return (
        <ui.BreadcrumbItem>
          <Link {...item} />
        </ui.BreadcrumbItem>
      );
  },
};


mixins.collectionList = {
  getInitialState () {
    return {
      collectionList: [],
      collectionSearchState: 'none',
      collectionCount: 0,
      collectionStore: stores.collections,
    }
  },
  listCollections () {
    actions.resources.listCollections();
  },
  componentDidMount () {
    this.listenTo(stores.collections, this.collectionsChanged);
  },
  collectionsChanged (collections) {
    this.setState(collections);
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

mixins.clickAssets = {
  onActionButtonClick (evt) {
    var data = evt.actionIcon ? evt.actionIcon.dataset : evt.currentTarget.dataset;
    var assetType = data.assetType,
        action = data.action,
        disabled = data.disabled == "true",
        uid = stores.selectedAsset.uid,
        result;
    var click = this.click;

    if (action === 'new') {
      result = this.click.asset.new.call(this);
    } else if (this.click[assetType] && this.click[assetType][action]) {
      result = this.click[assetType][action].call(this, uid, evt);
    }
    if (result !== false) {
      evt.preventDefault();
    }
  },
  click: {
    collection: {
      sharing: function(uid, evt){
        this.transitionTo('collection-sharing', {assetid: uid});
      },
      view: function(uid, evt){
        this.transitionTo('collection-page', {uid: uid})
      },
      delete: function(uid, evt){
        window.confirm(t('Warning! You are about to delete this collection with all its questions and blocks. Are you sure you want to continue?')) &&
            actions.resources.deleteCollection({uid: uid});
      },
    },
    asset: {
      new: function(uid, evt){
        this.transitionTo('new-form')
      },
      view: function(uid, evt){
        this.transitionTo('form-landing', {assetid: uid})
      },
      clone: function(uid, evt){
        actions.resources.cloneAsset({uid: uid})
      },
      download: function(uid, evt){
        this.transitionTo('form-download', {assetid: uid})
      },
      delete: function(uid, evt){
        window.confirm(t('You are about to permanently delete this form. Are you sure you want to continue?')) &&
          actions.resources.deleteAsset({uid: uid});
      },
      deploy: function(uid, evt){
        var asset_url = stores.selectedAsset.asset.url;
        // var form_id_string = prompt('form_id_string');
        actions.resources.deployAsset(asset_url);
      },
    }
  },
};

export default mixins;
