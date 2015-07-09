import {notify, getAnonymousUserPermission, formatTime, anonUsername, parsePermissions, log, t} from './utils';
var $ = require('jquery');
window.jQuery = $;
window.$ = $;
require('jquery.scrollto');
require('jquery-ui/sortable');
var select2 = require('select2-browserify');
var actions = require('./actions');
// import XLSX from 'xlsx';

import React from 'react/addons';
import Router from 'react-router';
import Q from 'q';
import Sidebar from './components/sidebar';
import TagsInput from 'react-tagsinput';
import classNames from 'classnames';
import alertify from 'alertifyjs';
var ReactTooltip = require("react-tooltip");
// import {Sheeted} from './models/sheeted';
import stores from './stores';
import Dropzone from './libs/dropzone';
import icons from './icons';
import cookie from 'react-cookie';
import bem from './bem';
import ui from './ui';
import mixins from './mixins';

var DocumentTitle = require('react-document-title');

import Favicon from 'react-favicon';


var bootstrap = require('./libs/rest_framework/bootstrap.min');

var dkobo_xlform = require('./libs/xlform_with_deps');

var assign = require('react/lib/Object.assign');
var Reflux = require('reflux');

var Navigation = Router.Navigation;
let DefaultRoute = Router.DefaultRoute;
let Link = Router.Link;
let Route = Router.Route;
let RouteHandler = Router.RouteHandler;
let NotFoundRoute = Router.NotFoundRoute;

mixins.taggedAsset = {
  mixins: [
    React.addons.LinkedStateMixin
  ],
  componentWillUnmount () {
    if (this._tagsChanged) {
      var uid = this.props.params.assetid || this.props.params.uid;
      actions.resources.updateAsset(uid, {
        tag_string: this.state.tags.join(',')
      })
    }
  },
  tagChange (tags, changedTag) {
    this._tagsChanged = true;
  },
  linkTagState () {
    // because onChange doesn't work when valueLink is specified.
    var that = this, ls = this.linkState('tags'), rc = ls.requestChange;
    ls.requestChange = function(...args) {
      that.tagChange(...args);
      rc.apply(this, args);
    }
    return ls;
  },
  renderTaggedAssetTags () {
    return (
        <div>
          <TagsInput ref="tags" classNamespace="k" valueLink={this.linkTagState()} />
        </div>
      );
  }
};

mixins.formView = {
  _saveForm (evt) {
    evt && evt.preventDefault();
    actions.resources.updateAsset(this.props.params.assetid, {
      name: this.getNameValue(),
      content: surveyToValidJson(this.state.survey)
    });
    this.setState({
      asset_updated: false
    });
  },
  navigateBack (evt) {
    if (this.needsSave() && confirm(t('you have unsaved changes. would you like to save?'))) {
      this._saveForm();
    }
    this.transitionTo('forms');
  },
  loadingNotice () {
    return (
        <p>
          <i className='fa fa-spinner fa-spin' />
          &nbsp;&nbsp;
          {t('loading form...')}
        </p>
      );
  },
  renderSubSettingsBar () {
    return <FormSettingsBox {...this.state} />;
  },
  nameInputValue () {
    return this.refs['form-name'].getDOMNode().value;
  },
  nameInputChange (evt) {
    var nameVal = this.nameInputValue();
    this.state.survey.settings.set('form_title', nameVal)
    this.setState({
      survey_name: this.state.survey.settings.get('form_title')
    });
  },
  getInitialState () {
    return {
      'asset_updated': true
    }
  },
  needsSave () {
    return this.state.asset_updated === -1;
  },
  renderCloseButton() {
    var kls = classNames('k-form-close-button', {
      "k-form-close-button--warning": this.needsSave()
    });
    return <a className={kls} onClick={this.navigateBack}>&times;</a>;
  },
  innerRender () {

    return (
        <ui.Panel className="k-div--formview--innerrender">
          <div className="row k-form-header-row">
            {this.renderCloseButton()}
            <div className="k-header-name-row form-group col-md-10">
              <div className="k-corner-icon"></div>
              {this.renderFormNameInput()}
            </div>
            <div className="col-md-2">
              <div className="k-col-padrt25">
                {this.renderSaveAndPreviewButtons()}
              </div>
            </div>
          </div>
          { this.state.survey ?
            this.renderSubSettingsBar()
          :null}

          { ('renderSubTitle' in this) ? 
            this.renderSubTitle()
          : null}
          <div ref="form-wrap" className='form-wrap'>
          </div>
        </ui.Panel>
      );
  },
};

mixins.permissions = {
  removePerm (permName, permObject, content_object_uid) {
    return (evt) => {
      evt.preventDefault();
      actions.permissions.removePerm({
        permission_url: permObject.url,
        content_object_uid: content_object_uid
      })
    }
  },
  setPerm (permName, props) {
    return (evt) => {
      evt.preventDefault();
      actions.permissions.assignPerm({
        username: props.username,
        uid: props.uid,
        kind: props.kind,
        objectUrl: props.objectUrl,
        role: permName
      });
    }
  }
};

mixins.collection = {
  getInitialState () {
    return {
      results: false,
      list: false
    }
  },
  componentDidMount () {
    stores.pageState.setState({
      headerSearch: true,
      assetNavPresent: false,
      assetNavIsOpen: false,
      bgTopPanelHeight: 60,
      bgTopPanelFixed: true
    });

    this.initialAction();
    this.addListeners();
    this.listenTo(stores.selectedAsset, this.onSelectedAssetChange);
  },
  onToggleSelect () {
    this.setState({
      selectOn: !this.state.selectOn
    });
  },
  collectionSearchFieldValue () {
    return this.refs['formlist-search'].getDOMNode().value;
  },
  liveSearch () {
    var queryInput = this.collectionSearchFieldValue(),
      r;
    if (queryInput && queryInput.length > 2) {
      if (r = stores.assetSearch.getRecentSearch(queryInput)) {
        this.setState({
          searchResults: r
        });
      } else {
        actions.search.assetsWithTags({q: queryInput, tags: this.state.selectedTags});
      }
    }
  },
  renderList (items) {
    var currentUsername = sessionStore.currentAccount && sessionStore.currentAccount.username;
    return items.map((resource) => {
            // perm should be cached in the resource upon arrival
            var perm = parsePermissions(resource.owner, resource.permissions)
            var isSelected = stores.selectedAsset.uid === resource.uid;
            return <AssetRow key={resource.uid}
                              currentUsername={currentUsername}
                              onToggleSelect={this.onToggleSelect}
                              perm={perm}
                              onActionButtonClick={this.actionButtonClick}
                              isSelected={isSelected}
                              {...resource}
                                />
          });
  },
  renderLoadingMessage () {
    return (
        <div className='k-loading-message-with-padding'>
          <i className='fa fa-spinner fa-spin' />
          &nbsp;
          {this._loadingMessage()}
        </div>
      );
  },
  renderPanel () {
    return (
      <ui.Panel className="k-div--formspanel">
        {this._renderFormsSearchRow()}
        <ul className="collection-asset-list list-group">
          {this.state.list === false ?
            this.renderLoadingMessage()
            :
            this.renderList(this.state.list)
          }
        </ul>
        <RouteHandler />
      </ui.Panel>
    );
  },
  onSelectedAssetChange () {
    this.setState({
      selectedAsset: stores.selectedAsset.asset
    });
  },
  click: {
    collection: {
      view: function(uid, evt){
        this.transitionTo('collection-page', {uid: uid})
      },
      // edit: function(uid, evt){
      //   this.transitionTo('form-edit', {assetid: uid})
      // },
      // preview: function(uid, evt){
      //   this.transitionTo('collection-page', {assetid: uid})
      // },
      clone: function(uid, evt){
        this.transitionTo('collection-page', {uid: uid})
      },
      download: function(uid, evt){
        this.transitionTo('collection-page', {uid: uid})
      },
      delete: function(uid, evt){
        actions.resources.deleteCollection({uid: uid})
      },
    },
    asset: {
      new: function(uid, evt){
        log('transitionTo new-form')
        this.transitionTo('new-form')
      },
      view: function(uid, evt){
        this.transitionTo('form-landing', {assetid: uid})
      },
      // edit: function(uid, evt){
      //   this.transitionTo('form-edit', {assetid: uid})
      // },
      // preview: function(uid, evt){
      //   this.transitionTo('form-preview-enketo', {assetid: uid})
      // },
      clone: function(uid, evt){
        actions.resources.cloneAsset({uid: uid})
      },
      download: function(uid, evt){
        this.transitionTo('form-download', {assetid: uid})
      },
      delete: function(uid, evt){
        actions.resources.deleteAsset({uid: uid})
      },
      deploy: function(uid, evt){
        var asset_url = stores.selectedAsset.asset.url;
        // var form_id_string = prompt('form_id_string');
        actions.resources.deployAsset(asset_url);
      },
    }
  },
  actionButtonClick (evt) {
    var data = evt.actionIcon ? evt.actionIcon.dataset : evt.currentTarget.dataset;
    var assetType = data.assetType,
        action = data.action,
        disabled = data.disabled == "true",
        uid = this.state.list && stores.selectedAsset.uid,
        result;
    var click = this.click || mixins.collection.click;

    if (action === 'new') {
      result = this.click.asset.new.call(this);
    } else if (this.click[assetType] && this.click[assetType][action]) {
      result = this.click[assetType][action].call(this, uid, evt);
    }
    if (result !== false) {
      evt.preventDefault();
    }
  },
  _actionButtons () {
    var selectedAsset = stores.selectedAsset.asset;
    var assetIsSelected = this.state.list && selectedAsset && selectedAsset.uid;
    var assetType = selectedAsset && selectedAsset.kind;
    var actionButtonsEnabled = {
      new: true
    };
    if (assetIsSelected) {
      assign(actionButtonsEnabled, {
        view: true,
        edit: assetType === 'asset',
        preview: assetType === 'asset',
        download: true,
        clone: assetType === 'asset',
        delete: true,
        deploy: assetType === 'asset'
      });
    };
    var actionButton = (actn, assetType) => {
      var isDisabled = !actionButtonsEnabled[actn];
      var onClickAction = !isDisabled ? this.click[assetType][actn] : null;
      return (
            <bem.CollectionHeader__button
                data-action={actn}
                data-asset-type={assetType}
                data-disabled={isDisabled}
                onClick={this.actionButtonClick}
                href="#"
                m={[`${actn}-${assetType}`, {
                    'disabled': isDisabled
                  }]}>
              <i />
              {t(actn)}
            </bem.CollectionHeader__button>
        );
    }
    return (
        <bem.CollectionHeader>
          <bem.CollectionHeader__buttonRow>
            <bem.CollectionHeader__buttonGroup m="new">
              {actionButton('new', 'asset')}
            </bem.CollectionHeader__buttonGroup>
            <bem.CollectionHeader__buttonGroup m="actions">
              <div>
                {actionButton('view', 'asset')}
                {actionButton('download', 'asset')}
                {actionButton('clone', 'asset')}
                {actionButton('delete', 'asset')}
              </div>
            </bem.CollectionHeader__buttonGroup>
            <bem.CollectionHeader__buttonGroup m="deploy">
              {actionButton('deploy', 'asset')}
            </bem.CollectionHeader__buttonGroup>
          </bem.CollectionHeader__buttonRow>
        </bem.CollectionHeader>
      );
  },
  render () {
    return (
      <DocumentTitle title={this._title()}>
        <div>
          <Dropzone className='dropfiles'
                activeClassName='dropfiles--active'
                onDropFiles={this.dropFiles}
                params={{destination: false}}
                >
            {this.renderPanel()}
          </Dropzone>
        </div>
      </DocumentTitle>
      );
  }
};

