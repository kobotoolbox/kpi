/*eslint no-unused-vars:0*/
import React from 'react/addons';
import Dropzone from './libs/dropzone';
import Select from 'react-select';
import alertify from 'alertifyjs';
import {Link} from 'react-router';
import mdl from './libs/rest_framework/material';
import TagsInput from 'react-tagsinput';
import ReactZeroClipboard from 'react-zeroclipboard';

import {dataInterface} from './dataInterface';
import stores from './stores';
import bem from './bem';
import actions from './actions';
import ui from './ui';
import ReactTooltip from 'react-tooltip';
import {
  formatTime,
  customConfirm,
  customConfirmAsync,
  customPromptAsync,
  log,
  t,
  assign,
  notify,
} from './utils';

var AssetTypeIcon = bem.create('asset-type-icon');

var mixins = {};

mixins.taggedAsset = {
  mixins: [
    React.addons.LinkedStateMixin
  ],
  tagChange (tags/*, changedTag*/) {
    var uid = this.props.uid || this.props.params.assetid;
    actions.resources.updateAsset(uid, {
      tag_string: tags.join(',')
    });
  },
  linkTagState () {
    // because onChange doesn't work when valueLink is specified.
    var that = this, ls = this.linkState('tags'), rc = ls.requestChange;
    ls.requestChange = function(...args) {
      that.tagChange(...args);
      rc.apply(this, args);
    };
    return ls;
  },
  adaptInputSize (e) {
    var l = e.target.value.length;
    e.target.size = l + 5;
  },
  renderTaggedAssetTags () {
    var transform = function(tag) {
      // Behavior should match KpiTaggableManager.add()
      return tag.trim().replace(/ /g, '-');
    };
    // react-tagsinput splits on tab (9) and enter (13) by default; we want to
    // split on comma (188) as well
    var addKeys = [9, 13, 188];
    return (
      <div>
        <TagsInput ref="tags" classNamespace="k"
          valueLink={this.linkTagState()} transform={transform} onKeyUp={this.adaptInputSize}
          addKeys={addKeys} placeholder={t('#tags +')}/>
      </div>
    );
  }
};

