/*eslint no-unused-vars:0*/
import React from 'react/addons';
import Dropzone from './libs/dropzone';
import Select from 'react-select';
import alertify from 'alertifyjs';
import {Link} from 'react-router';
import ReactTooltip from 'react-tooltip';

import {dataInterface} from './dataInterface';
import stores from './stores';
import bem from './bem';
import actions from './actions';
import ui from './ui';
import {
  formatTime,
  customConfirm,
  customConfirmAsync,
  customPromptAsync,
  log,
  t,
  assign,
} from './utils';

var mixins = {};

var dmix = {
  assetTypeRenderers: {
    block: {
      renderTypeHeader () {
        var effect = 'solid';
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
              <ui.Panel margin='thin' className='ui-panel--overflowhidden'>
                {this.renderTypeHeader()}
                <bem.AssetView__content>
                  {this.renderName()}
                  {this.renderTags()}
                  {this.renderParentCollection()}
                  <bem.AssetView__row m='meta'>
                    {this.renderUsers()}
                    {this.renderIsPublic()}
                    {this.renderRowCount()}
                    {this.renderRevisions()}
                    {this.renderDateCreated()}
                    {this.renderDateModified()}
                  </bem.AssetView__row>
                  <bem.AssetView__row m='buttons'>
                    {this.renderButtons({deployable: false})}
                    {this.renderLanguages()}
                  </bem.AssetView__row>
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
              <ui.Panel margin='thin'>
                {this.renderTypeHeader()}
                <bem.AssetView__content>
                  {this.renderName()}
                  {this.renderTags()}
                  {this.renderParentCollection()}
                  <bem.AssetView__row m='meta'>
                    {this.renderUsers()}
                    {this.renderIsPublic()}
                    {this.renderRowCount()}
                    {this.renderRevisions()}
                    {this.renderDateCreated()}
                    {this.renderDateModified()}
                  </bem.AssetView__row>
                  <bem.AssetView__row m='buttons'>
                    {this.renderButtons({deployable: false})}
                    {this.renderLanguages()}
                  </bem.AssetView__row>
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
              <ui.Panel margin='thin'>
                {this.renderTypeHeader()}
                <bem.AssetView__content>
                  {this.renderName()}
                  {this.renderTags()}
                  <bem.AssetView__row m='meta'>
                    {this.renderUsers()}
                    {this.renderIsPublic()}
                    {this.renderRowCount()}
                    {this.renderRevisions()}
                    {this.renderDateCreated()}
                    {this.renderDateModified()}
                  </bem.AssetView__row>
                  {/* this.renderParentCollection() */}
                  <bem.AssetView__row m='buttons'>
                    {this.renderButtons({deployable: true})}
                    {this.renderDeployments()}
                    {this.renderLanguages()}
                  </bem.AssetView__row>
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
      });
    }
    return (
        <bem.AssetView__parent m={'parent'}>
          <bem.AssetView__iconwrap><i /></bem.AssetView__iconwrap>
          <bem.AssetView__col m='date-modified'>
            <Select
              name='parent_collection'
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
  onCollectionChange (nameOrId, items) {
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

  _renderTag (tag) {
    return (
        <bem.AssetView__tags__tag>{tag}</bem.AssetView__tags__tag>
      );
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
    var editorCount = Object.keys(this.state.access.change).length;
    var viewerCount = Object.keys(this.state.access.view).length;
    return (
      <bem.AssetView__col m='owner'>
        <bem.AssetView__label>
          {t('owner')}
        </bem.AssetView__label>
        <bem.AssetView__span m='val'>
          <bem.AssetView__span m='username'>
            {this.state.owner__username}
          </bem.AssetView__span>
          <bem.AssetView__span m='can-view'>
            { `${viewerCount} ${viewerCount === 1 ? t('viewer') : t('viewers')}` }
          </bem.AssetView__span>
          <bem.AssetView__span m='can-edit'>
            { `${editorCount} ${editorCount === 1 ? t('editor') : t('editors')}` }
          </bem.AssetView__span>
        </bem.AssetView__span>
      </bem.AssetView__col>
    );
  },
  renderIsPublic () {
    var is_public = this.state.access.isPublic,
        linkSharingM = ['status', `linksharing-${is_public ? 'on' : 'off'}`];
    return (
      <bem.AssetView__col m={linkSharingM}>
        <bem.AssetView__label>
          {t('status')}
        </bem.AssetView__label>
        <bem.AssetView__span m='val'>
          {
            is_public ? t('public') : t('private')
          }
        </bem.AssetView__span>
      </bem.AssetView__col>
      );
  },
  renderRowCount () {
    return (
      <bem.AssetView__col m='rowcount'>
        <bem.AssetView__label>
          {t('questions')}
        </bem.AssetView__label>
        <bem.AssetView__span m='val'>
          {this.state.summary.row_count}
        </bem.AssetView__span>
      </bem.AssetView__col>
      );
  },
  renderRevisions () {
    return (
      <bem.AssetView__col m='revisions'>
        <bem.AssetView__label>
          {t('revisions')}
        </bem.AssetView__label>
        <bem.AssetView__span m='val'>
          {this.state.version_count}
        </bem.AssetView__span>
      </bem.AssetView__col>
      );
  },
  renderDateCreated () {
    return (
      <bem.AssetView__col m='date-created'>
        <bem.AssetView__label>
          {t('created')}
        </bem.AssetView__label>
        <bem.AssetView__span m='val'>
          {formatTime(this.state.date_created)}
        </bem.AssetView__span>
      </bem.AssetView__col>
      );
  },
  renderDateModified () {
    return (
      <bem.AssetView__col m='date-modified'>
        <bem.AssetView__label>
          {t('modified')}
        </bem.AssetView__label>
        <bem.AssetView__span m='val'>
          {formatTime(this.state.date_modified)}
        </bem.AssetView__span>
      </bem.AssetView__col>
      );
  },
  renderLanguages () {
    var langs = this.state.summary.languages;
    var langCount = langs && langs.length;
    if (!langs) {
      return (
          <bem.AssetView__langs m={'null'}>
            <bem.AssetView__label>
              {t('no language information')}
            </bem.AssetView__label>
          </bem.AssetView__langs>
        );
    } else if (langCount === 0) {
      return (
          <bem.AssetView__langs m={'none'}>
            <bem.AssetView__label>
              {t('no translations')}
            </bem.AssetView__label>
          </bem.AssetView__langs>
        );
    }
    return (
        <bem.AssetView__langs>
          <bem.AssetView__label>
            {t('languages') + ': '}
          </bem.AssetView__label>
          <bem.AssetView__value>
            {this.state.summary.languages.length}
          </bem.AssetView__value>
          <bem.AssetView__colsubtext>
            {this.state.summary.languages.join(', ')}
          </bem.AssetView__colsubtext>
        </bem.AssetView__langs>
      );
  },
  toggleDownloads (evt) {
    var isBlur = evt.type === 'blur',
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
  renderButtons ({deployable}) {
    var downloadable = !!this.state.downloads[0],
        downloads = this.state.downloads;

    return (
        <bem.AssetView__buttons>
          <bem.AssetView__buttoncol>
            <bem.AssetView__link m='preview' href={this.makeHref('form-preview-enketo', {assetid: this.state.uid})}>
              <i />
              {t('preview')}
            </bem.AssetView__link>
          </bem.AssetView__buttoncol>
          <bem.AssetView__buttoncol>
            <bem.AssetView__link m={['edit', {
              disabled: !this.state.userCanEdit,
                }]} href={this.makeHref('form-edit', {assetid: this.state.uid})}>
              <i />
              {t('edit')}
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
            { (downloadable && this.state.downloadsShowing) ?
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
            : null }
          </bem.AssetView__buttoncol>
          <bem.AssetView__buttoncol>
            <bem.AssetView__link m='clone' onClick={this.saveCloneAs}>
              <i />
              {t('clone')}
            </bem.AssetView__link>
          </bem.AssetView__buttoncol>
          <bem.AssetView__buttoncol>
            <bem.AssetView__link m='sharing' href={this.makeHref('form-sharing', {assetid: this.state.uid})}>
              <i />
              {t('share')}
            </bem.AssetView__link>
          </bem.AssetView__buttoncol>
          { deployable ?
          <bem.AssetView__buttoncol>
            <bem.AssetView__button m={'deploy'}  onClick={this.deployAsset}>
              <i />
              {t('deploy')}
            </bem.AssetView__button>
          </bem.AssetView__buttoncol>
          : null }

        </bem.AssetView__buttons>
      );
  },
  saveCloneAs () {
    customPromptAsync(t('new form name'))
      .then((value) => {
        let uid = this.props.params.assetid;
        actions.resources.cloneAsset({
          uid: uid,
          name: value,
        }, {
          onComplete: (asset) => {
            this.transitionTo('form-landing', {
              assetid: asset.uid,
            });
          }
        });
      });
  },
  deployPrompt (asset_url, settings) {
    let defaultFormId = (settings && settings.form_id) || '';
    let dialog = alertify.dialog('prompt');
    let opts = {
      title: t('deploy form to kobocat'),
      message: t('please specify a form id'),
      value: defaultFormId,
      labels: {ok: t('ok'), cancel: t('cancel')},
      onok: (evt, val) => {
        let ok_button = dialog.elements.buttons.primary.firstChild;
        ok_button.disabled = true;
        ok_button.innerText = t('Deploying...');
        // pass the dialog so it can be modified to include error messages
        actions.resources.deployAsset(asset_url, val, dialog);
        // keep the dialog open
        return false;
      },
      oncancel: () => {
        dialog.destroy();
      }
    };
    dialog.set(opts).show();
  },
  deployAsset () {
    let asset_url = this.state.url;
    let settings = this.state.settings;
    dmix.deployPrompt(asset_url, settings);
  },
  deleteAsset (...args) {
    let uid = this.props.params.assetid;
    let aType = this.state.asset_type;
    let q_ = t('You are about to permanently delete this ___. Are you sure you want to continue?')
                .replace('___', t(aType));
    customConfirmAsync(q_)
      .done(() => {
        actions.resources.deleteAsset({uid: uid}, {
          onComplete: ()=> {
            this.transitionTo(aType === 'survey' ? 'forms' : 'library');
          }
        });
      });
  },
  renderDeployments () {
    return (
        <bem.AssetView__row m='secondary-buttons'>
          <bem.AssetView__buttoncol m='first'></bem.AssetView__buttoncol>
          <bem.AssetView__buttoncol>
            <Dropzone fileInput onDropFiles={this.onDrop}
                  disabled={!this.state.userCanEdit}>
              <bem.AssetView__button m={['refresh', {
                disabled: !this.state.userCanEdit
                  }]}>
                <i />
                {t('refresh')}
              </bem.AssetView__button>
            </Dropzone>
          </bem.AssetView__buttoncol>
          <bem.AssetView__buttoncol m='third'></bem.AssetView__buttoncol>
          <bem.AssetView__buttoncol m='fourth'></bem.AssetView__buttoncol>
          <bem.AssetView__buttoncol>
            <bem.AssetView__button m='delete' onClick={this.deleteAsset}>
              <i />
              {t('delete')}
            </bem.AssetView__button>
          </bem.AssetView__buttoncol>
          <bem.AssetView__deployments>
            {
              this.state.deployment_count ?
                `${t('deployments')}: ${this.state.deployment_count}`
                :
                t('no deployments')
            }
          </bem.AssetView__deployments>
        </bem.AssetView__row>
      );
  },
  onDrop (files) {
    if (files.length !== 1) {
      throw new Error('Only 1 file can be uploaded in this case');
    }
    const VALID_ASSET_UPLOAD_FILE_TYPES = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    var file = files[0];
    if (VALID_ASSET_UPLOAD_FILE_TYPES.indexOf(file.type) === -1) {
      var err = `Invalid filetype: '${file.type}'`;
      console.error(err);
      alertify.error(err);
    } else {
      this.dropFiles(files);
    }
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
    return this.innerRender();
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
        let isLibrary = asset.asset_type !== 'survey';

        stores.pageState.setHeaderBreadcrumb([
          {
            label: isLibrary ? t('library') : t('forms'),
            to: isLibrary ? 'library' : 'forms',
          },
          {
            label: t(`view-${asset.asset_type}`),
            to: 'form-landing',
            params: {
              assetid: asset.uid,
            }
          }
        ]);

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
            };
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
        actions.resources.loadAsset({id: uid});
      }, Math.random() * 3000);
    } else if (uid) {
      actions.resources.loadAsset({id: uid});
    }
  }
};
mixins.dmix = dmix;