var BgTopPanel = React.createClass({
  render () {
    var h = this.props.bgTopPanelHeight;
    var kls = classNames('bg-fixed-top-panel', `bg--h${h}`, {
      'bg--fixed': this.props.bgTopPanelFixed
    });
    return (<div className={kls} />);
  }
});


class UserDropdown extends React.Component {
  logout (evt) {
    evt.preventDefault();
    actions.auth.logout();
  }

  render () {
    var username = this.props.username || 'unk';
    return (
          <ul className="dropdown-menu dropdown-menu-right">
            <li className="link">
              <Link to="user-profile"
                  params={{username: username}}>
                {{username}} {t('profile')}
              </Link>
            </li>
            <li className="divider"></li>
            <li className="link">
              <a href="#" onClick={ this.logout.bind(this) }>
                {t('logout')}
              </a>
            </li>
          </ul>
      )
  }
}
class UserIcon extends React.Component {
  render () {
    /* defaultGravatarImage for admin@admin.com */
    var defaultGravatarImage = 'http://www.gravatar.com/avatar/64e1b8d34f425d19e1ee2ea7236d3028?s=40';
    var imgSrc = this.props.img || defaultGravatarImage;
    return (
        <a href="#" className="dropdown-toggle" data-toggle="dropdown">
          <img src={imgSrc} className="gravatar-img" />
        </a>
      )
  }
}
var RecentHistoryDropdownBase = React.createClass({
  mixins: [Reflux.ListenerMixin],
  getInitialState () {
    return { items: [] };
  },
  render () {}
});

class ItemDropdown extends React.Component {
  render () {
    return (
        <div className="item dropdown">
          <a href="#" className="dropdown-toggle" data-toggle="dropdown">
            <i className={this.props.iconKls} />
          </a>
          <ul className="dropdown-menu dropdown-menu-right">
            {this.props.children}
          </ul>
        </div>
        );
  }
}

class ItemDropdownItem extends React.Component {
  render () {
    return (
          <li>
            <Link to='form-edit'
                  params={{assetid: this.props.uid}}>
              <i className={classNames('fa', 'fa-sm', this.props.faIcon)} />
              &nbsp;
              &nbsp;
              {this.props.name || t('no name')}
            </Link>
          </li>
      );
  }
}

class ItemDropdownHeader extends React.Component {
  render () {
    return <li className="dropdown-header">{this.props.children}</li>;
  }
}

class ItemDropdownDivider extends React.Component {
  render () {
    return <li className="divider" />;
  }
}

var LoginForm = React.createClass({
  done (...args) {
    log(args, this)
  },

  fail (...args) {
    log(args, this);
  },

  handleSubmit (evt) {
    evt.preventDefault();
    var username = this.refs.username.getDOMNode().value;
    var password = this.refs.password.getDOMNode().value;
    actions.auth.login({
      username: username,
      password: password
    });
  },
  render () {
    return (
      <div className="col-md-4 pull-right">
        <form action="/api-auth/login/" className="form-inline" onSubmit={this.handleSubmit}>
          <div className="form-group">
            <input type="text" ref="username" placeholder="username" className="form-control input-sm" />
            <input type="password" ref="password" placeholder="password" className="form-control input-sm" />
            <button type="submit" className="btn btn-default btn-sm">{t('log in')}</button>
          </div>
        </form>
      </div>
      );
  }
});


var LiLink = React.createClass({
  render () {
    var liClass = this.props.active ? 'active' : '';
    var href = this.props.href || '#';
    var linkText = this.props.children || 'Link';
    var srOnly = this.props.srOnly;

    if (srOnly) {
      srOnly = (<span className="sr-only">{srOnly}</span>)
    }
    return <li className={liClass}><a href={href}>{linkText} {srOnly}</a></li>
  }
});

var assetStore = stores.asset;
var sessionStore = stores.session;


var TagList = React.createClass({
  tagClick (evt) {
    this.props.onTagClick(evt.currentTarget.dataset.tag, evt);
  },
  render () {
    var tags = this.props.tags || [];
    var selected = this.props.selected.reduce(function(sel, tagName){
      sel[tagName] = true;
      return sel;
    }, {});
    return (
      <bem.LibNav__tags>
        {tags.map((tag) => {
          return (
              <bem.LibNav__tag key={tag.name} data-tag={tag.name} onClick={this.tagClick} m={{
                    selected: selected[tag.name]
                  }}>
                {tag.name}
              </bem.LibNav__tag>
            );
        })}
      </bem.LibNav__tags>
    );
  }
});

