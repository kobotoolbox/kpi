import {notify, getAnonymousUserPermission, formatTime, anonUsername, parsePermissions, log, t} from './utils';
var $ = require('jquery');
window.jQuery = $;
window.$ = $;
require('jquery.scrollto');
require('jquery-ui/sortable');

var mdl = require('./libs/rest_framework/material');
var select2 = require('select2-browserify');
var actions = require('./actions');
// import XLSX from 'xlsx';

import React from 'react/addons';
import Router from 'react-router';
import Q from 'q';
// import Sidebar from './components/sidebar';
import MainHeader from './components/header';
import Select from 'react-select';
import Drawer from './components/drawer';
import searches from './searches';
import {List, ListSearch, ListSearchDebug, ListTagFilter} from './components/list';
import TagsInput from 'react-tagsinput';
import classNames from 'classnames';
import alertify from 'alertifyjs';
var ReactTooltip = require("react-tooltip");
var AssetRow = require('./components/assetrow');
// import {Sheeted} from './models/sheeted';
import stores from './stores';
import {dataInterface} from './dataInterface';
import Dropzone from './libs/dropzone';
import icons from './icons';
import cookie from 'react-cookie';
import bem from './bem';
import ui from './ui';
import mixins from './mixins';

var DocumentTitle = require('react-document-title');

import Favicon from 'react-favicon';