mixins.droppable = {
  _forEachDroppedFile (evt, file/*, params={}*/) {
    var isLibrary = !!this.context.router.getCurrentPathname().match(/library/);
    dataInterface.postCreateBase64EncodedImport(assign({
        base64Encoded: evt.target.result,
        name: file.name,
        library: isLibrary,
        lastModified: file.lastModified,
      }, this.state.url ? {
        destination: this.state.url,
      } : null
    )).then((data)=> {
      window.setTimeout((()=>{
        dataInterface.getImportDetails({
          uid: data.uid,
        }).done((importData/*, status, jqxhr*/) => {
          if (importData.status === 'complete') {
            var assetData = importData.messages.updated || importData.messages.created;
            var assetUid = assetData && assetData.length > 0 && assetData[0].uid,
                isCurrentPage = this.state.uid === assetUid;

            if (!assetUid) {
              alertify.error(t('Could not redirect to asset.'));
            } else if (isCurrentPage) {
              actions.resources.loadAsset({id: assetUid});
            } else {
              this.transitionTo('form-landing', {assetid: assetUid});
            }
          }
          // If the import task didn't complete immediately, inform the user accordingly.
          else if (importData.status === 'processing') {
            alertify.warning(t('Your library assets have uploaded and are being processed. This may take a few moments.'));
          } else if (importData.status === 'created') {
            alertify.warning(t('Your library assets have uploaded and are queued for processing. This may take a few moments.'));
          } else if (importData.status === 'error')  {
            var error_message= `<strong>Import Error.</strong><br><code><strong>${importData.messages.error_type}</strong><br>${importData.messages.error}</code>`
            alertify.error(t(error_message));
          } else {
            alertify.error(t('Import Failure.'));
          }
        }).fail((failData)=>{
          alertify.error(t('Import Failed.'));
          log('import failed', failData);
        });
      }), 2500);
    }).fail((jqxhr)=> {
      log('Failed to create import: ', jqxhr);
      alertify.error(t('Failed to create import.'));
    });
  },
  dropFiles (files, params={}) {
    files.map((file) => {
      var reader = new FileReader();
      reader.onload = (e)=>{
        var f = this.forEachDroppedFile || this._forEachDroppedFile;
        f.call(this, e, file, params);
      };
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
    // initial state is a copy of "stores.collections.initialState"
    return assign({}, stores.collections.initialState);
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
      actions.resources.readCollection.failed.listen(this.collectionAssetsFailed);
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
    };
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
  collectionAssetsChange (/*data*/) {
  },
  assetSearchChange (/*data*/) {
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
                <input type='checkbox' />
                {t('my forms')}
              </label>
            </bem.ListView__searchcriterion>
            <bem.ListView__searchcriterion>
              <label>
                <input type='radio' />
                {t('shared with me')}
              </label>
            </bem.ListView__searchcriterion>
            <bem.ListView__searchcriterion>
              <label>
                <input type='radio' />
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
    });
  },
  panelButtons () {
    return (
        <bem.ListView__headerbutton m={{
          add: true,
          expanded: this.state.addOptionsExpanded
        }} onClick={this.expandAddOptions}>
          <i />
        </bem.ListView__headerbutton>
      );
  },
  panelContents () {
    if (this.state.loadError) {
      return (
          <bem.Message m='error'>
            <strong>{t('error loading data')}</strong>
            <br />
            {this.state.loadError}
          </bem.Message>
        );
    } else if (this.state.results) {
      return (
          <bem.Message m='loaded'>
            <strong>{t('results loaded')}</strong>
            <br />
            {this.state.results.length}
          </bem.Message>
        );
    } else {
      return (
          <bem.Message m='loading'>
            <i />
            {t('loading')}
          </bem.Message>
        );

    }
  },
  _createPanel () {
    return (
        <bem.ListView>
          <ui.Panel margin='thin'>
            {this.panelName(this.props.name)}
            {this.panelButtons()}
            {this.panelSearchBar()}
            {
              this.panelContents()
            }
          </ui.Panel>
        </bem.ListView>
      );
  }
};