var AssetNavigator = React.createClass({
  mixins: [
    mixins.droppable,
    Navigation,
    Reflux.ListenerMixin,
    Reflux.connectFilter(stores.assetSearch, 'searchResults', function(results){
      if (this.searchFieldValue() === results.query) {
        return results;
      }
    }),
    Reflux.connect(stores.tags, 'tags')
  ],
  componentDidMount() {
    this.listenTo(stores.assetLibrary, this.assetLibraryTrigger);
    actions.search.libraryDefaultQuery();

    this.listenTo(stores.pageState, this.handlePageStateStore);
    actions.resources.listTags()
  },
  activateSortable() {
    if (!this.refs.liblist) {
      return;
    }
    var $el = $(this.refs.liblist.getDOMNode());
    if ($el.hasClass('ui-sortable')) {
      $el.sortable('destroy');
    }
    $el.sortable({
      helper: 'clone',
      cursor: 'move',
      distance: 5,
      items: '> li',
      connectWith: '.survey-editor__list',
      opacity: 0.9,
      scroll: false,
      deactivate: ()=> {
        $el.sortable('cancel');
      }
    })
  },
  assetLibraryTrigger (res) {
    this.setState({
      assetLibraryItems: res
    });
  },
  handlePageStateStore (state) {
    this.setState(state);
  },
  getInitialState () {
    return {
      searchResults: {},
      imports: [],
      selectedTags: [],
      assetNavIntentOpen: stores.pageState.state.assetNavIntentOpen,
      assetNavIsOpen: stores.pageState.state.assetNavIsOpen
    };
  },
  getImportsByStatus (n) {
    this.imports.filter((i)=> i.status==n )
  },
  searchFieldValue () {
    return this.refs.navigatorSearchBox.refs.inp.getDOMNode().value;
  },
  liveSearch () {
    var queryInput = this.searchFieldValue(),
      r;
    if (queryInput && queryInput.length > 2) {
      if (r = stores.assetSearch.getRecentSearch(queryInput)) {
        this.setState({
          searchResults: r
        });
      } else {
        actions.search.assets(queryInput);
      }
    }
  },
  _displayAssetLibraryItems () {
    var qresults = this.state.assetLibraryItems;
    var alItems;
    var contents;
    if (qresults && qresults.count > 0) {
      alItems = qresults.results;
      return (
              <bem.LibList ref="liblist">
                {qresults.results.map((item)=> {
                  var modifiers = [item.asset_type];
                  var summ = item.summary;
                  return (
                      <bem.LibList__item m={modifiers} key={item.uid} data-uid={item.uid}>
                        <bem.LibList__dragbox />
                        <bem.LibList__label>
                          <ui.AssetName {...item} />
                        </bem.LibList__label>
                        <bem.LibList__qtype>
                          {t(item.asset_type)}
                        </bem.LibList__qtype>
                      </bem.LibList__item>
                    );
                })}
              </bem.LibList>
              );
    } else {
      return (
              <bem.LibList m={'loading'}>
                <bem.LibList__item m={'message'}>
                  <i />
                  {t('loading library assets')}
                </bem.LibList__item>
              </bem.LibList>
              );
    }
  },
  renderSearchResults () {
    var sr = this.state.searchResults;
    if (!sr || !('count' in sr)) {
      return this._displayAssetLibraryItems();
    } else if (sr.count === 0) {
      return (
          <bem.LibList m={'empty'}>
            <bem.LibList__item m={'message'}>
              {t('no search results found')}
            </bem.LibList__item>
          </bem.LibList>
        );
    } else if (sr.count > 0) {
      return (
              <bem.LibList m={'search-results'}>
                {sr.results.map((item)=> {
                  var modifiers = [item.asset_type];
                  var summ = item.summary;
                  return (
                      <bem.LibList__item m={modifiers}>
                        <bem.LibList__dragbox />
                        <bem.LibList__label>
                          <ui.AssetName {...item} />
                        </bem.LibList__label>
                        <bem.LibList__qtype>
                          {t(item.asset_type)}
                        </bem.LibList__qtype>
                        <bem.LibList__tags>
                          {(item.tags || []).map((tg)=>{
                            return <bem.LibList__tag>{tg}</bem.LibList__tag>;
                          })}
                        </bem.LibList__tags>
                      </bem.LibList__item>
                    );
                })}
              </bem.LibList>
        )
    }
  },
  toggleTagSelected (tag) {
    var tags = this.state.selectedTags,
        _ti = tags.indexOf(tag);
    if (_ti === -1) {
      tags.push(tag);
    } else {
      tags.splice(tags.indexOf(_ti), 1);
    }
    this.setState({
      selectedTags: tags
    });
  },
  onTagClick (tag) {
    this.toggleTagSelected(tag);
    this.liveSearch()
  },
  renderClosedContent () {
    return (
        <bem.LibNav m={'deactivated'}>
          <bem.LibNav__header m={'deactivated'}>
            <bem.LibNav__logo onClick={this.toggleOpen}>
              <i />
            </bem.LibNav__logo>
          </bem.LibNav__header>
        </bem.LibNav>
      );
  },
  toggleOpen () {
    stores.pageState.toggleAssetNavIntentOpen()
  },
  render () {
    if (!this.state.assetNavIsOpen) {
      return this.renderClosedContent();
    }
    window.setTimeout(()=>{
      this.activateSortable();
    }, 1);
    return (
        <bem.LibNav m={{
              shrunk: this.state.assetNavIsOpen
            }}>
          <bem.LibNav__header>
            <bem.LibNav__logo onClick={this.toggleOpen}>
              <i />
            </bem.LibNav__logo>
            <bem.LibNav__search>
              <ui.SmallInputBox ref="navigatorSearchBox" placeholder={t('search library')} onKeyUp={this.liveSearch} />
            </bem.LibNav__search>
            <TagList tags={this.state.tags} onTagClick={this.onTagClick} selected={this.state.selectedTags} />
          </bem.LibNav__header>
          <bem.LibNav__content>
            {this.renderSearchResults()}
          </bem.LibNav__content>
          <bem.LibNav__footer />
        </bem.LibNav>
      );
  }
});


var Icon = React.createClass({
  render () {
    var kls = classNames('fa', `fa-${this.props.fa}`, this.props.also);
    return (
      <i className={kls} />
      );
  }
})
class NavBarIcon extends React.Component {
  render () {
    var iconCls = classNames(`fa ${this.props.icon}`)
    return (
      <ul className='nav navbar-nav user'>
        <li className='item'>
          <i className={iconCls} title={this.props.title} />
        </li>
      </ul>
      );
  }
}

class Header extends React.Component {
  render () {
    var small;
    if (this.props.small) {
      small = <small>{this.props.small}</small>;
    }
    return (
      <div className="row">
        <div className="col-lg-12">
          <h3 className="page-header">{this.props.title} {small}</h3>
        </div>
      </div>
      );
  }
}

class StackedIcon extends React.Component {
  render () {
    var size = this.props.size || 'lg';
    var backIcon = this.props.backIcon || 'square';
    var frontIcon = this.props.frontIcon || 'file-o';
    return (
        <span className={classNames('fa-stack', `fa-${size}`, this.props.className)}>
          <i className={`fa fa-${backIcon} fa-stack-2x`}></i>
          <i className={`fa fa-${frontIcon} fa-stack-1x fa-inverse`}></i>
        </span>
      );
  }
}