// var bootstrap = require('./libs/rest_framework/bootstrap.min');

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
  tagChange (tags, changedTag) {
    var uid = this.props.params.assetid || this.props.params.uid;
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
    }
    return ls;
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
          valueLink={this.linkTagState()} transform={transform}
          addKeys={addKeys} />
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
    var kls = classNames('k-form-close-button', 'mdl-button', 'mdl-js-button', 'mdl-button--icon', {
      "k-form-close-button--warning": this.needsSave()
    });
    return <a className={kls} onClick={this.navigateBack}>
                <i className="material-icons">clear</i>
            </a>;
  },
  innerRender () {
    var isSurvey = this.state.asset && this.state.asset.asset_type === 'survey';

    return (
        <ui.Panel className="k-div--formview--innerrender">
          <div className="k-form-header__buttons">
            <div className="mdl-grid k-form-header__inner">
              {this.renderSaveAndPreviewButtons()}
              <div className="mdl-layout-spacer"></div>
              {this.renderCloseButton()}
            </div>
          </div>
          <div className="k-form-header__title">
            <div className="k-corner-icon"></div>
            <div className="k-header-form-title">
              {this.renderFormNameInput()}
            </div>
          </div>
          { this.state.survey && isSurvey ?
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


var AssetNavigatorListView = React.createClass({
  mixins: [
    searches.common,
    Reflux.ListenerMixin,
  ],
  componentDidMount () {
    this.listenTo(this.searchStore, this.searchStoreChanged);
  },
  getInitialState () {
    return {};
  },
  searchStoreChanged (searchStoreState) {
    this.setState(searchStoreState);
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
  render () {
    var list,
        count,
        status,
        isSearch = this.state.searchResultsDisplayed;

    if (isSearch) {
      status = this.state.searchState,
      list = this.state.searchResultsList;
      count = this.state.searchResultsCount;
    } else {
      status = this.state.defaultQueryState;
      list = this.state.defaultQueryResultsList;
      count = this.state.defaultQueryCount;
    }

    if (status !== 'done') {
      return (
          <bem.LibList m={'empty'}>
            <bem.LibList__item m={'message'}>
              {t('loading')}
            </bem.LibList__item>
          </bem.LibList>
        );
    } else if (count === 0) {
      return (
          <bem.LibList m={'empty'}>
            <bem.LibList__item m={'message'}>
              {t('no search results found')}
            </bem.LibList__item>
          </bem.LibList>
        );
    } else {

      window.setTimeout(()=>{
        this.activateSortable();
      }, 1);

      return (
            <bem.LibList m={['done', isSearch ? 'search' : 'default']} ref="liblist">
              {list.map((item)=> {
                var modifiers = [item.asset_type];
                var summ = item.summary;
                return (
                    <bem.LibList__item m={modifiers} key={item.uid} data-uid={item.uid}>
                      <bem.LibList__dragbox />
                      <bem.LibList__label>
                        <ui.AssetName {...item} />
                      </bem.LibList__label>
                      <bem.LibList__tags>
                        {(item.tags || []).map((tg)=>{
                          return <bem.LibList__tag>{tg}</bem.LibList__tag>;
                        })}
                      </bem.LibList__tags>
                      <bem.LibList__qtype>
                        {t(item.asset_type)}
                      </bem.LibList__qtype>
                    </bem.LibList__item>
                  );
              })}
            </bem.LibList>
        );
    }
  },
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
    this.listenTo(stores.pageState, this.handlePageStateStore);
    this.state.searchContext.mixin.searchDefault();
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
      searchContext: searches.getSearchContext('library', {
        filterParams: {
          assetType: 'asset_type:question OR asset_type:block'
        }
      }),
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
    return (
        <bem.LibNav m={{
              shrunk: this.state.assetNavIsOpen
            }}>
          <bem.LibNav__header>
            <bem.LibNav__logo onClick={this.toggleOpen}>
              <i />
            </bem.LibNav__logo>
            <bem.LibNav__search>
              <ListSearch
                  placeholder={t('search library')}
                  searchContext={this.state.searchContext}
                />
            </bem.LibNav__search>
            <ListTagFilter
                  searchContext={this.state.searchContext}
                />
          </bem.LibNav__header>
          <bem.LibNav__content>
            <AssetNavigatorListView
                  searchContext={this.state.searchContext}
                />
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
    var btnCls = classNames('mdl-button',
                            'mdl-button--raised',
                            `perm-${permName}`,
                            'mdl-js-button',
                            ({
                              "false": "btn-default",
                              "allow": "mdl-button--colored",
                              "deny": "btn-danger"
                            })[permPermission]);

    var buttonAction;
    if (permissionObject) {
      buttonAction = this.removePerm(permName, permissionObject, this.props.uid);
    } else {
      buttonAction = this.setPerm(permName, this.props);
    }
    return (
      <button className={btnCls} onClick={buttonAction}>
        {permName}
      </button>
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
      <div>
        <div>
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
    var btnCls = classNames('mdl-button', 'mdl-button--raised', 
                            isOn ? 'mdl-button--colored' : '');
    return (
      <div className='permissions-toggle'>
        <button className={btnCls} onClick={this.props.onToggle}>
          <i className={`fa fa-group fa-lg`} />
          &nbsp;&nbsp;
          {isOn ?
            t('Link sharing on') :
            t('Link sharing off')}
        </button>
        <p className='text-muted text-center'>
          {isOn ?
            t('Anyone with the link can view this item') :
            t('This item can only be viewed by you and anyone you specify')}
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
          <div className="mdl-textfield mdl-js-textfield">
            <input className="mdl-textfield__input" type="text" id={this.props.id}
                  onChange={this.props.onChange} />
            <label className="mdl-textfield__label" htmlFor={this.props.id}>{this.props.label}</label>

          </div>
        </div>
      );
  }
});

var FormCheckbox = React.createClass({
  render () {
    return (
        <div className="form-group">
          <label className="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect" htmlFor={this.props.name} >
            <input type="checkbox" className="mdl-checkbox__input"  id={this.props.name} checked={this.props.value} onChange={this.props.onChange} />
            <span className="mdl-checkbox__label">{this.props.label}</span>
          </label>
        </div>
      );
  },
  componentDidUpdate() {
    // TODO: upgrade specific element only (as opposed to whole DOM)
    mdl.upgradeDom();
  }

})

var FormSettingsEditor = React.createClass({
  render () {
    return (
      <div className="well">
        <form className="form-horizontal">
          <hr />
          <div className="mdl-grid">
            <div className="mdl-cell mdl-cell--12-col">
              <FormInput id="form_id" label="form id" value={this.props.form_id} onChange={this.props.onFieldChange} />
            </div>
            <div className="mdl-cell mdl-cell--6-col">
              {this.props.meta.map((mtype) => {
                return <FormCheckbox htmlFor={mtype} onChange={this.props.onCheckboxChange} {...mtype} />
              })}
            </div>
            <div className="mdl-cell mdl-cell--6-col">
              {this.props.phoneMeta.map((mtype) => {
                return <FormCheckbox htmlFor={mtype} onChange={this.props.onCheckboxChange} {...mtype} />
              })}
            </div>
          </div>
          <div className="form-group mdl-grid">
            <div className="mdl-cell mdl-cell--3-col">
              <label htmlFor='webform-style' className={'mdl-button mdl-js-button'}
                  onClick={this.focusSelect}>
                {t('Web form style')}
              </label>
            </div>
            <div className="mdl-cell mdl-cell--5-col">
              <Select
                  name="webform-style"
                  ref="webformStyle"
                  value={this.props.styleValue}
                  options={[
                      {value: '', label: t('Default - single page')},
                      {value: 'theme-grid', label: t('Grid theme')},
                      {value: 'pages', label: t('Multiple pages')},
                      {value: 'theme-grid pages', label: t('Grid theme + Multiple pages')},
                    ]}
                />
            </div>
          </div>
        </form>
      </div>
      );
  },
  focusSelect () {
    this.refs.webformStyle.focus();
  },
  componentDidUpdate() {
    mdl.upgradeDom();
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
          <div className="k-sub-settings-container" onClick={this.toggleSettingsEdit}>
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
  },
  componentDidUpdate() {
    mdl.upgradeDom();
  }
})




function surveyToValidJson(survey, omitSettings=false) {
  var surveyDict = survey.toFlatJSON();
  if (omitSettings && 'settings' in surveyDict) {
    delete surveyDict['settings'];
  }
  return JSON.stringify(surveyDict);
}


/* Routes:
*/
var App = React.createClass({
  mixins: [
    Reflux.ListenerMixin,
    Navigation,
    Reflux.connect(stores.pageState),
  ],
  getInitialState () {
    return assign({}, stores.pageState.state, {
      sidebarIsOpen: stores.pageState.state.sidebarIsOpen
    });
  },
  render() {
    return (
      <DocumentTitle title="KoBoToolbox">
        <div className="mdl-wrapper">
          <bem.PageWrapper m={{
              'asset-nav-present': this.state.assetNavPresent,
              'asset-nav-open': this.state.assetNavIsOpen && this.state.assetNavPresent,
                }}  className="mdl-layout mdl-js-layout mdl-layout--fixed-header">
              <MainHeader />
              <Drawer />
              <bem.PageWrapper__content m={{
                'navigator-open': this.state.assetNavigatorIsOpen,
                'navigator-present': this.state.assetNavigator,
                  }}
                className="mdl-layout__content">
                <RouteHandler appstate={this.state} />
              </bem.PageWrapper__content>
              { this.state.assetNavPresent ?
                <AssetNavigator />
              :null}
          </bem.PageWrapper>
        </div>
      </DocumentTitle>
    );
  },
  componentDidUpdate() {
    // Material Design Lite
    // This upgrades all upgradable components (i.e. with 'mdl-js-*' class)
    mdl.upgradeDom();
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
      } else {
        stores.pageState.setHeaderBreadcrumb([
          {'label': t('Forms'), 'to': 'forms'}
        ]);
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

mixins.newForm = {
  renderFormNameInput () {
    var nameKls = this.state.survey_name_valid ? '' : 'has-warning';
    var nameInputKls = classNames('mdl-textfield__input',
                                  nameKls);
    return (
        <div className="mdl-textfield mdl-js-textfield mdl-textfield--full-width">
          <input ref="form-name"
                className={nameInputKls}
                type="text"
                onChange={this.nameInputChange}
                placeholder={t('form name')}
                id="formtitle"
              />
          <label className="mdl-textfield__label" htmlFor="formtitle"></label>
        </div>
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
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      stores.pageState.setHeaderBreadcrumb([
        {'label': t('Forms'), 'to': 'forms'},
        {'label': t('New'), 'to': 'new-form'}
      ]);
      stores.pageState.setAssetNavPresent(true);
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
  surveyStateChanged (state) {
    this.setState(state);
  },
  componentDidMount () {
    this.navigateBack = (evt) => {
      if (this.needsSave() && confirm(t('you have unsaved changes. would you like to save?'))) {
        this._saveForm();
      }
      this.transitionTo(this.listRoute);
    }
    actions.resources.createResource.listen(this.creatingResource);
    actions.resources.createResource.completed.listen(this.creatingResourceCompleted);
    this.listenTo(stores.surveyState, this.surveyStateChanged);
    var survey = this.createSurvey();
    var skp = new SurveyScope({
      survey: survey
    });
    var app = new dkobo_xlform.view.SurveyApp({
      survey: survey,
      stateStore: stores.surveyState,
      ngScope: skp
    });
    $('.form-wrap').html(app.$el);
    app.render();
    this.app = app;
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
}

var NewForm = React.createClass({
  mixins: [
    Navigation,
    mixins.formView,
    Reflux.ListenerMixin,
    mixins.newForm,
  ],
  // Where to go when user closes without saving
  listRoute: 'forms',
  createSurvey() {
    return dkobo_xlform.model.Survey.create();
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
  }
});

var AddToLibrary = React.createClass({
  mixins: [
    Navigation,
    mixins.formView,
    Reflux.ListenerMixin,
    mixins.newForm,
  ],
  // Where to go when user closes without saving
  listRoute: 'library',
  createSurvey() {
    // Start with a blank slate instead of using Survey.create(), which follows
    // defaultSurveyDetails and creates unwanted questions like "start time"
    var content = {survey: []};
    return dkobo_xlform.model.Survey.loadDict(content);
  },
  saveNewForm (evt) {
    evt.preventDefault();
    var sc;
    var chgs = {
      name: this.refs['form-name'].getDOMNode().value
    };
    try {
      // pass true to surveyToValidJson() so that settings will be omitted
      // and the backend will view this as a question or block instead of a
      // survey
      chgs.content = surveyToValidJson(this.state.survey, true);
    } catch (e) {
      log('cannot save survey', e);
    }
    actions.resources.createResource(chgs);
  }
});

var Collections = React.createClass({
  mixins: [
    mixins.collection,
    mixins.ancestorBreadcrumb,
    Navigation,
    Reflux.ListenerMixin,
  ],
  render () {},
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      var headerBreadcrumb = [
        {'label': t('Collections'), 'to': 'collections'},
        {'label': t('Collection'), 'to': 'collection-landing', params: {
          uid: params.uid
        }}
      ];
      stores.pageState.setHeaderBreadcrumb(headerBreadcrumb);
      callback();
    }
  },
  addListeners () {
    this.listenTo(stores.collectionAssets, this.listenChange);
  },
  listenChange (data) {
    var collections = data.children.results.filter(function(c){
      return c.kind === 'collection';
    });
    var assets = data.children.results.filter(function(c){
      return c.kind === 'asset';
    });
    this.setState({
      ancestors: data.ancestors,
      list: [
        ...collections,
        ...assets
      ]
    });
  },
  dropAction ({file, event}) {
    actions.resources.createAsset({
      base64Encoded: event.target.result,
      filename: file.name,
      lastModified: file.lastModified,
      contentType: file.type
    });
  },
  renderAbovePanel() {
    var ancestors;
    if (this.state.ancestors) {
      return this.renderAncestorBreadcrumb(this.ancestorListToParams(this.state.ancestors));
    } else {
      return this.renderAncestorBreadcrumb([{
        children: t('collections'),
        to: 'collections',
        params: {}
      }]);
    }
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
                var fmt = `download-format-${item.format}`;
                return (
                    <li>
                      <a href={item.url} ref={fmt}>
                        {t(fmt)}
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
});

var FormXform = React.createClass({
  mixins: [
    Navigation,
    Reflux.ListenerMixin
  ],
  componentDidMount () {
    dataInterface.getAssetXformView(this.props.params.assetid).done((content)=>{
      this.setState({
        xformLoaded: true,
        xformHtml: {
          __html: $('<div>').html(content).find('.pygment').html()
        },
      })
    });
  },
  getInitialState () {
    return {
      xformLoaded: false
    }
  },
  render () {
    if (!this.state.xformLoaded) {
      return <p>XForm is loading</p>
    } else {
      return <div className="pygment"
                dangerouslySetInnerHTML={this.state.xformHtml}
              />
    }
  }
});

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
    var btnKls = classNames('mdl-button',
                            'mdl-buton-raised',
                            'mdl-button--colored',
                            inpStatus === 'success' ? 'mdl-button--colored' : 'hidden');

    var uid = this.state.asset.uid;
    var kind = this.state.asset.kind;
    var objectUrl = this.state.asset.url;

    if (!perms) {
      return <p>loading</p>
    }
    return (
      <ui.Modal open onClose={this.routeBack} title={t('manage sharing permissions')}>
        <ui.Modal.Body>
          <ui.Panel className="k-div--sharing">
            <div className="k-sharing__title">
              <h5>{this.state.asset.name}</h5>
            </div>
            <div className="k-sharing__header">
              <div className="user--pill">
                <StackedIcon frontIcon='user' /> 
                <div className="user--pill__name">
                  <UserProfileLink username={this.state.asset.owner__username} /><br/>
                  <span className="text-small">{t('owner')}</span>
                </div>
              </div>

              <div className="text-small">{t('To share this item with others just enter their username below, then choose which permissions they shoud have. To remove them again just deselect both permissions. Note: this does not control permissions to the data collected by projects')}</div>

            </div>


            <div className="mdl-grid">
              <div className="mdl-cell mdl-cell--5-col">
                <div className="k-share-username mdl-card mdl-shadow--2dp">
                  <form onSubmit={this.addInitialUserPermission}>
                    <div className="mdl-card__title">
                      <h2 className="mdl-card__title-text">{t('share with username')}</h2>
                    </div>
                    <div className="mdl-card__supporting-text">
                      <ui.SmallInputBox ref='usernameInput' placeholder={t('share with username')} onKeyUp={this.usernameCheck} />
                      <button className={btnKls}>
                        <i className="fa fa-fw fa-lg fa-plus" />
                      </button>
                    </div>
                    <div className="mdl-card__actions mdl-card--border">
                      {perms.map((perm)=> {
                        return <UserPermDiv key={`perm.${uid}.${perm.username}`} ref={perm.username} uid={uid} kind={kind} objectUrl={objectUrl} {...perm} />;
                      })}
                    </div>
                  </form>
                </div>
              </div>
              <div className="mdl-cell mdl-cell--1-col">
              </div>
              <div className="mdl-cell mdl-cell--5-col">
                <div className="k-share-publicly mdl-card mdl-shadow--2dp">
                  <div className="mdl-card__title">
                    <h2 className="mdl-card__title-text">{t('Link sharing')}</h2>
                  </div>
                  <div className="mdl-card__supporting-text">
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
                </div>
              </div>
            </div>

          </ui.Panel>
        </ui.Modal.Body>
      </ui.Modal>
      );
  },
  componentDidUpdate() {
    mdl.upgradeDom();
  }

});

var CollectionSharing = React.createClass({
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
    this.transitionTo('collections');
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
    var btnKls = classNames('mdl-button',
                            'mdl-button--raised',
                            'mdl-button--colored',
                            inpStatus === 'success' ? 'btn-success' : 'hidden');

    var uid = this.state.asset.uid;
    var kind = this.state.asset.kind;
    var objectUrl = this.state.asset.url;

    if (!perms) {
      return <p>loading</p>
    }
    return (
      <ui.Modal open onClose={this.routeBack} title={t('manage sharing permissions')}>
        <ui.Modal.Body>
          <ui.Panel className="k-div--sharing">
            <div className="k-sharing__title">
              <h5>{this.state.asset.name}</h5>
            </div>
            <div className="k-sharing__header">
              <div className="user--pill">
                <StackedIcon frontIcon='user' /> 
                <div className="user--pill__name">
                  <UserProfileLink username={this.state.asset.owner__username} /><br/>
                  <span className="text-small">{t('owner')}</span>
                </div>
              </div>
              <div className="text-small">{t('note: this does not control permissions to the data collected by projects')}</div>
            </div>

            <div className="mdl-grid">
              <div className="mdl-cell mdl-cell--5-col">
                <div className="k-share-username mdl-card mdl-shadow--2dp">
                  <form onSubmit={this.addInitialUserPermission}>
                    <div className="mdl-card__title">
                      <h2 className="mdl-card__title-text">{t('Share with other users')}</h2>
                    </div>
                    <div className="mdl-card__supporting-text">
                      <ui.SmallInputBox ref='usernameInput' placeholder={t('enter a username')} onKeyUp={this.usernameCheck} />
                      <button className={btnKls}>
                        <i className="fa fa-fw fa-lg fa-plus" />
                      </button>
                    </div>
                    <div className="mdl-card__actions mdl-card--border">
                      {perms.map((perm)=> {
                        return <UserPermDiv key={`perm.${uid}.${perm.username}`} ref={perm.username} uid={uid} kind={kind} objectUrl={objectUrl} {...perm} />;
                      })}
                    </div>
                  </form>
                </div>
              </div>
              <div className="mdl-cell mdl-cell--1-col">
              </div>
              <div className="mdl-cell mdl-cell--5-col">
                <div className="k-share-publicly mdl-card mdl-shadow--2dp">
                    <div className="mdl-card__title">
                      <h2 className="mdl-card__title-text">{t('Link sharing')}</h2>
                    </div>
                    <div className="mdl-card__supporting-text">
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
                </div>
              </div>
            </div>

          </ui.Panel>
        </ui.Modal.Body>
      </ui.Modal>
      );
  },
  componentDidUpdate() {
    mdl.upgradeDom();
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
    this.listenTo(stores.snapshots, this.snapshotCreation);
    stores.pageState.setHeaderBreadcrumb([
      {'label': t('Forms'), 'to': 'forms'},
      {'label': t('Preview')}
    ]);

  },
  getInitialState () {
    return {
      enketopreviewlink: false,
      message: t('loading...'),
      error: false
    }
  },
  snapshotCreation (data) {
    if (data.success) {
      var uid = this.props.params.assetid;
      this.setState({
        enketopreviewlink: data.enketopreviewlink
      })
    } else {
      this.setState({
        message: data.error,
        error: true
      })
    }
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
      <ui.Modal open onClose={this.routeBack}>
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
    Reflux.ListenerMixin,
  ],
  getNameValue () {
    return this.refs['form-name'].getDOMNode().value
  },
  saveForm (evt) {
    evt.preventDefault();
    dataInterface.patchAsset(this.props.params.assetid, {
      content: surveyToValidJson(this.state.survey),
    }).done((asset) => {
      this.setState({
        asset_updated: true
      });
      actions.resources.updateAsset.completed(asset);
    }).fail((jqxhr) => {
      actions.resources.updateAsset.failed(asset);
    })
    this.setState({
      asset_updated: false
    });
  },

  showAll () {
    this.app.expandMultioptions();
  },
  previewForm () {
    log('preview button has been clicked');
  },
  groupQuestions () {
    this.app.groupSelectedRows();
  },

  onSurveyChange () {
    this.setState({
      asset_updated: -1
    });
  },
  renderSaveAndPreviewButtons () {
    var surv = this.state.survey,
        app = this.app || {};

    var previewDisabled = true;
    var groupable = !!this.state.groupButtonIsActive;
    var showAllOpen = !!this.state.multioptionsExpanded;
    return (
        <bem.FormHeader>
          <bem.FormHeader__button m={['save', {
                savepending: this.state.asset_updated === false,
                savecomplete: this.state.asset_updated === true,
                saveneeded: this.state.asset_updated === -1,
              }]} onClick={this.saveForm}>
            <i />
            {t('save')}
          </bem.FormHeader__button>
          <bem.FormHeader__button m={['preview', {
                previewdisabled: previewDisabled
              }]} onClick={this.previewForm}
              disabled={previewDisabled}>
            <i />
            {t('preview')}
          </bem.FormHeader__button>
          <bem.FormHeader__button m={['show-all', {
                open: showAllOpen,
              }]} onClick={this.showAll}>
            <i />
            {t('show all responses')}
          </bem.FormHeader__button>
          <bem.FormHeader__button m={['group', {
                groupable: groupable
              }]} onClick={this.groupQuestions}
              disabled={!groupable}>
            <i />
            {t('group questions')}
          </bem.FormHeader__button>
        </bem.FormHeader>
      );
  },

  getInitialState () {
    return {
      survey_loaded: false,
      survey_name: '',
      multioptionsExpanded: true,
      kind: 'asset',
      asset: false
    };
  },
  renderFormNameInput () {
    var nameKls = this.state.survey_name_valid ? '' : 'has-warning';
    var nameInputKls = classNames('mdl-textfield__input',
                                  nameKls);
    var nameVal = this.state.survey_name;
    return (
        <div className="mdl-textfield mdl-js-textfield mdl-textfield--full-width">
          <input ref="form-name"
              className={nameInputKls}
              type="text"
              value={nameVal}
              onChange={this.nameInputChange}
              placeholder={t('form name')}
              id="surveytitle"
            />
          <label className="mdl-textfield__label" htmlFor="surveytitle"></label>
        </div>
      );
  },
  assetStoreTriggered (data, uid, stateUpdates) {
    if (this.state.survey) {
      return;
    }
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
      var headerBreadcrumb = [
        {'label': t('Forms'), 'to': 'forms'}
      ];
    stores.pageState.setHeaderBreadcrumb(headerBreadcrumb);
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
  surveyStateChanged (state) {
    this.setState(state);
  },
  postLoadRenderMount () {
    this._postLoadRenderMounted = true;
    this.state.survey.settings.set('form_title', this.state.asset.name);
    var skp = new SurveyScope({survey: this.state.survey});
    this.listenTo(stores.surveyState, this.surveyStateChanged);
    this.app = new dkobo_xlform.view.SurveyApp({
      survey: this.state.survey,
      stateStore: stores.surveyState,
      ngScope: skp,
    });
    var fw = this.refs['form-wrap'].getDOMNode();
    this.app.$el.appendTo(fw);
    this.app.render();
  },
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      stores.pageState.setAssetNavPresent(true);
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
  },
  componentDidUpdate() {
    // Material Design Lite
    // This upgrades all upgradable components (i.e. with 'mdl-js-*' class)
    mdl.upgradeDom();
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
      var headerBreadcrumb = [
        {
          'label': t('Forms'),
          'to': 'forms',
        }
      ];
      stores.pageState.setHeaderBreadcrumb(headerBreadcrumb);
      stores.pageState.setAssetNavPresent(false);
      actions.resources.loadAsset({id: params.assetid});
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

var LibrarySearchableList = require('./lists/library');
var FormsSearchableList = require('./lists/forms');
var CollectionList = require('./lists/collection');

var CollectionLanding = require('./lists/collectionlanding');

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
    <Route name="library" handler={LibrarySearchableList}>
    </Route>

    <Route name="forms" handler={Forms}>
      <Route name="new-form" path="new" handler={NewForm} />
      <Route name="add-to-library" path="add-to-library" handler={AddToLibrary} />

      <Route name="form-landing" path="/forms/:assetid">
        <Route name="form-download" path="download" handler={FormDownload} />
        <Route name="form-json" path="json" handler={FormJson} />
        <Route name="form-xform" path="xform" handler={FormXform} />
        <Route name="form-sharing" path="sharing" handler={FormSharing} />
        <Route name="form-preview-enketo" path="preview" handler={FormEnketoPreview} />
        <Route name='form-edit' path="edit" handler={FormPage} />
        <DefaultRoute handler={FormLanding} />
      </Route>

      <DefaultRoute handler={FormsSearchableList} />
      <NotFoundRoute handler={FormNotFound} />
    </Route>
    <Route name="demo" handler={Demo} />
    <Route name="demo2" handler={DemoCollections} />

    <Route name="collections">
      <Route name="collection-page" path=":uid" handler={CollectionLanding} />
      <Route name="collection-sharing" path=":assetid/sharing" handler={CollectionSharing} />
      <DefaultRoute handler={CollectionList} />
    </Route>

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