mixins.clickAssets = {
  onActionButtonClick (evt) {
    var data = evt.actionIcon ? evt.actionIcon.dataset : evt.currentTarget.dataset;
    var assetType = data.assetType,
        action = data.action,
        // disabled = data.disabled === 'true',
        uid = stores.selectedAsset.uid,
        result;
    // var click = this.click;
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
      sharing: function(uid/*, evt*/){
        this.transitionTo('collection-sharing', {assetid: uid});
      },
      view: function(uid/*, evt*/){
        this.transitionTo('collection-page', {uid: uid});
      },
      delete: function(uid/*, evt*/){
        var q_ = t('Warning! You are about to delete this collection with all its questions and blocks. Are you sure you want to continue?');
        customConfirmAsync(q_)
          .done(function(){
            actions.resources.deleteCollection({uid: uid});
          });
      },
    },
    asset: {
      new: function(/*uid, evt*/){
        this.transitionTo('new-form');
      },
      view: function(uid/*, evt*/){
        this.transitionTo('form-landing', {assetid: uid});
      },
      clone: function(uid/*, evt*/){
        customPromptAsync(t('new name?'))
          .then((value) => {
            actions.resources.cloneAsset({
              uid: uid,
              name: value,
            }, {
              onComplete: (asset) => {
                this.refreshSearch && this.refreshSearch();
              }
            });
          });
      },
      download: function(uid/*, evt*/){
        this.transitionTo('form-download', {assetid: uid});
      },
      edit: function (uid) {
        this.transitionTo('form-edit', {assetid: uid});
      },
      delete: function(uid/*, evt*/){
        var q_ = t('You are about to permanently delete this form. Are you sure you want to continue?');
        customConfirmAsync(q_)
          .done(function(){
            actions.resources.deleteAsset({uid: uid});
          });
      },
      deploy: function(/*uid, evt*/){
        let asset = stores.selectedAsset.asset;
        dmix.deployPrompt(asset.url, asset.settings);
      },
    }
  },
};

export default mixins;