var ActionLink = React.createClass({
  render () {
    return <bem.AssetRow__actionIcon {...this.props} />
  }
});

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
      evt.nativeEvent.preventDefault();
      evt.nativeEvent.stopImmediatePropagation();
      // this click was not intended for a button
      evt.preventDefault();
      stores.selectedAsset.toggleSelect(this.props.uid);
      this.props.onToggleSelect();
    }
  },
  preventDefault (evt) {
    evt.preventDefault();
  },
  render () {
    var selfowned = this.props.owner__username == this.props.currentUsername;
    var perm = this.props.perm;
    var isPublic = this.props.owner__username === anonUsername;
    var isCollection = this.props.kind === 'collection',
        hrefTo = isCollection ? 'collection-page' : 'form-landing',
        hrefKey = isCollection ? 'uid' : 'assetid',
        hrefParams = {};
    var isDeployable = !isCollection && this.props.asset_type && this.props.asset_type === 'survey';
    hrefParams[hrefKey] = this.props.uid;
    return (
        <bem.AssetRow m={{
                            'selected': this.props.isSelected,
                            'deleted': this.props.deleted,
                          }}
                        onClick={this.clickAsset}>
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
            <bem.AssetRow__tags>
              {
                this.props.tags.length > 0 ?
                  <i />
              :null}
              {this.props.tags.map((tag)=>{
                return <bem.AssetRow__tags__tag>{tag}</bem.AssetRow__tags__tag>
              })}
            </bem.AssetRow__tags>
          </bem.AssetRow__celllink>
          <bem.AssetRow__cell m={'date-modified'}>
            <span className="date date--modified">{formatTime(this.props.date_modified)}</span>
          </bem.AssetRow__cell>
          <bem.AssetRow__cell m={'userlink'}>
            <bem.AssetRow__sharingIcon
                href="#"
                m={{
                  'self-owned': selfowned,
                  'public-owned': isPublic,
                }}>
              <i />
              <bem.AssetRow__sharingIcon__owner>
                {this.props.owner__username}
              </bem.AssetRow__sharingIcon__owner>
            </bem.AssetRow__sharingIcon>
          </bem.AssetRow__cell>
          <bem.AssetRow__cell m={'action-icons'}>
            { this.props.kind === 'asset' &&
              ['view',
                    // 'edit', 'preview',
                    'download', 'clone', 'delete',
                    ].map((actn)=>{
                return (
                      <bem.AssetRow__actionIcon href="#"
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
              ['view', 'download', 'clone', 'delete'].map((actn)=>{
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
          </bem.AssetRow__cell>
          <bem.AssetRow__cell m={['deploy-button', isDeployable ? 'deployable':'disabled']}
                    data-action='deploy'
                    data-asset-type='asset'
                    data-kind='asset'
                    data-disabled={false}>
            { isDeployable ?
              <button>
                <i />
              </button>
            : null }
          </bem.AssetRow__cell>
        </bem.AssetRow>
      );
  }
})

var collectionAssetsStore = stores.collectionAssets;

function stringifyRoutes(contextRouter) {
  return JSON.stringify(contextRouter.getCurrentRoutes().map(function(r){
    return {
      name: r.name,
      href: r.path
    };
  }), null, 4)
}

class CloseButton extends React.Component {
  render () {
    return (
      <Link to={this.props.to}
            className={classNames('close-button', this.props.className)}
            onClick={this.props.onClick}
            title={this.props.title}>
        <i className='fa fa-times' />
      </Link>
      );
  }
}

class ButtonGroup extends React.Component {
  constructor () {
    super();
    this.state = {
      open: false
    };
  }
  toggleExpandGroup (evt) {
    evt.preventDefault();
    this.setState({open: !this.state.open});
  }
  render () {
    var icon = this.props.icon || false;
    var href = this.props.href || '#';
    var title = this.props.title;
    var links = this.props.links || [];
    var pullRight = this.props.pullRight;
    var disabled = false;

    var wrapClassnames = classNames('btn-group',
                                  pullRight ? 'pull-right' : '',
                                  this.state.open ? 'open' : ''
                                  );
    var mainClassnames = classNames('btn',
                                  'btn-default',
                                  disabled ? 'disabled' : ''
                                  );
    var caretClassnames = classNames('btn', 'btn-default', 'dropdown-toggle');

    var mainLink, openLink, iconEl;

    if (icon) {
      iconEl = <i className={classNames('fa', 'fa-lg', `fa-${icon}`)} />;
    }
    mainLink = <a href={href}
                  onClick={this.toggleExpandGroup.bind(this)}
                  className={mainClassnames}>{title}&nbsp;&nbsp;{iconEl}</a>;

    var action = this.props.action || 'view';
    if (links.length > 0) {
      openLink = (
        <a href="#" className={caretClassnames} onClick={this.toggleExpandGroup.bind(this)}><span className="caret" /></a>
      );
      links = (
          <ul className="dropdown-menu">
            {links.map((lnk, i)=> {
              var _key = lnk.code;
              return (<li key={_key}><a href={lnk.url}>{t(lnk.title || lnk.code)}</a></li>);
            })}
          </ul>
        );
    }

    return (
        <div className={wrapClassnames}>
          {mainLink}
          {openLink}
          {links}
        </div>
      );
  }
}

class DownloadButtons extends React.Component {
  render () {
    var title = 'there are no available downloads';
    var links = this.props.downloads.map((link) => {
      return assign({
        code: `download.${this.props.kind}.${link.format}`
      }, link);
    })
    return (
      <ButtonGroup href="#"
                    links={links}
                    kind={this.props.kind}
                    disabled={links.length === 0}
                    icon="cloud-download"
                    title={t('download')} />
      );
  }
}


class UserProfileLink extends React.Component {
  render () {
    var before, after, icon;
    if (this.props.icon) {
      icon = <i className={`fa fa-${this.props.icon}`} />
      if (this.props.iconBefore) {
        before = icon;
      } else {
        after = icon;
      }
    }
    return (
          <Link to="user-profile"
                className="user-profile-link"
                params={{username: this.props.username}}>
            {before}{this.props.username}{after}
          </Link>
    );
  }
}

class SharingButton extends React.Component {
  render () {
    return <div className="btn-group">
              <Link to="form-sharing" params={{assetid: this.props.uid}} className="btn btn-default">
                Sharing
                &nbsp;&nbsp;
                <i className='fa fa-lg fa-user-plus fa-user' />
              </Link>
            </div>;
  }
}

var UserPermDiv = React.createClass({
  mixins: [
    Navigation,
    mixins.permissions,
  ],
  renderPerm ([permName, permPermission, permissionObject]) {
    var btnCls = classNames('btn',
                            'btn-sm',
                            `perm-${permName}`,
                            'btn-block',
                            ({
                              "false": "btn-default",
                              "allow": "btn-primary",
                              "deny": "btn-danger"
                            })[permPermission]);

    var buttonAction;
    if (permissionObject) {
      buttonAction = this.removePerm(permName, permissionObject, this.props.uid);
    } else {
      buttonAction = this.setPerm(permName, this.props);
    }
    return (
        <div className='k-col-3-nopadd'>
          <button className={btnCls} onClick={buttonAction}>
            {permName}
          </button>
        </div>
      );
  },
  render () {
    var hasAnyPerms = false;
    var cans = this.props.can;
    var availPerms = ['view', 'change'].map((permName) => {
      if ( permName in cans ) {
        if (cans[permName].deny) {
          return [permName, "deny", cans[permName]];
        } else if (cans[permName]) {
          return [permName, "allow", cans[permName]];
        }
      }
      return [permName, "false"];
    });
    if (!this.props.username) {
      debugger;
    }
    return (
      <div className='row'>
        <div className='col-md-6'>
          <UserProfileLink icon={this.props.icon || 'user-o'} iconBefore='true' username={this.props.username} />
        </div>
        {availPerms.map(this.renderPerm)}
      </div>
      );
  }
});

class PublicPermDiv extends UserPermDiv {
  render () {
    var isOn = this.props.isOn;
    var btnCls = classNames('btn',
                            isOn ? 'btn-primary' : 'btn-default',
                            'btn-block');
    return (
      <div className='row'>
        <div className='col-md-12'>
          <button className={btnCls} onClick={this.props.onToggle}>
            <i className={`fa fa-group fa-lg`} />
            &nbsp;&nbsp;
            {isOn ?
              t('shared publicly') :
              t('not shared publicly')}
          </button>
        </div>
        <p className='col-md-12 text-muted text-center'>
          {isOn ?
            t('anyone with this link can view the survey') :
            t('this form is only viewable by the users listed above')}
        </p>
      </div>
      );
  }
}

class KoBo extends React.Component {
  render () {
    return (
        <span className='kobo'>
          <span className='ko'>Ko</span>
          <span className='bo'>Bo</span>
        </span>
      )
  }
}

var FormInput = React.createClass({
  render () {
    return (
        <div className="form-group">
          <label htmlFor={this.props.id} className="col-lg-2 control-label">{this.props.label}</label>
          <div className="col-lg-10">
            <input type="text" className="form-control" id={this.props.id} placeholder={this.props.placeholder}
                  onChange={this.props.onChange} />
          </div>
        </div>
      );
  }
});

var FormCheckbox = React.createClass({
  render () {
    return (
        <div className="form-group">
          <label htmlFor={this.props.name} className="col-lg-8 control-label">{this.props.label}</label>
          <div className="col-lg-4">
            <div className="checkbox">
              <label>
                <input type="checkbox" id={this.props.name} checked={this.props.value} onChange={this.props.onChange} />
              </label>
            </div>
          </div>
        </div>
      );
  }
})

var FormSettingsEditor = React.createClass({
  render () {
    return (
      <div className="well">
        <form className="form-horizontal">
          <FormInput id="form_id" label="form id" value={this.props.form_id} placeholder={t('form id')} onChange={this.props.onFieldChange} />
          <hr />
          <div className="row">
            <div className="col-md-6">
              {this.props.meta.map((mtype) => {
                return <FormCheckbox htmlFor={mtype} onChange={this.props.onCheckboxChange} {...mtype} />
              })}
            </div>
            <div className="col-md-6">
              {this.props.phoneMeta.map((mtype) => {
                return <FormCheckbox htmlFor={mtype} onChange={this.props.onCheckboxChange} {...mtype} />
              })}
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="select" className="col-lg-2 control-label">{t('form style')}</label>
            <div className="col-lg-10">
              <select className="form-control" onChange={this.props.onStyleChange} value={this.props.styleValue}>
                <option value=''>{t('-none-')}</option>
                <option value='field-list'>{t('field-list')}</option>
              </select>
            </div>
          </div>
        </form>
      </div>
      );
  }
})

var FormSettingsBox = React.createClass({
  getInitialState () {
    var formId = this.props.survey.settings.get('form_id');
    return {
      formSettingsExpanded: false,
      xform_id_string: formId,
      meta: [],
      phoneMeta: [],
      styleValue: 'field-list'
    }
  },
  getSurveyDetail (sdId) {
    return this.props.survey.surveyDetails.filter(function(sd){
      return sd.attributes.name === sdId;
    })[0];
  },
  passValueIntoObj (category, newState) {
    newState[category] = [];
    return (id) => {
      var sd = this.getSurveyDetail(id);
      if (!sd) {
        console.error('could not find ', id);
      } else {
        newState[category].push(assign({}, sd.attributes));
      }
    };
  },
  onCheckboxChange (evt) {
    this.getSurveyDetail(evt.target.id).set('value', evt.target.checked);
    this.updateState();
  },
  onFieldChange (evt) {
    var fieldId = evt.target.id,
        value = evt.target.value;
    if (fieldId === 'form_id') {
      this.props.survey.settings.set('form_id', value);
    }
    this.setState({
      xform_id_string: this.props.survey.settings.get('form_id')
    })
  },
  updateState () {
    var newState = {};
    "start end today deviceid".split(" ").forEach(this.passValueIntoObj('meta', newState));
    "username simserial subscriberid phonenumber".split(" ").map(this.passValueIntoObj('phoneMeta', newState));
    this.setState(newState);
  },
  componentDidMount () {
    this.updateState();
  },
  toggleSettingsEdit () {
    this.setState({
      formSettingsExpanded: !this.state.formSettingsExpanded
    });
  },
  onStyleChange (evt) {
    var newStyle = evt.target.value;
    this.props.survey.settings.set('style', newStyle);
    this.setState({
      styleValue: newStyle
    });
  },
  render () {
    var metaData = [].concat(this.state.meta).concat(this.state.phoneMeta).filter(function(item, a, b, c){
      return item.value;
    }).map(function(item){ return item.label; }).join(', ');

    if (metaData === '') {
      metaData = t('none (0 metadata specified)')
    }
    var expandIconKls = classNames('fa', 'fa-icon', 'fa-fw', 
            this.state.formSettingsExpanded ? 'fa-caret-down' : 'fa-caret-right')

    return (
        <div className={classNames('row', 'k-sub-settings-bar', {
          'k-sub-settings-bar--expanded': this.state.formSettingsExpanded
        })}>
          <div className="col-md-12" onClick={this.toggleSettingsEdit}>
            <i className="fa fa-cog" />
            &nbsp;&nbsp;
            <i className={expandIconKls} />
            &nbsp;&nbsp;
            <span className="settings-preview">{t('form id')}: {this.state.xform_id_string}</span>
            <span className="settings-preview">{t('meta questions')}: {metaData}</span>
          </div>
          {this.state.formSettingsExpanded ?
            <FormSettingsEditor {...this.state} onCheckboxChange={this.onCheckboxChange}
                onFieldChange={this.onFieldChange}
                onStyleChange={this.onStyleChange}
                styleValue={this.state.styleValue}
                />
          :null}
        </div>

      );
  }
})




function surveyToValidJson(survey) {
  var surveyDict = survey.toFlatJSON();
  if ('settings' in surveyDict) {
    log('has settings');
  } else {
    log('no settings');
  }
  return JSON.stringify(surveyDict);
}


/* Routes:
*/
var App = React.createClass({
  mixins: [
    Reflux.ListenerMixin,
    Navigation
  ],
  getInitialState () {
    return assign({}, stores.pageState.state, {
      sidebarIsOpen: !this.widthLessThanMin()
    })
  },
  widthLessThanMin () {
    return window.innerWidth < 560;
  },
  handleResize () {
    if (this.widthLessThanMin()) {
      stores.pageState.hideSidebar();
    } else if (this.state.sidebarIntentOpen && !this.state.sidebarIsOpen) {
      stores.pageState.showSidebar();
    }
  },
  pageStateChange (state) {
    this.setState(state);
  },
  componentDidMount () {
    this.listenTo(stores.pageState, this.pageStateChange)

    // can use window.matchMedia(...) here
    window.addEventListener('resize', this.handleResize);
  },
  componentWillUnmount () {
    window.removeEventListener('resize', this.handleResize);
  },

  toggleSidebarIntentOpen (evt) {
    evt.preventDefault();
    stores.pageState.toggleSidebarIntentOpen();
  },

  render() {
    return (
      <DocumentTitle title="KoBo">
        <bem.PageWrapper m={{
            'activenav': this.state.sidebarIsOpen,
            'asset-nav-present': this.state.assetNavPresent,
            'asset-nav-open': this.state.assetNavIsOpen && this.state.assetNavPresent,
            'header-search': this.state.headerSearch,
              }}>
          <Sidebar isOpen={this.state.sidebarIsOpen} toggleIntentOpen={this.toggleSidebarIntentOpen} />
          <bem.PageWrapper__content m={{
            'navigator-open': this.state.assetNavigatorIsOpen,
            'navigator-present': this.state.assetNavigator,
              }}>
            {/*
            <BgTopPanel {...this.state} />
            */}
            <RouteHandler appstate={this.state} />
          </bem.PageWrapper__content>
          { this.state.assetNavPresent ? 
            <AssetNavigator />
          :null}
        </bem.PageWrapper>
      );
  },
  
  renderNonLoggedinContent () {
    return (
        <div className="registration__bg">
          <form method="post" action="." className="registration registration--login">
            <div className="registration--logo">
              <a href="/">
                <img src="/static/kobo/images/kobologo.svg" />
              </a>
            </div>    
            <p>
              <label for="id_username" className="hidden">Username:</label>
              <input id="id_username" maxlength="254" name="username" type="text" placeholder="Username" />
            </p>
            <p>
              <label for="id_password" className="hidden">Password:</label>
              <input id="id_password" name="password" type="password" placeholder="Password" />
            </p>
            <a href="/accounts/password/reset/" className="registration__forgot">Forgot?</a>
            <input type="submit" value="Login" className="registration__action" />
            <input type="hidden" name="next" value="/" />
            <div className="registration__footer">
              or <a href="/accounts/register/">create an account</a>
            </div>
          </form>
          <div className="registration__credit">
            <a href="https://flic.kr/p/9v4mC5" title="Muhkjar refugee camp" target="_blank">Photo</a>
            <span>by UNAMID /</span>
            <a href="https://creativecommons.org/licenses/by-nc-nd/2.0/" target="_blank">by-nc-nd</a>
          </div>
        </div>
      );
  },

  render() {
    // towards #42
    var isLoggedIn = true;
    return (
      <DocumentTitle title="KoBoToolbox">
        {
          isLoggedIn ?
          this.renderLoggedinContent()
          :
          this.renderNonLoggedinContent()
        }
      </DocumentTitle>
    );
  }
});

// intended to provide a component we can export to html
var Loading = React.createClass({
  render () {
    var loadingImage = 'path/to/img.jpg'
    return (
        <bem.Loading>
          <bem.Loading__message>
            {t('loading kobotoolbox')}
          </bem.Loading__message>
          <bem.Loading__img src={loadingImage} />
        </bem.Loading>
      );
  }
})

var Forms = React.createClass({
  mixins: [
    Navigation
  ],
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      if (params.assetid && params.assetid[0]==='c') {
        transition.redirect("collection-page", {
          uid: params.assetid
        });
      }
      callback();
    }
  },
  render () {
    return <RouteHandler />;
  }
});

class SurveyScope {
  constructor ({survey}) {
    this.survey = survey;
  }
  add_row_to_question_library (row) {
    if (row.constructor.kls === 'Row') {
      actions.resources.createAsset({
        content: JSON.stringify({
          survey: [
            row.toJSON2()
          ]
        })
      });
    } else {
      console.error('cannot add group to question library');
    }
  }
  handleItem({position, itemData}) {
    actions.survey.addItemAtPosition({position: position, uid: itemData.uid, survey: this.survey});
  }
}

var NewForm = React.createClass({
  mixins: [
    Navigation,
    mixins.formView,
    Reflux.ListenerMixin,
  ],
  renderFormNameInput () {
    var nameKls = this.state.survey_name_valid ? '' : 'has-warning';
    var nameInputKls = classNames('form-control',
                                  'input-lg',
                                  nameKls);
    return (
        <input ref="form-name"
                className={nameInputKls}
                type="text"
                onChange={this.nameInputChange}
                placeholder={t('form name')}
              />
      );
  },
  renderSaveAndPreviewButtons () {
    var disabled = !!this.state.disabled;
    var saveText = t('create');
    var saveBtnKls = classNames('btn','btn-default',
                              disabled ? 'disabled' : '');
    var previewDisabled = !!this.state.previewDisabled;
    var previewBtnKls = classNames('btn',
                                  'btn-default',
                                  previewDisabled ? 'disabled': '')
    return (
          <div className="k-form-actions">
            <div className='btn-toolbar'>
              <div className='btn-group btn-group-justified'>
                <a href="#" className={saveBtnKls} onClick={this.saveNewForm}>
                  <i className={classNames('fa', 'fa-sm', 'fa-save')} />
                  &nbsp;
                  &nbsp;
                  {saveText}
                </a>
              </div>
            </div>
          </div>
        );
  },
  saveNewForm (evt) {
    evt.preventDefault();
    var sc;
    var chgs = {
      name: this.refs['form-name'].getDOMNode().value
    };
    try {
      chgs.content = surveyToValidJson(this.state.survey);
    } catch (e) {
      log('cannot save survey', e);
    }
    actions.resources.createResource(chgs);
  },
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      stores.pageState.setHeaderSearch(false);
      stores.pageState.setTopPanel(30, false);
      callback();
    }
  },
  getInitialState () {
    return {};
  },
  creatingResource () {
    this.setState({
      disabled: true
    });
  },
  creatingResourceCompleted (data) {
    this.transitionTo('form-edit', { assetid: data.uid });
  },
  componentDidMount () {
    actions.resources.createResource.listen(this.creatingResource);
    actions.resources.createResource.completed.listen(this.creatingResourceCompleted);
    var survey = dkobo_xlform.model.Survey.create();
    var skp = new SurveyScope({survey: survey});
    var app = new dkobo_xlform.view.SurveyApp({
      survey: survey,
      ngScope: skp,
    });
    $('.form-wrap').html(app.$el);
    app.render()
    this.app = app
    this.setState({
      survey: survey
    });
  },
  render () {
    return (
        <DocumentTitle title={t('new form')}>
          {this.innerRender()}
        </DocumentTitle>
      );
  }
});