var dmix = {
  assetTypeRenderers: {
    block: {
      innerRender: function () {
        return (
            <bem.AssetView m={['type-block']}>
              {this.renderAncestors()}
              <ui.Panel margin='thin' className='ui-panel--overflowhidden'>
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
      innerRender: function () {
        return (
            <bem.AssetView m={['type-question']}>
              {this.renderAncestors()}
              <ui.Panel margin='thin'>
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
      innerRender: function () {
        return (
            <bem.FormView>
              {this.renderAncestors()}
              {this.renderHeader()}
              <bem.FormView__row>
                <bem.FormView__cell m='overview'>
                  <bem.FormView__label m='title'>
                    {t('Form Overview')}
                  </bem.FormView__label>
                  {this.renderDeployments()}
                </bem.FormView__cell>
              </bem.FormView__row>
              { this.state.has_deployment ?
                this.renderInstructions()
              : null }
              <ReactTooltip effect="float" place="bottom" />
            </bem.FormView>
          );
      }
    }
  },
  renderAncestors () {},
  renderHeader () {

    return (
        <bem.FormView__header m={[
              this.state.name ? 'named' : 'untitled'
            ]}>
          <bem.FormView__tabs>
            <bem.FormView__tab className="is-edge">
              {t('Summary')}
            </bem.FormView__tab>
            <bem.FormView__tab className="active">
              {t('Form')}
            </bem.FormView__tab>
            { this.state.deployment__identifier != undefined && this.state.deployment__active ?
              <bem.FormView__tab>
                <a href={this.state.deployment__identifier}>{t('Data')}</a>
              </bem.FormView__tab>
            : null }

            {this.renderExtraButtons()}

          </bem.FormView__tabs>
          <bem.FormView__name>
            <ui.AssetName {...this.state} />
          </bem.FormView__name>
          <bem.FormView__description className="is-edge">
            {t('no description yet')}
          </bem.FormView__description>
        </bem.FormView__header>
      );
  },
  renderEditPreviewButtons () {
    var downloadable = !!this.state.downloads[0],
        downloads = this.state.downloads;
    return (
        <bem.FormView__group m='buttons'>
          <bem.FormView__link m={['edit', {
              disabled: !this.state.userCanEdit,
                }]} 
              href={this.makeHref('form-edit', {assetid: this.state.uid})}
              data-tip={t('Edit in Form Builder')}>
            <i className="k-icon-edit" />
          </bem.FormView__link>
          <bem.FormView__link m='preview' 
            href={this.makeHref('form-preview-enketo', {assetid: this.state.uid})}
            data-tip={t('Preview')}>
            <i className="k-icon-view" />
          </bem.FormView__link>
          <bem.FormView__link m={'deploy'} 
            onClick={this.deployAsset}
            data-tip={this.state.deployed_version_id === null ? t('deploy') : t('redeploy')}>
            <i className="k-icon-deploy" />
            
          </bem.FormView__link>

            <bem.FormView__item m={'more-actions'} 
              onFocus={this.toggleDownloads}
              onBlur={this.toggleDownloads}>
              <bem.FormView__button disabled={!downloadable}>
              <i className="k-icon-more-actions" />
              </bem.FormView__button>
              { (downloadable && this.state.downloadsShowing) ?
                <bem.PopoverMenu ref='dl-popover'>
                  <bem.PopoverMenu__item>
                    <i className="k-icon-download" />
                    {t('Download as')}
                  </bem.PopoverMenu__item>
                  {downloads.map((dl)=>{
                    return (
                        <bem.PopoverMenu__link m={`dl-${dl.format}`} href={dl.url}
                            key={`dl-${dl.format}`}>
                          {dl.format}
                        </bem.PopoverMenu__link>
                      );
                  })}
                  <bem.PopoverMenu__link onClick={this.saveCloneAs}>
                    <i className="k-icon-clone"/>
                    {t('Clone this project')}
                  </bem.PopoverMenu__link>

                  <Dropzone fileInput onDropFiles={this.onDrop}
                        disabled={!this.state.userCanEdit}>
                    <bem.PopoverMenu__link m={['upload', {
                      disabled: !this.state.userCanEdit
                        }]}>
                      <i className="k-icon-replace" />
                      {t('Replace with XLS')}
                    </bem.PopoverMenu__link>
                  </Dropzone>

                </bem.PopoverMenu>
              : null }
            </bem.FormView__item>
        </bem.FormView__group>
      );
  },
  renderName () {
    return (
        <bem.AssetView__name m={[
              this.state.name ? 'named' : 'untitled'
            ]}>
          <AssetTypeIcon m={this.state.asset_type}><i /></AssetTypeIcon>
          <ui.AssetName {...this.state} />
        </bem.AssetView__name>
      );
  },
  renderExtraButtons () {
    return (
      <bem.FormView__extras>
        <button className="mdl-button mdl-js-button mdl-button--icon"
                id="form-header-extras">
          <i className="material-icons">more_vert</i>
        </button>

        <ul className="mdl-menu mdl-menu--bottom-right mdl-js-menu mdl-js-ripple-effect"
            htmlFor="form-header-extras">
          <li>
            <a className="mdl-menu__item" onClick={this.saveCloneAs}>
              {t('Clone this project')}
            </a>
          </li>

          <li>
            <a href={this.makeHref('form-sharing', {assetid: this.state.uid})} className="mdl-menu__item">
              <i />
              {t('Share this project')}
            </a>
          </li>

          <li>
            <a className="mdl-menu__item" onClick={this.deleteAsset}>
              <i />
              {t('Delete this project')}
            </a>
          </li>
        </ul> 
      </bem.FormView__extras>
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
  renderInstructions () {
    // PM: local testing deployment links
    // var deployment__links = {
    //   offline_url: "https://enke.to/_/#self",
    //   url: "https://enke.to/::self",
    //   iframe_url: "https://enke.to/i/::self",
    //   preview_url: "https://enke.to/preview/::self"
    // };
    var deployment__links = this.state.deployment__links;

    var deployment__links_list = [];
    var label = undefined;
    var desc = undefined;
    var value = undefined;

    for (var key in deployment__links) {
      value = deployment__links[key];

      switch(key) {
        case 'offline_url':
          label = t('Online-Offline (multiple submission)');
          desc = t('This allows online and offline submissions and is the best option for collecting data in the field. ');
          break;
        case 'url':
          label = t('Online-Only (multiple submissions)');
          desc = t('This is the best option when entering many records at once on a computer, e.g. for transcribing paper records');
          break;
        case 'iframe_url':
          label = t('Embeddable web form code');
          desc = t('Use this html5 code snippet to integrate your form on your own website using smaller margins. ');
          value = '<iframe src="'+deployment__links[key]+'" width="800" height="600"></iframe>';
          break;
        case 'preview_url':
          label = t('View only');
          desc = t('Use this version fpr testing, getting feedback. Does not allow submitting data. ');
          break;
      }

      deployment__links_list.push(
        {
          key: key,
          value: value,
          label: label, 
          desc: desc
        }
      );
    }

    var kc_server = document.createElement('a');
    kc_server.href = this.state.deployment__identifier;

    return (
      <bem.FormView__row m="collecting">
        <bem.FormView__cell m='collecting-webforms'>
          <bem.FormView__banner m="webforms">
            <bem.FormView__label m='white'>
              {t('Collecting Data with Web Forms')}
            </bem.FormView__label>
          </bem.FormView__banner>
          <a href="http://support.kobotoolbox.org/customer/en/portal/articles/1653790-collecting-data-through-web-forms"
             className="collect-link collect-link__web"
             target="_blank">
            {t('Learn more')} 
            <i className="fa fa-arrow-right"></i>
          </a>
          <bem.FormView__item m={'collect'} 
            onFocus={this.toggleCollectOptions}
            onBlur={this.toggleCollectOptions}>
            <bem.FormView__button m='collectOptions'>
              {this.state.selectedCollectOption.label != null ? t(this.state.selectedCollectOption.label) : t('Choose an option')}
              <i className="fa fa-caret-up" />
            </bem.FormView__button>
            {this.state.collectOptionsShowing ?
              <bem.PopoverMenu ref='collect-popover'>
                {deployment__links_list.map((c)=>{
                  return (
                      <bem.PopoverMenu__link  key={`c-${c.value}`} 
                                              onClick={this.setSelectedCollectOption(c)}
                                              className={this.state.selectedCollectOption.value == c.value ? 'active' : null}>
                        <span className="label">{c.label}</span>
                        <span className="desc">{c.desc}</span>
                      </bem.PopoverMenu__link>
                    );
                })}
              </bem.PopoverMenu>
            : null }
          </bem.FormView__item>
          {this.state.selectedCollectOption.value ?
            <bem.FormView__item m={'collect-links'}>
              <ReactZeroClipboard text={this.state.selectedCollectOption.value} onAfterCopy={this.afterCopy}>
                <a className="copy">copy</a>
              </ReactZeroClipboard>
              {this.state.selectedCollectOption.key != 'iframe_url' ?
                <a href={this.state.selectedCollectOption.value} target="_blank" className="open">
                  {t('Open')}
                </a>
              : null }
            </bem.FormView__item>
          : null }
        </bem.FormView__cell>
        <bem.FormView__cell m='collecting-android'>
          <bem.FormView__banner m="android">
            <bem.FormView__label m='white'>
              {t('Collecting Data with Android App')}
            </bem.FormView__label>
          </bem.FormView__banner>
          <a href="http://support.kobotoolbox.org/customer/en/portal/articles/1653782-collecting-data-with-kobocollect-on-android"
             className="collect-link collect-link__android"
             target="_blank">
            {t('Learn more')} 
            <i className="fa fa-arrow-right"></i>
          </a>

          <ol>
            <li>
              {t('Install')} 
              &nbsp;
              <a href="https://play.google.com/store/apps/details?id=org.koboc.collect.android&hl=en" target="_blank">KoboCollect</a>
              &nbsp;
              {t('on your Android device.')}
            </li>
            <li>{t('Click on')} <i className="material-icons">more_vert</i> {t('to open settings.')}</li>
            <li>{t('Enter the server URL') + ' ' + kc_server.origin + ' ' + t('and your username and password')}</li>
            <li>{t('Open "Get Blank Form" and select this project. ')}</li>
            <li>{t('Open "Enter Data."')}</li>
          </ol>
        </bem.FormView__cell>
      </bem.FormView__row>
      );
  },
  afterCopy() {
    notify(t('copied to clipboard'));
  },
  toggleCollectOptions (evt) {
    var isBlur = evt.type === 'blur',
        $popoverMenu;
    if (isBlur) {
      $popoverMenu = $(this.refs['collect-popover'].getDOMNode());
      // if we setState and immediately hide popover then the
      // download links will not register as clicked
      $popoverMenu.fadeOut(250, () => {
        this.setState({
          collectOptionsShowing: false,
        });
      });
    } else {
      this.setState({
        collectOptionsShowing: true,
      });
    }
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
  setSelectedCollectOption(c) {
    return function (e) {
      this.setState({
        selectedCollectOption: c,
      });
    }.bind(this)
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
              {this.state.deployed_version_id === null ?
                t('deploy') : t('redeploy')}
            </bem.AssetView__button>
          </bem.AssetView__buttoncol>
          : null }

        </bem.AssetView__buttons>
      );
  },
  saveCloneAs (evt) {
    let version_id = evt.currentTarget.dataset.versionId;
    customPromptAsync(t('new form name'))
      .then((value) => {
        let uid = this.props.params.assetid;
        actions.resources.cloneAsset({
          uid: uid,
          name: value,
          version_id: version_id,
        }, {
          onComplete: (asset) => {
            this.transitionTo('form-landing', {
              assetid: asset.uid,
            });
          }
        });
      });
  },
  reDeployConfirm (asset) {
    let dialog = alertify.dialog('confirm');
    let opts = {
      title: t('overwrite existing deployment on kobocat'),
      message: t('this form has already been deployed. are you sure you ' +
                 'want overwrite the existing deployment? this action ' +
                 'cannot be undone. consider deploying a clone instead.'),
      labels: {ok: t('ok'), cancel: t('cancel')},
      onok: (evt, val) => {
        let ok_button = dialog.elements.buttons.primary.firstChild;
        ok_button.disabled = true;
        ok_button.innerText = t('Deploying...');
        actions.resources.deployAsset(asset, true, dialog);
        // keep the dialog open
        return false;
      },
      oncancel: () => {
        dialog.destroy();
      }
    };
    dialog.set(opts).show();
  },
  deployAsset (asset) {
    if (!asset || asset.kind != 'asset') {
        if (this.state && this.state.kind == 'asset') {
          asset = this.state;
        } else {
          console.error(
            'Neither the arguments nor the state supplied an asset.');
          return;
        }
    }
    if (asset.deployed_version_id === null) {
      // There's no existing deployment for this asset
      let deployment_alert = alertify.warning(t('deploying to kobocat...'), 60);
      actions.resources.deployAsset(asset, false, deployment_alert);
    } else {
      // We are about to overwrite(!) an existing deployment
      dmix.reDeployConfirm(asset);
    }
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
  toggleDeploymentHistory () {
    this.setState({
      historyExpanded: !this.state.historyExpanded,
    });
  },
  renderDeployments () {
    // var deployed_versions = [
    //     {
    //       version_id: 1, 
    //       date_deployed: 'June 1 2016',
    //     },
    //     {
    //       version_id: 2, 
    //       date_deployed: 'June 1 2016',
    //     },
    //     {
    //       version_id: 3, 
    //       date_deployed: 'June 1 2016',
    //     }
    // ];

    return (
        <bem.FormView__group m="deployments">
          <bem.FormView__group m="headings">
            <bem.FormView__label m='version'>
              {t('Current Version')}
            </bem.FormView__label>
            <bem.FormView__label m='date'>
              {t('Modified Date')}
            </bem.FormView__label>
            <bem.FormView__label m='lang'>
              {t('Languages')}
            </bem.FormView__label>
            <bem.FormView__label m='questions'>
              {t('Questions')}
            </bem.FormView__label>
          </bem.FormView__group>
          <bem.FormView__group m="deploy-row">
            <bem.FormView__item m='version'>
              {this.state.version_id}
              {this.renderEditPreviewButtons()}
            </bem.FormView__item>
            <bem.FormView__item m='date'>
              {formatTime(this.state.date_modified)}
            </bem.FormView__item>
            <bem.FormView__item m='lang'>
              {this.state.summary.languages}
            </bem.FormView__item>
            <bem.FormView__item m='questions'>
              {this.state.summary.row_count}
            </bem.FormView__item>
          </bem.FormView__group>

          {this.state.deployed_versions.length > 0 && 
            <bem.FormView__group m={["history", this.state.historyExpanded ? 'historyExpanded' : 'historyHidden']}>
              <bem.FormView__group m="history-contents">
                <bem.FormView__label m='previous-versions'>
                  {t('Previous Versions')}
                </bem.FormView__label>

                {this.state.deployed_versions.map((item) => {
                  return (
                    <bem.FormView__group m="deploy-row">
                      <bem.FormView__item m='version'>
                        {item.version_id}
                        <bem.FormView__group m='buttons'>
                          <bem.FormView__link m='clone' 
                              data-version-id={item.version_id}
                              data-tip={t('Clone as new project')}
                              onClick={this.saveCloneAs}>
                            <i className="k-icon-clone" />
                          </bem.FormView__link>
                        </bem.FormView__group>
                      </bem.FormView__item>
                      <bem.FormView__item m='date'>
                        {formatTime(item.date_deployed)}
                      </bem.FormView__item>

                      <bem.FormView__item m='lang'></bem.FormView__item>
                      <bem.FormView__item m='questions'></bem.FormView__item>
                    </bem.FormView__group>
                  );
                })}
              </bem.FormView__group>

              <bem.FormView__button onClick={this.toggleDeploymentHistory}>
                {this.state.historyExpanded ? t('Hide full history') : t('Show full history')}
              </bem.FormView__button>

            </bem.FormView__group>
          }
        </bem.FormView__group>
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
      <ui.Panel>
        <bem.Loading>
          <bem.Loading__inner>
            <i />
            {t('loading...')} 
          </bem.Loading__inner>
        </bem.Loading>
      </ui.Panel>
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
      historyExpanded: false,
      collectionOptionList: [],
      selectedCollectOption: {},
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
            label: isLibrary ? t('Library List') : t('Projects'),
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
  },
  componentDidUpdate() {
    mdl.upgradeDom();
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
        dmix.deployAsset(asset);
      },
    }
  },
};

export default mixins;