var CollectionList = React.createClass({
  mixins: [
    mixins.collection,
    Navigation,
    Reflux.ListenerMixin,
  ],
  addListeners () {
    this.listenTo(stores.collectionAssets, this.listenChange);
  },
  listenChange (data) {
    log('listen change', data);
  },
  initialAction () {
    actions.resources.readCollection({uid: this.props.params.uid});
  },
  dropAction ({file, event}) {
    actions.resources.createAsset({
      base64Encoded: event.target.result,
      filename: file.name,
      lastModified: file.lastModified,
      contentType: file.type
    });
  },
  _title () {
    return t('KoBo collection view');
  },
  _loadingMessage () {
    return t('loading forms...');
  },
  _renderFormsSearchRow () {
    var parentLinks = [
      <Link to="forms" className="btn btn-sm btn-default">{t('forms')}</Link>
    ];
    if (this.state.collection) {
      return (
          <p>
            {parentLinks}
            &raquo;
            {t(`collection view: ${this.state.collection.name}`)}
          </p>
        )
    } else {
      return t('collection view');
    }
  }
});

var FormDownload = React.createClass({
  mixins: [
    Navigation,
    Reflux.ListenerMixin
  ],
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      actions.resources.loadAsset({id: params.assetid});
      callback();
    }
  },
  componentDidMount () {
    this.listenTo(assetStore, this.assetStoreTriggered)
  },
  getInitialState () {
    return {
      downloads: []
    };
  },
  assetStoreTriggered (data, uid, stateUpdates) {
    this.setState({
      downloads: data[uid].downloads
    })
  },
  render () {
    return (
        <ui.Panel>
          <ul>
            {
              this.state.downloads.map(function(item){
                return (
                    <li>
                      <a href={item.url}>
                        {t(`download-format-${item.format}`)}
                      </a>
                    </li>
                  );
              })
            }
          </ul>
        </ui.Panel>
      );
  }
});

var FormJson = React.createClass({
  mixins: [
    Navigation,
    Reflux.ListenerMixin
  ],
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      actions.resources.loadAsset({id: params.assetid});
      callback();
    }
  },
  componentDidMount () {
    this.listenTo(assetStore, this.assetStoreTriggered)
  },
  assetStoreTriggered (data, uid, stateUpdates) {
    this.setState({
      assetcontent: data[uid].content
    })
  },
  getInitialState () {
    return {
      assetcontent: false
    }
  },
  render () {
    return (
        <ui.Panel>
          <pre>
            <code>
              {this.state.assetcontent ? 
                JSON.stringify(this.state.assetcontent, null, 4)
              :null}
            </code>
          </pre>
        </ui.Panel>
      );
  }
})


var FormSharing = React.createClass({
  mixins: [
    Navigation,
    Reflux.connectFilter(assetStore, function(data){
      var uid = this.props.params.assetid,
        asset = data[uid];
      if (asset) {
        return {
          asset: asset,
          permissions: asset.permissions,
          owner: asset.owner__username,
          pperms: parsePermissions(asset.owner__username, asset.permissions),
          public_permission: getAnonymousUserPermission(asset.permissions),
          related_users: assetStore.relatedUsers[uid]
        };
      }
    }),
    mixins.permissions,
    Reflux.ListenerMixin
  ],

  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      actions.resources.loadAsset({id: params.assetid});
      callback();
    }
  },
  componentDidMount () {
    this.listenTo(stores.userExists, this.userExistsStoreChange);
  },
  routeBack () {
    var params = this.context.router.getCurrentParams();
    this.transitionTo('form-landing', {assetid: params.assetid});
  },
  userExistsStoreChange (checked, result) {
    var inpVal = this.usernameFieldValue();
    if (inpVal === result) {
      var newStatus = checked[result] ? 'success' : 'error';
      this.setState({
        userInputStatus: newStatus
      })
    }
  },
  usernameField () {
    return this.refs.usernameInput.refs.inp.getDOMNode();
  },
  usernameFieldValue () {
    return this.usernameField().value;
  },
  usernameCheck (evt) {
    var username = evt.target.value;
    if (username && username.length > 3) {
      var result = stores.userExists.checkUsername(username);
      if (result === undefined) {
        actions.misc.checkUsername(username);
      } else {
        log(result ? 'success' : 'error');
        this.setState({
          userInputStatus: result ? 'success' : 'error'
        });
      }
    } else {
      this.setState({
        userInputStatus: false
      })
    }
  },
  getInitialState () {
    return {
      userInputStatus: false
    }
  },
  addInitialUserPermission (evt) {
    evt.preventDefault();
    var username = this.usernameFieldValue();
    if (stores.userExists.checkUsername(username)) {
      actions.permissions.assignPerm({
        username: username,
        uid: this.props.params.assetid,
        kind: this.state.asset.kind,
        objectUrl: this.props.objectUrl,
        role: 'view'
      });
      this.usernameField().value="";
    }
  },
  render () {
    var sharedUsers = [];
    var inpStatus = this.state.userInputStatus;
    if (!this.state.pperms) {
      return <i className="fa fa-spin" />;
    }
    var _perms = this.state.pperms;
    var perms = this.state.related_users.map(function(username){
      var currentPerm = _perms.filter(function(p){ return p.username === username })[0];
      if (currentPerm) {
        return currentPerm;
      } else {
        return {
          username: username,
          can: {}
        }
      }
    });
    var userInputKls = classNames('form-group',
                                    (inpStatus !== false) ? `has-${inpStatus}` : '');
    var btnKls = classNames('btn',
                            'btn-block',
                            'btn-sm',
                            inpStatus === 'success' ? 'btn-success' : 'hidden');

    var uid = this.state.asset.uid;
    var kind = this.state.asset.kind;
    var objectUrl = this.state.asset.url;

    if (!perms) {
      return <p>loading</p>
    }
    return (
      <ui.Modal open onClose={this.routeBack} title={this.state.asset.name}
                  small={t('manage sharing permissions')}
                  label={t('note: this does not control permissions to the data collected by projects')}>
        <ui.Modal.Body>
          <ui.Panel className="k-div--sharing">
            {t('owner')}
            &nbsp;
            <StackedIcon frontIcon='user' />
            &nbsp;
            <UserProfileLink username={this.state.asset.owner__username} />
          </ui.Panel>
          <ui.Panel className="k-div--sharing2">
            <form onSubmit={this.addInitialUserPermission}>
              <div className='col-sm-9'>
                <div className={userInputKls}>
                  <ui.SmallInputBox ref='usernameInput' placeholder={t('share with username')} onKeyUp={this.usernameCheck} />
                </div>
              </div>
              <div className='col-sm-3'>
                <button className={btnKls}>
                  <i className="fa fa-fw fa-lg fa-plus" />
                </button>
              </div>
            </form>
            <br />
            <br />
            <div>
              {perms.map((perm)=> {
                return <UserPermDiv key={`perm.${uid}.${perm.username}`} ref={perm.username} uid={uid} kind={kind} objectUrl={objectUrl} {...perm} />;
              })}
            </div>
          </ui.Panel>
          <div className='row'>
            {(() => {
              if (this.state.public_permission) {
                return <PublicPermDiv isOn={true}
                            onToggle={this.removePerm('view',
                                              this.state.public_permission,
                                              uid)}
                            />
              } else {
                return <PublicPermDiv isOn={false}
                            onToggle={this.setPerm('view', {
                                username: anonUsername,
                                uid: uid,
                                kind: kind,
                                objectUrl: objectUrl
                              }
                            )}
                            />
              }
            })()}
          </div>
        </ui.Modal.Body>
      </ui.Modal>
      );
  }
});

var FormEnketoPreview = React.createClass({
  mixins: [
    Navigation,
    Reflux.ListenerMixin,
  ],
  componentDidMount () {
    var uid = this.props.params.assetid;
    stores.allAssets.whenLoaded(uid, function(asset){
      actions.resources.createSnapshot({
        asset: asset.url,
      });
    })
    this.listenTo(stores.snapshots, this.snapshotCreated);
  },
  getInitialState () {
    return {
      enketopreviewlink: false,
      message: t('loading...'),
      error: false
    }
  },
  snapshotCreated (snapshot) {
    var uid = this.props.params.assetid;
    this.setState({
      enketopreviewlink: snapshot.enketopreviewlink
    })
  },
  routeBack () {
    var params = this.context.router.getCurrentParams();
    this.transitionTo('form-landing', {assetid: params.assetid});
  },
  renderEnketoPreviewIframe () {
    return (
        <div className='enketo-holder'><iframe src={this.state.enketopreviewlink} /></div>
      );
  },
  renderPlaceholder () {
    return (
        <div className='row'>
          <div className='cutout-placeholder'>
            <span className={classNames({
                  'k-preview-message': true,
                  'k-preview-error-message': this.state.error
                })}>
              {this.state.message}
            </span>
          </div>
        </div>
      );
  },
  render () {
    return (
      <ui.Modal open onClose={this.routeBack} title={t('enketo preview')}>
        <ui.Modal.Body>
          { this.state.enketopreviewlink ? 
              this.renderEnketoPreviewIframe() :
              this.renderPlaceholder()
          }
        </ui.Modal.Body>
        <ui.Modal.Footer>
          <button type="button"
                    className="btn btn-default"
                    data-dismiss="modal"
                    onClick={this.routeBack}>
            {t('done')}
          </button>
        </ui.Modal.Footer>
      </ui.Modal>
    );
  }
});

var FormPage = React.createClass({
  mixins: [
    Navigation,
    mixins.formView,
    // Reflux.connectFilter(assetStore, 'asset', function(data){
    //   return data[this.props.params.assetid];
    // }),
    Reflux.ListenerMixin,
  ],
  getNameValue () {
    return this.refs['form-name'].getDOMNode().value
  },
  saveForm (evt) {
    evt.preventDefault();
    actions.resources.updateAsset(this.props.params.assetid, {
      name: this.getNameValue(),
      content: surveyToValidJson(this.state.survey)
    });
    this.setState({
      asset_updated: false
    })
  },
  onSurveyChange () {
    this.setState({
      asset_updated: -1
    });
  },
  renderSaveAndPreviewButtons () {
    var disabled = !!this.state.disabled;
    var pendingSave = this.state.asset_updated === false;
    var saveText = t('save');
    var saveBtnKls = classNames('btn','btn-default', {
      'disabled': disabled,
      'k-save': true,
      'k-save--pending': this.state.asset_updated === false,
      'k-save--complete': this.state.asset_updated === true,
      'k-save--needed': this.state.asset_updated === -1
    });
    var previewDisabled = !!this.state.previewDisabled;
    var previewBtnKls = classNames('btn',
                                  'btn-default',
                                  previewDisabled ? 'disabled': '')
    return (
        <div className="k-form-actions">
          <div className='btn-toolbar'>
            <a href="#" className={saveBtnKls} onClick={this.saveForm}>
              <i className={classNames('fa', 'fa-sm', 'fa-save')} />
              &nbsp;
              &nbsp;
              {saveText}
            </a>
          </div>
        </div>
      );
  },
  getInitialState () {
    return {
      survey_loaded: false,
      survey_name: '',
      kind: 'asset',
      asset: false
    };
  },
  renderFormNameInput () {
    var nameKls = this.state.survey_name_valid ? '' : 'has-warning';
    var nameInputKls = classNames('form-control',
                                  'input-lg',
                                  nameKls);
    var nameVal = this.state.survey_name;
    return (
        <input ref="form-name"
                className={nameInputKls}
                type="text"
                value={nameVal}
                onChange={this.nameInputChange}
                placeholder={t('form name')}
              />
      );
  },
  assetStoreTriggered (data, uid, stateUpdates) {
    var s = data[uid],
      survey,
      content,
      updates = {};
    if (stateUpdates) {
      assign(updates, stateUpdates);
    }
    if (s) {
      content = s.content;

      if (content) {
        survey = dkobo_xlform.model.Survey.loadDict(content);
        if (s.survey_name) {
          survey.settings.set('form_title', this.state.survey_name);
        }
        window.setTimeout(( () => {
          survey.settings.on('change', this.onSurveyChange);
          survey.rows.on('change', this.onSurveyChange);
          survey.rows.on('sort', this.onSurveyChange);
        } ), 500);
        assign(updates, {
          survey: survey,
          survey_loaded: true,
          xform_id_string: survey.settings.get('form_id')
        });
      }
      assign(updates, {
        survey_name: s.name,
        asset: s
      });
      this.setState(updates);
    }
  },
  componentDidMount () {
    this.navigateBack = ()=> {
      if (this.needsSave() && confirm(t('you have unsaved changes. would you like to save?'))) {
        this._saveForm();
      }
      this.transitionTo('form-landing', {assetid: this.props.params.assetid});
    }

    this.listenTo(assetStore, this.assetStoreTriggered)
    stores.pageState.setTopPanel(30, false);
    this._postLoadRenderMounted = false;
  },
  surveyChange (a,b,c) {
    log('survey change' ,a ,b,c)
  },
  componentWillUnmount () {
    if (this.state.survey) {
      this.state.survey.off('change');
    }
  },
  postLoadRenderMount () {
    this._postLoadRenderMounted = true;
    this.state.survey.settings.set('form_title', this.state.asset.name);
    var skp = new SurveyScope({survey: this.state.survey});
    this.app = new dkobo_xlform.view.SurveyApp({
      survey: this.state.survey,
      ngScope: skp,
    });
    var fw = this.refs['form-wrap'].getDOMNode();
    this.app.$el.appendTo(fw);
    this.app.render();
  },
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {

      stores.pageState.setHeaderSearch(false);
      stores.pageState.setTopPanel(30, false);
      if (params.assetid[0] === 'c') {
        transition.redirect('collection-page', {uid: params.assetid});
      } else {
        actions.resources.loadAsset({id: params.assetid});
        // actions.resources.loadAssetContent({id: params.assetid});
        callback();
      }
    }
  },
  render () {
    if (this.state.asset) {
      if (!this._postLoadRenderMounted && this.state.survey_loaded) {
        // wish we didnt have to do this...
        window.setTimeout(this.postLoadRenderMount, 100);
      }
      return (
          <DocumentTitle title={this.state.survey_name}>
            {this.innerRender()}
          </DocumentTitle>
        );
    }
    return (
        <div>
          {this.loadingNotice()}
          <RouteHandler />
        </div>
      );
  }
});

var FormLanding = React.createClass({
  mixins: [
    Navigation,
    mixins.droppable,
    mixins.taggedAsset,
    mixins.dmix,
    mixins.ancestorBreadcrumb,
    Reflux.ListenerMixin
  ],
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      stores.pageState.setHeaderSearch(true);
      stores.pageState.setTopPanel(30, false);
      actions.resources.loadAsset({id: params.assetid});
      // actions.resources.loadAssetContent({id: params.assetid});
      callback();
    }
  },
  render () {
    return this._createPanel()
  }
});

// var FormLandingx = React.createClass({
//   mixins: [
//     Navigation,
//     mixins.formView,
//     Reflux.ListenerMixin,
//   ],
//   renderSaveAndPreviewButtons () {
//     return;
//   },
//   renderSubTitle () {
//     var disabled = !!this.state.disabled;
//     var pendingSave = this.state.asset_updated === false;
//     var saveText = t('save');
//     var saveBtnKls = classNames('btn','btn-default', {
//       'disabled': disabled,
//       'k-save': true,
//       'k-save--pending': this.state.asset_updated === false,
//       'k-save--complete': this.state.asset_updated === true,
//       'k-save--needed': this.state.asset_updated === -1
//     });
//     var previewDisabled = !!this.state.previewDisabled;
//     var previewBtnKls = classNames('btn',
//                                   'btn-default',
//                                   previewDisabled ? 'disabled': '')
//     var downloadLink, xlsLink;

//     if (this.state.asset && this.state.asset.downloads) {
//       xlsLink = this.state.asset.downloads.filter((f)=>f.format==="xls")[0]
//       downloadLink = <a href={xlsLink.url} className={saveBtnKls}>{t('xls')}</a>
//     }
//     return (
//       <div className="row">
//       <div className="col-md-12">
//         <div className="k-form-actions" style={{marginLeft:-10}}>
//           <div className='btn-toolbar'>
//             <div className='btn-group'>
//               <Link to='form-edit' params={{assetid: this.props.params.assetid}} className={saveBtnKls}>
//                 <i className={classNames('fa', 'fa-fw', 'fa-sm', 'fa-pencil')} />
//               </Link>
//               <Link to="form-preview-enketo" params={{assetid: this.props.params.assetid}} className={saveBtnKls}>
//                 <i className={classNames('fa', 'fa-fw', 'fa-sm', 'fa-eye')} />
//               </Link>
//               {downloadLink}
//               <SharingButton uid={this.props.params.assetid}>
//                 {t('sharing')}
//               </SharingButton>
//             </div>
//           </div>
//         </div>
//       </div>
//       </div>
//       );
//   },
//   getInitialState () {
//     return {
//       survey_loaded: false,
//       survey_name: '',
//       kind: 'asset',
//       asset: false
//     };
//   },
//   renderFormNameInput () {
//     var nameVal = this.state.survey_name;
//     return <p>{nameVal}</p>;
//   },
//   assetStoreTriggered (data, uid, stateUpdates) {
//     var s = data[uid],
//       survey,
//       updates = {};
//     if (stateUpdates) {
//       assign(updates, stateUpdates);
//     }
//     if (s) {
//       assign(updates, {
//         survey_name: s.name,
//         asset: s
//       });
//       this.setState(updates);
//     }
//   },
//   assetContentStoreTriggered (data, uid) {
//     var s = data[uid],
//       survey;
//     if (s) {
//       this.setState({
//         survey_data: s.data,
//         survey_loaded: true
//       });
//     }
//   },
//   componentDidMount () {
//     this.listenTo(assetStore, this.assetStoreTriggered)
//     this.listenTo(assetContentStore, this.assetContentStoreTriggered);
//     stores.pageState.setTopPanel(30, false);
//   },
//   statics: {
//     willTransitionTo: function(transition, params, idk, callback) {
//       stores.pageState.setHeaderSearch(true);
//       stores.pageState.setTopPanel(30, false);
//       actions.resources.loadAsset({id: params.assetid});
//       actions.resources.loadAssetContent({id: params.assetid});
//       callback();
//     }
//   },
//   render () {
//     if (this.state.asset) {
//       return (
//           <DocumentTitle title={this.state.survey_name}>
//             {this.innerRender()}
//           </DocumentTitle>
//         );
//     }
//     return (
//         <div>
//           {this.loadingNotice()}
//           <RouteHandler />
//         </div>
//       );
//   }
// });

var LibraryList = React.createClass({
  mixins: [
    mixins.droppable,
    Navigation,
    mixins.collection,
    Reflux.ListenerMixin,
  ],
  addListeners () {
    this.listenTo(stores.allAssets, this.allAssetsChange);
  },
  allAssetsChange () {
    this.setState({
      list: stores.allAssets.byAssetType(['block', 'question'])
    })
  },
  initialAction () {
    actions.resources.listAssets();
  },
  dropAction ({file, event}) {
    actions.resources.createAsset({
      base64Encoded: event.target.result,
      name: file.name,
      lastModified: file.lastModified,
      contentType: file.type
    });
  },
  _title () {
    return 'Library'
  },
  searchChange () {

  },
  _renderSearchCriteria () {
    return;
  },
  _renderFormsSearchRow () {
    return (
      <bem.CollectionNav>
        <bem.CollectionNav__search className="col-sm-4 k-form-list-search-bar">
          <ui.SmallInputBox ref="formlist-search" placeholder={t('search drafts')} onChange={this.searchChange} />
        </bem.CollectionNav__search>
        {this._renderSearchCriteria()}
        <bem.CollectionNav__actions className="col-sm-2 col-sm-offset-6 k-form-list-search-bar">
          <bem.CollectionNav__link m={['new', 'new-block']} ref={this.makeHref('new-form')}>
            <i />
            {t('add to library')}
          </bem.CollectionNav__link>
          <Dropzone onDropFiles={this.dropFiles} params={{destination: false}} fileInput>
            <bem.CollectionNav__button m={['upload', 'upload-block']} className="btn btn-default btn-block btn-sm">
              <i className='fa fa-icon fa-cloud fa-fw' />
              &nbsp;&nbsp;
              {t('upload')}
            </bem.CollectionNav__button>
          </Dropzone>
        </bem.CollectionNav__actions>
      </bem.CollectionNav>
      );
  },
  _loadingMessage () {
    return t('loading library...')
  },
});

var FormList = React.createClass({
  mixins: [
    mixins.droppable,
    Navigation,
    mixins.collection,
    Reflux.ListenerMixin,
  ],
  addListeners () {
    this.listenTo(stores.allAssets, this.listenChange);
  },
  listenChange (data) {
    this.setState({
      list: stores.allAssets.byAssetType('survey')
    })
  },
  initialAction () {
    actions.resources.listAssets();
  },
  dropAction ({file, event}) {
    actions.resources.createAsset({
      base64Encoded: event.target.result,
      name: file.name,
      lastModified: file.lastModified,
      contentType: file.type
    });
  },
  searchCriteriaChange (evt) {
    this.setState({
      searchRadio: 'type'+(Math.floor(Math.random()*3))
    })
  },
  _title () {
    return t('KoBo form drafts');
  },
  _loadingMessage () {
    return t('loading forms...')
  },
  _renderSearchCriteria () {
    return (
      <bem.CollectionNav__searchcriteria>
      </bem.CollectionNav__searchcriteria>
      );
    /*
    return (
        <bem.CollectionNav__searchcriteria className="col-sm-6 k-form-list-search-bar">
          <label>
            <input type="radio" name="formlist__search__type" id="formlist__search__type--1" value="type1" checked={this.state.searchRadio==='type1'} onChange={this.searchCriteriaChange} />
            {t('my forms')}
          </label>
          <label>
            <input type="radio" name="formlist__search__type" id="formlist__search__type--2" value="type2" checked={this.state.searchRadio==='type2'} onChange={this.searchCriteriaChange} />
            {t('shared with me')}
          </label>
          <label>
            <input type="radio" name="formlist__search__type" id="formlist__search__type--3" value="type3" checked={this.state.searchRadio==='type3'} onChange={this.searchCriteriaChange} />
            {t('public')}
          </label>
          <div className="btn-group hidden">
            <a href="#" className="btn btn-default dropdown-toggle" data-toggle="dropdown">
              {t('type')}
              <span className="caret"></span>
            </a>
            <ul className="dropdown-menu">
              <li><a href="#"><Icon fa='file-o' />forms</a></li>
              <li><a href="#"><Icon fa='file-o' />blocks</a></li>
              <li><a href="#"><Icon fa='file-o' />questions</a></li>
              <li><a href="#"><Icon fa='folder-o' />collection</a></li>
             </ul>
          </div>
        </bem.CollectionNav__searchcriteria>
      );
    */
  },
  _renderFormsSearchRow () {
    return (
      <bem.CollectionNav>
        <bem.CollectionNav__search className="col-sm-4 k-form-list-search-bar">
          <ui.SmallInputBox ref="formlist-search" placeholder={t('search drafts')} onChange={this.searchChange} />
        </bem.CollectionNav__search>
        {this._renderSearchCriteria()}
        <bem.CollectionNav__actions className="col-sm-offset-6">
          <bem.CollectionNav__link href={this.makeHref('new-form')}>
            <i />
            {t('new form')}
          </bem.CollectionNav__link>
          <Dropzone onDropFiles={this.dropFiles} params={{destination: false}} fileInput>
            <bem.CollectionNav__button m={'upload'}>
              <i />
              {t('upload')}
            </bem.CollectionNav__button>
          </Dropzone>
        </bem.CollectionNav__actions>
      </bem.CollectionNav>
    );
  }
});

var FormNotFound = React.createClass({
  render () {
    return (
        <ui.Panel>
          {t('path not found / recognized')}
        </ui.Panel>
      )
  }
});

var UserList = React.createClass({
  render () {
    return (
        <ui.Panel className="k-div--userlist">
          <h1>{t('users')}</h1>
        </ui.Panel>
      );
  }
});

var UserProfile = React.createClass({
  render () {
    var username = this.props.username;
    return (
        <ui.Panel className="k-div--userprofile">
          <h1>{t('user')}: {username}</h1>
          <hr />
          <div className="well">
            <h3 className="page-header">
              {t('my forms shared with user')}
            </h3>
            <div className="well-content">
              <p>There are no forms shared with this user?</p>
            </div>
          </div>

          <div className="well">
            <h3 className="page-header">
              {t('public forms')}
            </h3>
            <div className="well-content">
              <p>This user has no public forms</p>
            </div>
          </div>

        </ui.Panel>
      );
  }
});

var Public = React.createClass({
  render () {
    return (
      <div>
        <p>Public</p>
      </div>
      );
  }
});

var Builder = React.createClass({
  mixins: [Navigation],
  render () {
    var _routes = stringifyRoutes(this.context.router);
    return (
      <ui.Panel className="k-div--builder">
        <h1 className="page-header">Builder</h1>
        <hr />
        <pre>
          <code>
            {_routes}
            <hr />
            {JSON.stringify(this.context.router.getCurrentParams(), null, 4)}
          </code>
        </pre>
      </ui.Panel>
      );
  }
});

var SelfProfile = React.createClass({
  render () {
    return (
        <ui.Panel className="k-div--selfprofile">
          <em>{t('self profile')}</em>
        </ui.Panel>
      );
  }
});

var Home = React.createClass({
  mixins: [
    Navigation,
    Reflux.ListenerMixin
  ],
  componentDidMount () {
    this.listenTo(sessionStore, this.sessionStoreChange);
  },
  sessionStoreChange (x,y,z) {
    log('sessionStoreChange ', x, y, z);
  },
  statics: {
    willTransitionTo (transition) {
      transition.redirect('forms')
    }
  },
  render () {
    return (
      <ui.Panel className="k-div--home">
        <h1>Home</h1>
        <hr />
        Please log in and click "forms"
      </ui.Panel>
      );
  }
});

var SectionNotFound = React.createClass({
  render () {
    return (
        <ui.Panel className="k404">
          <i />
          <em>section not found</em>
        </ui.Panel>
      );
  }
});

var Demo = React.createClass({
  render () {
    return (
      <div>
        <Demo.asset name="d1" uid="aLARjo7WkhpWhe2su4hkcU" />
        <Demo.asset name="d2" uid="aFH2NwaPdfqYiwPoVsqFHF" />
        <Demo.asset name="d3" uid="aLJYYUjjYcDSfsFarFPygw" />
      </div>
      );
  }
});
var DemoCollections = React.createClass({
  render () {
    return (
        <div>
          <Demo.collection name="root" 
                  msg={'loading your surveys'} />
          <Demo.collection name="random"
                  msg={'loading a random collection'} />
          <Demo.collection uid="c5Q4Tg3hVx23PbwgYcApCP"
                  msg={'loading assets in a question library'} />
        </div>
      )
  }
})


Demo.asset = React.createClass({
  mixins: [
    Navigation,
    mixins.droppable,
    mixins.dmix,
    Reflux.ListenerMixin
  ],
  render () {
    return this._createPanel()
  }
});

Demo.collection = React.createClass({
  mixins: [
    Navigation,
    mixins.cmix,
    mixins.ancestorBreadcrumb,
    mixins.droppable,
    Reflux.ListenerMixin,
  ],
  render () {
    return this._createPanel()
  }
});

var routes = (
  <Route name="home" path="/" handler={App}>
    <Route name="library" handler={LibraryList}>
    </Route>

    <Route name="forms" handler={Forms}>
      <Route name="new-form" path="new" handler={NewForm} />

      <Route name="collections">
        <Route name="collection-page" path=":uid" handler={CollectionList} />
      </Route>

      <Route name="form-landing" path="/forms/:assetid">
        <Route name="form-download" path="download" handler={FormDownload} />
        <Route name="form-json" path="json" handler={FormJson} />
        <Route name="form-sharing" path="sharing" handler={FormSharing} />
        <Route name="form-preview-enketo" path="preview" handler={FormEnketoPreview} />
        <Route name='form-edit' path="edit" handler={FormPage} />
        <DefaultRoute handler={FormLanding} />
      </Route>

      <DefaultRoute handler={FormList} />
      <NotFoundRoute handler={FormNotFound} />
    </Route>
    <Route name="demo" handler={Demo} />
    <Route name="demo2" handler={DemoCollections} />

    <Route name="users">
      <DefaultRoute name="users-list" handler={UserList} />
      <Route name="user-profile" handler={UserProfile}
              path="/users/:username" />
    </Route>

    <Route name="public" handler={Public}>
      <Route name="public-builder" handler={Builder} />
    </Route>
    <Route name="profile" handler={SelfProfile} />

    <DefaultRoute handler={Home} />
    <NotFoundRoute handler={SectionNotFound} />
  </Route>
);

export function runRoutes(el) {
  Router.run(routes, function (Handler, state) {
    React.render(<Handler />, el);
  });
};
