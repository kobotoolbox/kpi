import {log, t} from './utils';

var $ = require('jquery');
window.jQuery = $;
window.$ = $;
require('jquery.scrollto');
require('jquery-ui/sortable');
var select2 = require('select2-browserify');


window._ = require('underscore');

window.Backbone = require('backbone');
window.Backbone.$ = $
window.BackboneValidation = require('backbone-validation');

import React from 'react/addons';
import Router from 'react-router';
import {Sidebar} from './components/sidebar';
import TagsInput from 'react-tagsinput';
import moment from 'moment';
import classNames from 'classnames';
import alertify from 'alertifyjs';
import {Sheeted} from './models/sheeted';
import Dropzone from './libs/dropzone';

import Favicon from 'react-favicon';

var bootstrap = require('./libs/rest_framework/bootstrap.min');

window.dkobo_xlform = require('./libs/xlform')


var assign = require('react/lib/Object.assign');
var Reflux = require('reflux');

var Navigation = Router.Navigation;
let DefaultRoute = Router.DefaultRoute;
let Link = Router.Link;
let Route = Router.Route;
let RouteHandler = Router.RouteHandler;
let NotFoundRoute = Router.NotFoundRoute;


class SmallInputBox extends React.Component {
  getValue () {
    return this.refs.inp.getDOMNode().value;
  }
  noteStoreChange (a,b,c) {
    log('storechange', a,b,c)
  }
  render () {
    var valid = false;
    return (
        <input type="text" placeholder={this.props.placeholder} ref='inp'
                className="form-control input-sm pull-right" onKeyUp={this.props.onKeyUp} />
      );
  }
}

var MeViewer = React.createClass({
  mixins: [Reflux.ListenerMixin],
  getInitialState () {
    return {
      status: 'loading'
    };
  },
  componentDidMount () {
    var _this = this;
    sessionDispatch.selfProfile().done(function(user){
      var status = user.username ? 'logged in' : 'logged out';
      var newState = assign({}, user, {
        status: status,
      });
      _this.setState(newState);
    }).fail(()=> {
      _this.setState({status: 'failed'});
    });
    this.listenTo(actions.auth.logout.completed, this.onAuthLogoutcompleted);
    this.listenTo(actions.auth.login.completed, this.onAuthLoginCompleted);
  },
  onAuthLogoutcompleted () {
    this.setState({
      status: 'logged out'
    });
  },
  onAuthLoginCompleted (acct) {
    var status = acct.username ? 'logged in' : 'logged out';
    var newState = assign({}, acct, {
      status: status,
    });
    this.setState(newState);
  },
  render () {
    var content;
    if (this.state.status === 'loading') {
      return <NavBarIcon icon="fa-spinner fa-spin fa-2x" title={this.state.status} />;
    } else if (this.state.status === 'logged out') {
      content = <span className='label label-danger'>logged out</span>;
    } else {
      content = this.state.username;
    }
    return <div className='a pull-right'>{content}</div>;
  }
});

var AssetNavigator = React.createClass({
  mixins: [
    Navigation,
    // Reflux.connectFilter(assetSearchStore, function (){

    // }),
    // Reflux.connectFilter(tagSearchStore, function (){

    // }),
  ],
  getInitialState () {
    return {};
  },
  searchFieldValue () {
    return this.refs.headerSearch.refs.inp.getDOMNode().value;
  },
  liveSearch () {
    var queryInput = this.searchFieldValue(),
      r;
    if (queryInput && queryInput.length > 2) {
      if (r = assetSearchStore.getRecentSearch(queryInput)) {
        this.setState({
          searchResults: r
        });
      } else {
        actions.search.assets(queryInput);
      }
    }
  },
  render () {
    return (
      <div className="asset-navigator">
        <SmallInputBox ref="headerSearch" placeholder={t('search keywords or tags')} onKeyUp={this.liveSearch} />
        <hr />
        <Dropzone>
          <p>tags</p>
          <hr />
          <p>library</p>
          <hr />
          <span className='indicator indicator--drag-files-here'>
            <i className={classNames('fa', 'fa-sm', 'fa-file-o')} />
            &nbsp;
            &nbsp;
            {t('upload forms')}
          </span>
          <br />
        </Dropzone>
      </div>
      );
  }
})

class AssetCollectionsContainer extends React.Component {
  // constructor () {
  //   super();
  //   this.state = {
  //     loading: t('your assets will load shortly')
  //   };
  // }
  focusComponent (el) {
    if (this._focusedComponent) {
      this._focusedComponent.unfocus();
    }
    this._focusedComponent = el
  }
  render () {
    var rows;
    var title = t('Asset Collections');
    var itemName = this.props.itemname || 'items';
    if (this.props.results && this.props.results.length == 0) {
      rows = (
        <AssetCollectionPlaceholder notice={t(`there are no ${itemName} to display`)} />
        );
    } else if (this.props.results && this.props.results.length > 0) {
      rows = this.props.results.map((asset) => {
        asset.objectType = asset.url.match(/http\:\/\/[^\/]+\/(\w+)s/)[1];
        return <AssetCollectionRow key={asset.uid} {...asset} onFocusComponent={this.focusComponent.bind(this)} />;
      });
    } else {
      rows = (
        <AssetCollectionPlaceholder {...this.props} />
        );
    }
    var cls = classNames('widget', 'asset-collections-table')
    return (
        <div className={cls}>
          <div className="widget-title">
            <i className="fa fa-clock" /> {title}
            <SmallInputBox placeholder={t('Search')} />
            <div className="clearfix"></div>
          </div>
          <AssetsTable rows={rows} />
        </div>
      )
  }
}

class AssetsTable extends React.Component {
  render () {
    var rows = this.props.rows;
    return (
        <div className="widget-body no-padding">
          <div className="table-responsive">
            <table className="table">
              <tbody>
                {rows}
              </tbody>
            </table>
          </div>
        </div>
      );
  }
}


class SearchForm extends React.Component {
  render () {
    return (
          <form role='search' className='navbar-form navbar-left'>
            <div className='form-group'>
              <input type='text' placeholder='Search' className='form-control' />
            </div>
            <button className='btn btn-default' type='submit'>Submit</button>
          </form>
        );
  }
}


function notify(msg, atype='success') {
  alertify.notify(msg, atype);
}

class PermissionUserSearch extends React.Component {
  onKeyUp (evt) {
    if (evt.target.value.length > 3) {
      log("Query API for user: ", evt.target.value);
    }
  }
  render () {
    return (
      <tr>
        <td colSpan="3">
          <input type="text"
                placeholder={t('add user')}
                onKeyUp={this.onKeyUp.bind(this)}
          />
        </td>
      </tr>
      )
  }
}
class PermissionUserEntry extends React.Component {
  updateStatus (...args) {
    log('updateStatus', args);
  }

  showFailure (req, err1, err2) {
    console.error(req.responseJSON);
    alert('showFailure', err1 + ': ' + err2);
  }

  setPermission (perm, onOrOff) {
    var perm = this.props.permissions.filter((p)=> {
      return p.permission.indexOf(perm) !== -1;
    })[0];

    if (perm) {
      $.ajax({
        url: perm.url,
        data: {
          csrfmiddlewaretoken: window.csrfToken
        },
        method: 'DELETE'
      }).done(this.updateStatus.bind(this))
        .fail(this.showFailure.bind(this));
    }
  }

  render () {
    var perms = {};
    var perm, permId;
    this.props.permissions.forEach((perm, i)=>{
      perms[perm.permission.match(/(\w+)_.*/)[1]] = true;
    });
    var viewButton;
    var editButton;

    // this code can be simplified when we know how we want to do this...
    if (perms.view) {
      viewButton = (
        <a href={'#'}
            onClick={(evt)=>{ this.setPermission('view', false) }}
            className={'btn btn-sm btn-primary'}
            title={t('removes view permission')}>
          {t('view')}
        </a>
      );
    } else {
      viewButton = (
        <a href={'#'}
            onClick={(evt)=>{ this.setPermission('view', true) }}
            className={t('btn btn-sm')}
            title={t('adds view permission')}>
          {t('view')}
        </a>
      );
    }
    if (perms.edit) {
      editButton = (
        <a href={'#'}
            onClick={(evt)=>{ this.setPermission('edit', false) }}
            className={'btn btn-sm btn-primary'}
            title={t('removes edit permission')}>
          {t('edit')}
        </a>
      );
    } else {
      editButton = (
        <a href={'#'}
            onClick={(evt)=>{ this.setPermission('edit', true) }}
            className={'btn btn-sm'}
            title={t('adds edit permission')}>
          {t('edit')}
        </a>
      );
    }

    return (
      <tr>
        <td className="username">
          {this.props.username}
        </td>
        <td className="can-edit">
          {editButton}
        </td>
        <td className="can-view">
          {viewButton}
        </td>
      </tr>
      );
  }
}

class PermissionsEditor extends React.Component {
  constructor () {
    super();
    this.state = {
      expanded: false
    }
  }

  toggleExpand () {
    if (this.state.expanded) {
      this.setState({expanded: false});
    } else {
      if (this.props.onFocusComponent) {
        this.props.onFocusComponent(this);
      }
      this.setState({expanded: true});
    }
  }

  unfocus () {
    this.setState({
      expanded: false
    });
  }

  render () {
    var user_count = this.props.perms.length;
    var isEmpty = user_count === 0;
    var icon, icon_classes;
    var klasses = classNames("permissions-editor", {
      "permissions-editor--unshared": !!isEmpty
    });
    var expanded_content;
    icon_classes = classNames("permissions-editor__icon", "fa", "fa-fw",
      !!isEmpty ? "fa-lock" : "fa-users"
      )

    icon = <i className={icon_classes} onClick={this.toggleExpand.bind(this)} />;
    if (this.state.expanded) {
      expanded_content = (
          <table className="permissions-editor__list">
            {this.props.perms.map((perm_user)=>{
              perm_user.user_url = perm_user.user;
              perm_user.username = perm_user.user_url.match(/\/(\w+)\/$/)[1];
              return <PermissionUserEntry {...perm_user} />;
            })}
            <PermissionUserSearch />
          </table>
        )
      user_count = '';
    }
    return (
        <div className={klasses}>
          {icon}
          {user_count}
          {expanded_content}
        </div>
      );
  }
}

function parsePermissions(owner, permissions) {
  var users = [];
  var perms = {};
  permissions.map((perm) => {
    perm.user__username = perm.user.match(/\/users\/(.*)\//)[1];
    return perm;
  }).filter((perm)=> {
    return ( perm.user__username !== owner );
  }).forEach((perm)=> {
    if(users.indexOf(perm.user__username) === -1) {
      users.push(perm.user__username);
      perms[perm.user__username] = [];
    }
    perms[perm.user__username].push(perm);
  });
  return users.map((username)=>{
    return {
      username: username,
      can: perms[username].reduce((cans, perm)=> {
        var permCode = perm.permission.split('_')[0];
        cans[permCode] = perm;
        // log('permCode', permCode)
        return cans;
      }, {})
    };
  });
}

function formatTime(timeStr) {
  return moment(timeStr).format('MMM DD YYYY');
}

class MomentTime extends React.Component {
  render () {
    var mtime = formatTime(this.props.time).toLowerCase();
    return (
        <span className='formatted-time'>{mtime}</span>
      )
  }
}

var AssetCollectionRow = React.createClass({
  // mixins: [Reflux.connect(sessionStore, "currentUsername")],
  getInitialState () {
    return {
      permissionsObject: {}
    };
  },
  render () {
    var perm = parsePermissions(this.props.owner, this.props.permissions);
    var isAsset = this.props.objectType === "asset";
    let assetid = this.props.url.match(/\/(\w+)\/$/)[1];
    var currentUsername = sessionStore.currentAccount && sessionStore.currentAccount.username
    var selfOwned = this.props.owner__username == currentUsername;
    var icon_stack;
    if (isAsset) {
      icon_stack = <i className='fa fa-lg fa-file' />;
    } else {
      icon_stack = <i className='fa fa-lg fa-folder' />;
    }

    return (
        <tr className="assetcollection__row">
          <td className="text-center asset-icon-box">
            {icon_stack}
          </td>
          <td>
            <Link to="form-view" params={{ assetid: assetid }}>
              {this.props.name || t('untitled form')}
            </Link>
          </td>
          <td>
            {
              selfOwned ?
                '' :
                <UserProfileLink icon='user' iconBefore='true' username={this.props.owner__username} />
            }
          </td>
          <td>
            {formatTime(this.props.date_modified)}
          </td>
          <td>
            <PermissionsEditor perms={perm} onFocusComponent={this.props.onFocusComponent} />
          </td>
        </tr>
      )
  }
});

class AssetCollectionPlaceholder extends React.Component {
  render () {
    var icon,
        message,
        clName = "assetcollection__row";
    if (this.props.loading) {
      icon = <img src={'/static/img/ajax-loader.gif'} width="14" height="14" />;
      message = this.props.loading;
      clName += " assetcollection__row--loading";
    } else if(this.props.notice) {
      message = this.props.notice;
      icon = <i className="fa fa-fw fa-notice" />;
      clName += " assetcollection__row--notice";
    } else {
      message = this.props.error;
      icon =  <i className="fa fa-fw fa-warning" />;
      clName += " assetcollection__row--error";
    }
    return (
        <tr className={clName}>
          <td colSpan="4">{icon}&nbsp;&nbsp;{message}</td>
        </tr>
      )
  }
}

// var AssetTags = React.createClass({
//   getInitialState () {
//     return {tags:[]}
//   },
//   saveTags () {
//     console.log('tags: ', this.refs.tags.getTags().join(', '));
//   },
//   componentDidMount () {
//     this.setState({
//       tags: this.props.tags || []
//     });
//   },
//   render () {
//     return (
//       <div className="assettags">
//         <TagsInput ref="tags" tags={this.state.tags} />
//         <button onClick={this.saveTags}>Save</button>
//       </div>
//       );
//   }
// })

var App = React.createClass({
  getInitialState () {
    return {
      intentOpen: true,
      isOpen: !this.widthLessThanMin()
    }
  },

  widthLessThanMin () {
    return window.innerWidth < 560;
  },

  handleResize () {
    if (this.widthLessThanMin()) {
      this.setState({
        isOpen: false
      });
    } else if (this.state.intentOpen && !this.state.isOpen) {
      this.setState({
        isOpen: true
      });
    }
  },

  componentDidMount () {
    if (!this.resize) {
      this.resize = this.handleResize.bind(this);
    }
    // can use window.matchMedia(...) here
    window.addEventListener('resize', this.resize);
  },
  componentWillUnmount () {
    window.removeEventListener('resize', this.resize);
  },

  toggleIntentOpen (evt) {
    evt.preventDefault();
    if (this.state.intentOpen) {
      this.setState({
        intentOpen: false,
        isOpen: false
      })
    } else {
      this.setState({
        intentOpen: true,
        isOpen: true
      });
    }
  },

  render() {
    var activeClass = this.state.isOpen ? 'active' : '';
    return (
      <DocumentTitle title="KoBo">
        <div id="page-wrapper" className={activeClass}>
          <Sidebar toggleIntentOpen={this.toggleIntentOpen.bind(this)} />
          <PageHeader ref="page-header" />
          <div className="panel-wrap--right-spaced">
            <RouteHandler />
          </div>
          <AssetNavigator />
        </div>
      </DocumentTitle>
    )
  }
});

class PublicContentBox extends React.Component {
  render () {
    return (
        <div>
          <p>You are not logged in</p>
        </div>
      );
  }
}

class ContentBox extends React.Component {
  render () {
    return (
        <div id="content-wrapper" className="page-content contentbox row">
          <div className="row">
            <AssetCollectionsContainer source="/collections/?parent=" itemname='collections' />
          </div>
        </div>
      )
  }
}

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

class RecentHistoryDropdown extends RecentHistoryDropdownBase {
  componentDidMount () {
    this.listenTo(historyStore, this.historyStoreChange);
  }

  historyStoreChange (history) {
    this.setState({
      items: history
    });
  }

  getList () {
    return this.state.items;
  }

  renderEmptyList () {
    return (
      <ItemDropdown iconKls={classNames('fa',
                                        'fa-clock-o',
                                        'k-history',
                                        'k-history--empty')}>
        <li className="dropdown-header">
          {t('no recent items')}
        </li>
      </ItemDropdown>
    );
  }
  render () {
    var list = this.getList();
    if (list.length === 0) {
      return this.renderEmptyList();
    }

    return (
      <ItemDropdown iconKls={classNames('fa', 'fa-clock-o', 'k-history')}>
        <ItemDropdownHeader>{t('recent items')} - ({list.length})</ItemDropdownHeader>
        <ItemDropdownDivider />
        {list.map((item)=> {
          var iconKls = item.kind === 'collection' ? 'fa-folder-o' : 'fa-file-o';
          return <ItemDropdownItem key={item.uid} faIcon={iconKls} {...item} />
        })}
      </ItemDropdown>
      );
  }
}

class ItemDropdownItem extends React.Component {
  render () {
    return (
          <li>
            <Link to="form-view"
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

class LoginForm extends React.Component {
  done (...args) {
    log(args, this)
  }

  fail (...args) {
    log(args, this);
  }

  handleSubmit (evt) {
    evt.preventDefault();
    var username = this.refs.username.getDOMNode().value;
    var password = this.refs.password.getDOMNode().value;
    actions.auth.login({
      username: username,
      password: password
    });
  }
  render () {
    return (
      <div className="col-md-4 pull-right">
        <form action="/api-auth/login/" className="form-inline" onSubmit={this.handleSubmit}>
          <div className="form-group">
            <input type="text" ref="username" placeholder="username" className="form-control input-sm" />
            <input type="password" ref="password" placeholder="password" className="form-control input-sm" />
            <button type="submit" className="btn btn-default btn-small">{t('log in')}</button>
          </div>
        </form>
      </div>
      );
  }
}


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
})

class LiDropdown extends React.Component {
  render () {
    return (
        <li className='dropdown'>
          <a aria-expanded='false' role='button' data-toggle='dropdown' className='dropdown-toggle' href='#'>Dropdown <span className='caret'></span></a>
          <ul role='menu' className='dropdown-menu'>
            <LiLink>Action</LiLink>
            <LiLink>Another action</LiLink>
            <LiLink>Something else here</LiLink>
            <li className='divider'></li>
            <LiLink>Separated link</LiLink>
            <li className='divider'></li>
            <LiLink>One more separated link</LiLink>
          </ul>
        </li>
      )
  }
}

var Breadcrumb = React.createClass({
  mixins: [
    Reflux.ListenerMixin,
    Navigation,
    ],
  getInitialState () {
    var _items = this.context.router.getCurrentRoutes().map(function(r){
      if (!r.name) {
        log('noname breadcrumb ', r);
      }
      return {
        name: r.name,
        href: '#' + r.path
      };
    });
    return {
      items: _items
    }
  },
  render () {
    return (
        <ul className="k-breadcrumb">
          {
            this.state.items.map((item)=> {
              return <li><a href={item.href}>{item.name}</a></li>;
            })
          }
        </ul>
      );
  }
});

var actions = require('./actions')

actions.misc.checkUsername.listen(function(username){
  sessionDispatch.queryUserExistence(username)
    .done(actions.misc.checkUsername.completed)
    .fail(actions.misc.checkUsername.failed_);
});

actions.resources.updateAsset.listen(function(uid, values){
  log(uid, values);
  sessionDispatch.patchAsset(uid, values)
    .done(actions.resources.updateAsset.completed)
})
actions.resources.createResource.listen(function(details){
  sessionDispatch.createResource(details)
    .done(actions.resources.createResource.completed)
    .fail(actions.resources.createResource.failed);
})

actions.search.assets.listen(function(queryString){
  sessionDispatch.searchAssets(queryString)
    .done(function(...args){
      actions.search.assets.completed.apply(this, [queryString, ...args])
    })
    .fail(function(...args){
      actions.search.assets.failed.apply(this, [queryString, ...args])
    })
});

actions.search.tags.listen(function(queryString){
  sessionDispatch.searchTags(queryString)
    .done(actions.search.searchTags.completed)
    .fail(actions.search.searchTags.failed)
});

actions.permissions.assignPerm.listen(function(creds){
  sessionDispatch.assignPerm(creds)
    .done(actions.permissions.assignPerm.completed)
    .fail(actions.permissions.assignPerm.failed);
});

var permissionStore = Reflux.createStore({
  init () {
    this.assets = {};
    this.listenTo(actions.permissions.assignPerm.completed, this.onAssignPermissionCompleted);
    this.listenTo(actions.resources.loadAsset.completed, this.onLoadAsset);
  },
  onAssignPermissionCompleted (assetPerms) {
    this.assets['assetPerms.uid'] = assetPerms;
    this.trigger(this.assets, 'assetPerms.uid', assetPerms);
  },
  onLoadAsset (asset) {
    var assetPerms = asset.permissions;
    this.assets[asset.uid] = assetPerms;
    this.trigger(this.assets, asset.uid, assetPerms);
  }
})

var sessionDispatch;
(function(){
  var $ajax = (o)=> {
    return $.ajax(assign({}, {dataType: 'json', method: 'GET'}, o));
  };
  const assetMapping = {
    'a': 'assets',
    'c': 'collections',
    'p': 'permissions',
  }
  assign(this, {
    selfProfile: ()=> $ajax({ url: '/me/' }),
    queryUserExistence: (username)=> {
      var d = new $.Deferred();
      $ajax({ url: `/users/${username}/` })
        .done(()=>{ d.resolve(username, true); })
        .fail(()=>{ d.reject(username, false); });
      return d.promise();
    },
    logout: ()=> {
      var d = new $.Deferred();
      $ajax({ url: '/api-auth/logout/' }).done(d.resolve).fail(function (resp, etype, emessage) {
        // logout request wasn't successful, but may have logged the user out
        // querying '/me/' can confirm if we have logged out.
        sessionDispatch.selfProfile().done(function(data){
          if (data.message == "user is not logged in") {
            d.resolve(data);
          } else {
            d.fail(data);
          }
        }).fail(d.fail);
      });
      return d.promise();
    },
    listAllAssets () {
      var d = new $.Deferred();
      $.when($.getJSON('/assets/?parent='), $.getJSON('/collections/?parent=')).done(function(assetR, collectionR){
        var assets = assetR[0],
            collections = collectionR[0];
        var r = {results:[]};
        var pushItem = function (item){r.results.push(item)};
        assets.results.forEach(pushItem);
        collections.results.forEach(pushItem);
        var sortAtt = 'date_modified'
        r.results.sort(function(a,b){
          var ad = a[sortAtt], bd = b[sortAtt];
          return (ad === bd) ? 0 : ((ad > bd) ? -1 : 1);
        });
        d.resolve(r);
      }).fail(d.fail);
      return d.promise();
    },
    assignPerm (creds) {
      var id = creds.uid || creds.id;
      var url = `/${creds.kind}/${creds.id}/permissions/`
      log("sessionDispatch.assignPerm(", creds, ")");
      return $.getJSON(url);
    },
    getAssetContent ({id}) {
      return $.getJSON(`/assets/${id}/content/`);
    },
    getAsset ({id}) {
      return $.getJSON(`/assets/${id}/`);
    },
    searchAssets (queryString) {
      return $ajax({
        url: '/assets/',
        data: {
          q: queryString
        }
      });
    },
    createResource (details) {
      return $ajax({
        method: 'POST',
        url: '/assets/',
        data: details
      });
    },
    patchAsset (uid, data) {
      return $ajax({
        url: `/assets/${uid}/`,
        method: 'PATCH',
        data: data
      });
    },
    getCollection ({id}) {
      return $.getJSON(`/collections/${id}/`);
    },
    getResource ({id}) {
      // how can we avoid pulling asset type from the 1st character of the uid?
      var assetType = assetMapping[id[0]];
      return $.getJSON(`/${assetType}/${id}/`);
    },
    login: (creds)=> {
      return $ajax({ url: '/api-auth/login/?next=/me/', data: creds, method: 'POST'});
    }
  });
}).call(sessionDispatch={});

actions.auth.login.listen(function(creds){
  sessionDispatch.login(creds).done(function(){
    sessionDispatch.selfProfile().done(actions.auth.login.completed)
        .fail(function(){
          console.error('login failed what sould we do now?');
        });
  })
    .fail(actions.auth.logout.failed);
});

// reload so a new csrf token is issued
actions.auth.logout.completed.listen(function(){
  window.setTimeout(function(){
    window.location.replace('', '');
  }, 1000);
});

actions.auth.logout.listen(function(){
  sessionDispatch.logout().done(actions.auth.logout.completed).fail(function(){
    console.error('logout failed for some reason. what should happen now?');
  });
})

actions.resources.loadAsset.listen(function(params){
  var dispatchMethodName = {
    c: 'getCollection',
    a: 'getAsset'
  }[params.id[0]];

  sessionDispatch[dispatchMethodName](params)
      .done(actions.resources.loadAsset.completed)
      .fail(actions.resources.loadAsset.failed)
});

actions.resources.loadAsset.completed.listen(function(asset){
  actions.navigation.historyPush(asset);
});

actions.resources.loadAssetContent.listen(function(params){
  sessionDispatch.getAssetContent(params)
      .done(function(data, ...args) {
        // data.sheeted = new Sheeted([['survey', 'choices', 'settings'], data.data])
        actions.resources.loadAssetContent.completed(data, ...args);
      })
      .fail(actions.resources.loadAssetContent.failed)
});

actions.resources.listAssets.listen(function(){
  sessionDispatch.listAllAssets()
      .done(actions.resources.listAssets.completed)
      .fail(actions.resources.listAssets.failed)
})

// this didn't work. logins were not consistent from one tab to the next
// actions.auth.verifyLogin.listen(function(){
//   sessionDispatch.selfProfile().then(function success(acct){
//     if (acct.username) {
//       log('sessionStore', sessionStore);
//     } else {
//       log('sessionStore', sessionStore.currentAccount);
//     }
//   })
// })


var assetContentStore = Reflux.createStore({
  init: function () {
    this.data = {};
    this.surveys = {};
    this.listenTo(actions.resources.loadAssetContent.completed, this.onLoadAssetContentCompleted);
  },
  getSurvey: function (assetId) {
    return this.surveys[assetId];
  },
  onLoadAssetContentCompleted: function(resp, req, jqxhr) {
    if (!resp.uid) {
      throw new Error('no uid found in response');
    }
    this.data[resp.uid] = resp;
    try {
      this.surveys[resp.uid] = dkobo_xlform.model.Survey.loadDict(resp.data)
    } catch (e) {
      this.surveys[resp.uid] = {error: e}
    }
    this.trigger(this.data, resp.uid);
  }
});

var assetStore = Reflux.createStore({
  init: function () {
    this.data = {};
    // log('listening to actions.resources.loadAsset.completed');
    this.listenTo(actions.resources.loadAsset.completed, this.onLoadAssetCompleted)
  },
  onLoadAssetCompleted: function (resp, req, jqxhr) {
    log('asset load komplete');
    if (!resp.uid) {
      throw new Error('no uid found in response');
    }
    this.data[resp.uid] = resp;
    this.trigger(this.data, resp.uid);
  }
});

var sessionStore = Reflux.createStore({
  init () {
    this.listenTo(actions.auth.login.completed, this.onAuthLoginCompleted);
    var _this = this;
    sessionDispatch.selfProfile().then(function success(acct){
      actions.auth.login.completed(acct);
    });
  },
  getInitialState () {
    return {
      isLoggedIn: false
    }
  },
  onAuthLoginCompleted (acct) {
    this.currentAccount = acct;
  }
});

const MAX_SEARCH_AGE = (5 * 60) // seconds

var tagStore = Reflux.createStore({
  init () {
    this.queries = {};
    this.listenTo(actions.search.tags.completed, this.onTagSearch);
  },
  getRecentSearch (queryString) {
    if (queryString in this.queries) {
      var age = new Date().getTime() - this.queries[queryString][1].getTime();
      if (age < MAX_SEARCH_AGE * 1000) {
        return this.queries[queryString][0];
      }
    }
    return false;
  },
  onTagSearch (queryString, results) {

  }
});

var assetSearchStore = Reflux.createStore({
  init () {
    this.queries = {};
    this.listenTo(actions.search.assets.completed, this.onAssetSearch);
  },
  getRecentSearch (queryString) {
    if (queryString in this.queries) {
      var age = new Date().getTime() - this.queries[queryString][1].getTime();
      if (age < MAX_SEARCH_AGE * 1000) {
        return this.queries[queryString][0];
      }
    }
    return false;
  },
  onAssetSearch (queryString, results) {
    results.query=queryString;
    this.queries[queryString] = [results, new Date()];
    if(results.count > 0) {
      this.trigger(results);
    }
  }
});

var tagSearchStore = Reflux.createStore({
  init () {
    this.queries = {};
  }
});

var PageHeader = React.createClass({
  mixins: [
    Navigation,
    Reflux.ListenerMixin,
    Reflux.connect(sessionStore, "isLoggedIn"),
    Reflux.connectFilter(assetSearchStore, 'searchResults', function(results){
      if (this.searchFieldValue() === results.query) {
        return results;
      }
    })
  ],
  componentDidMount () {
    this.listenTo(actions.auth.login, this.onAuthLogin);
    this.listenTo(actions.auth.login.completed, this.onAuthLoginCompleted);
    this.listenTo(actions.auth.logout, this.onAuthLogout);
    this.listenTo(actions.auth.logout.completed, this.onAuthLogoutCompleted);
  },
  onAuthLogin () {
    this.setState({
      loginStatus: 'pending'
    });
  },
  onAuthLoginCompleted (meData) {
    this.setState(assign({
      loginStatus: 'complete'
    }, meData));
  },
  onAuthLogout () {
    this.setState({
      loginStatus: 'pending',
    })
  },
  onAuthLogoutCompleted () {
    this.setState({
      loginStatus: 'complete',
      username: false
    });
  },
  login () {
    actions.auth.login({username: 'me'});
  },
  logout () {
    actions.auth.logout();
  },
  handleSubmit (evt) {
    evt.preventDefault();
    var username = this.refs.username.getDOMNode().value;
    var password = this.refs.password.getDOMNode().value;
    actions.auth.login({username, password});
  },
  _userInfo () {
    if (!this.__userInfo) {
      if (!this.state.username) {
        return;
      }
      this.__userInfo = (
        <div className="user pull-right">
          <div className="item dropdown">
            <UserIcon img={this.state.gravatar} />
            <UserDropdown username={this.state.username} />
          </div>
          {/*
          <RecentHistoryDropdown />
          */}
        </div>
      );
    }
    return this.__userInfo;
  },
  _loginForm () {
    if (! this.__loginForm) {
      this.__loginForm = (
            <form role='login' className='navbar-form navbar-right k-pw-bar'
                  action='/accounts/login/'
                  onSubmit={this.handleSubmit}>
              <div className='form-group'>
                <input ref='username' type='text' placeholder='username' className='form-control' />
                <input ref='password' type='password' placeholder='password' className='form-control' />
                <button className='k-table-cell btn btn-default' type='submit'>{t('submit')}</button>
              </div>
            </form>
        );
    }
    return this.__loginForm;
  },
  searchFieldValue () {
    return this.refs.headerSearch.refs.inp.getDOMNode().value;
  },
  liveSearch () {
    var queryInput = this.searchFieldValue(),
      r;
    if (queryInput && queryInput.length > 2) {
      if (r = assetSearchStore.getRecentSearch(queryInput)) {
        this.setState({
          searchResults: r
        });
      } else {
        actions.search.assets(queryInput);
      }
    }
  },
  renderSearch () {
    return (
        <SmallInputBox ref="headerSearch" placeholder={t('search keywords or tags')} onKeyUp={this.liveSearch} />
      );
  },

  renderSearchItem (item) {
    return (
        <li>
          <pre>
            {JSON.stringify(item, null, 4)}
          </pre>
        </li>
        );

  },
  renderSearchResults () {
    var res = this.state.searchResults;
    if (res) {
      return (
        <div className="popover fade bottom in" role="tooltip">
          <div className="arrow"></div>
          <h3 className="popover-title">
            Search Results 
            <em>{res.query}</em>
            &nbsp;&ndash;&nbsp;
            ({res.count})
          </h3>
          <div className="popover-content">
            <ul>
              {res.results.map(this.renderSearchItem)}
            </ul>
          </div>
        </div>
          );
    }
  },
  render () {
    var isLoggedIn = this.state.isLoggedIn;
    var _li = this.state.isLoggedIn && !this.state.username;
    var _pending = this.state.loginStatus === 'pending';

    var buttonKls = classNames("btn", "btn-small", "btn-default");
    log("this ", Navigation);

    var headerSearch = false;

    return (
        <div className="row header">
          <div className="col-xs-12">
            <div className="meta pull-left" style={{marginTop: '11px'}}>
              <div className={classNames('btn-group')}>
                <Link to='new-form' className='btn btn-circle btn-default'>
                  <i className='fa fa-plus' />
                </Link>
              </div>
            </div>
            {/*
              <LiLink active href="" sr-only={'(current)'}>{t('link')}</LiLink>
              <LiDropdown sr-only />
            */}
            <div className="pull-right k-user-details">
              {_pending || (this.state.username ? this._userInfo() : this._loginForm()) }
              {_pending ? <NavBarIcon icon="fa-spinner fa-spin fa-2x" title={this.state.loginStats} /> : '' }
              <MeViewer />
            </div>
            { headerSearch ? 
              <div className="pull-right k-search">
                {this.renderSearch()}
                {this.renderSearchResults()}
              </div>
            :'' }
          </div>
        </div>
      )
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

class Dashboard extends React.Component {
  render() {
    return (
      <p className="hushed">dashboard</p>
    );
  }
}
class ListForms extends React.Component {
  render () {
    return (
      <p className="hushed">ListForms</p>
    );
  }
}

const MAX_FILE_SIZE = 2500000;

class UploadFile {
  constructor (item) {
    this.item = item;
  }
  read (callback) {
    if (this.readerProm) {
      return this.readerProm;
    }
    var p = new $.Deferred()
    var reader  = new FileReader();
    var that = this;
    if (this.item.size > MAX_FILE_SIZE) {
      p.reject('file too big');
    }
    reader.onloadend = function () {
      typeof callback === 'function' && callback(reader.result);
      that.data = reader.result;
      p.resolve(reader.result);
    }

    if (this.item) {
      reader.readAsDataURL(this.item);
    }
    this.readerProm = p;
    return this.readerProm.promise();
  }
}

function processFile(item, n) {
  return new UploadFile(item);
}
var Home = React.createClass({
  mixins: [
    Navigation
  ],
  componentDidMount () {
    log(this);
  },
  statics: {
    willTransitionTo (transition) {
      transition.redirect('forms')
    }
  },
  onDrop (fileList) {
    this.fileList = fileList.map((i) => new UploadFile(i) );
    this.setState({
      uploads: this.fileList
    });
    window.files = this.fileList;
  },
  render () {
    return (
      <Panel>
        <h1>Home</h1>
        <hr />
        Please log in and click "forms"
      </Panel>
      );
  }
});

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
      )
  }
}

var AssetRow = React.createClass({
  render () {
    var icon = <StackedIcon size='lg' frontIcon='question' />;
    if (this.props.kind === 'collection') {
      icon = <StackedIcon className='icon--collection' size='2x' frontIcon='folder-o' />;
    } else if(this.props.kind === 'asset') {
      icon = <StackedIcon className='icon--asset' size='2x' frontIcon='file-o' />;
    }
    var currentUsername = sessionStore.currentAccount && sessionStore.currentAccount.username
    var selfOwned = this.props.owner__username == currentUsername;
    var perm = parsePermissions(this.props.owner, this.props.permissions);

    return <li className="list-group-item asset-row">
        <Link to="form-view" params={{assetid: this.props.uid}}>
          <div className="pull-left">
            {icon}
          </div>
          <div>
            {this.props.name || t('no name')}
            <br />
            <span className="date date--modified">{formatTime(this.props.date_modified)}</span>
          </div>
          <div>
            {
              selfOwned ?
                '' :
                <UserProfileLink icon='user' iconBefore='true' username={this.props.owner__username} />
            }
          </div>
          <div>
            <PermissionsEditor perms={perm} />
          </div>
        </Link>
      </li>
  }
})

var allAssetsStore = Reflux.createStore({
  init: function () {
    this.data = {};
    this.listenTo(actions.resources.listAssets.completed, this.onListAssetsCompleted);
  },
  onListAssetsCompleted: function(resp, req, jqxhr) {
    this.data = resp.results;
    this.trigger(this.data);
  }
});

var Forms = React.createClass({
  mixins: [
    Reflux.connect(allAssetsStore, "results")
  ],
  getInitialState () {
    return {
      results: false
    }
  },
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      actions.resources.listAssets();
      callback();
    }
  },
  render () {
    if (!this.state.results) {
      return (
          <Panel>
            <i className='fa fa-spinner fa-spin' />
            &nbsp;
            {t('loading...')}
          </Panel>
        );
    }
    return (
      <Panel>
        <ul className="collection-asset-list list-group">
          {this.state.results.map((resource) => {
            return <AssetRow key={resource.uid} {...resource} />
          })}
        </ul>
        <RouteHandler />
      </Panel>
      );
  }
});

// no shown atm
var CollectionAssetsList = React.createClass({
  mixins: [
    Navigation,
    Reflux.connectFilter(assetStore, 'assett', function(data){
      log('ok asseet 3 CollectionAssetsList')

      var assetid = this.props.params.assetid;
      return data[assetid];
    })
  ],
  componentDidMount () {
    this.transitionTo('form-list');
  },
  render () {
    // log('collection chilxs', this.state, this.props);
    // var children = (this.props.children || []).map((sa, i)=> <CollectionAssetItem key={sa.uid} asset={sa} /> )

    var children = <span>blah</span>;
    return (
      <ul className="list-group collection-asset-list">
        {children}
      </ul>
      );
  }
});

var LargeLink = React.createClass({
  mixins: [Navigation],
  routeTo (rtTo) {
    this.transitionTo(rtTo);
  },
  render () {
    return (
      <div className={t('col-lg-' + this.props.colspan + ' col-md-6 col-xs-12')}>
        <div className="widget">
          <div className="widget-body" onClick={(evt)=> this.routeTo(this.props.to) }>
            <div className={'widget-icon pull-left ' + this.props.color}>
              <i className={'fa fa-' + this.props.icon}></i>
            </div>
            <div className="widget-content pull-left">
              <div className="title">{this.props.big}</div>
              <div className="comment">{this.props.little}</div>
            </div>
            <div className="clearfix"></div>
          </div>
        </div>
      </div>
      );
  }
});

class Libraries extends React.Component {
  render () {
    return (
      <Panel>
        <h1 className="page-header">
          Libraries
        </h1>
      </Panel>
      );
  }
}

// <BuilderBar />
class Public extends React.Component {
  render () {
    return (
      <div>
        <p>Public</p>
      </div>
      );
  }
}

function stringifyRoutes(contextRouter) {
  return JSON.stringify(contextRouter.getCurrentRoutes().map(function(r){
    return {
      name: r.name,
      href: r.path
    };
  }), null, 4)
}

var Builder = React.createClass({
  mixins: [Navigation],
  render () {
    var _routes = stringifyRoutes(this.context.router);
    return (
      <Panel>
        <h1 className="page-header">Builder</h1>
        <hr />
        <pre>
          <code>
            {_routes}
            <hr />
            {JSON.stringify(this.context.router.getCurrentParams(), null, 4)}
          </code>
        </pre>
      </Panel>
      );
  }
});

class PermissionsUser extends React.Component {
  render () {
    return (
        <tr>
          <td>User</td>
          <td>Permission</td>
        </tr>
      );
  }
}
class PermissionsTable extends React.Component {
  render () {
    let permissionRows = [].map((item)=> { return (<PermissionsUser {...item} />); } )
    return (
      <table>
        <tr>
          <th>User</th>
          <th>Permissions</th>
        </tr>
        {permissionRows}
      </table>
      );
  }
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
class PermissionsList extends React.Component {
  render () {
    var perms = parsePermissions(this.props.owner, this.props.permissions);
    return (
        <PermissionsEditor perms={perms} />
        )
  }
}
class CollectionAssetItem extends React.Component {
  render () {
    var asset = this.props.asset;
    var asset_icon = (asset.assetType === 'collection') ? 
      <i className="fa fa-folder" /> :
      <i className="fa fa-file-o" />;

    return (
        <li className="list-group-item">
          <Link to="form-view" params={{assetid: asset.uid}}>
            {asset_icon} - {asset.name || <em>no name</em>}
          </Link>
        </li>
      );
  }
}
class BigIcon extends React.Component {
  render () {
    var okls = classNames('k-icon-wrap',
                          'pull-left',
                          `k-icon-wrap--${this.props.color}`),
        ikls = classNames('fa',
                          'k-expanded',
                          `fa-${this.props.type}`)

    if (this.props.to) {
      return (
        <Link to={this.props.to} params={this.props.params}>
          <div className={okls} onClick={this.props.onClick}>
            <i className={ikls} />
          </div>
        </Link>
        );

    }
    return (
      <div className={okls} onClick={this.props.onClick}>
        <i className={ikls} />
      </div>
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

class PreviewButtons extends React.Component {
  render () {
    var title = 'there are no available previews';
    var links = this.props.embeds.map((link) => {
      return assign({
        code: `preview.${this.props.kind}.${link.format}`
      }, link);
    })
    return (
      <ButtonGroup href="#"
                    links={links}
                    kind={this.props.kind}
                    disabled={links.length === 0}
                    icon="eye"
                    title={t('preview')} />
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

// subclassed, shown
var AssetCollectionBase = React.createClass({
  mixins: [
    Navigation,
    Reflux.connectFilter(assetStore, function(data){
      log('ok asseet 1 AssetCollectionBase')
      return data[this.props.uid];
    }),
    React.addons.LinkedStateMixin
  ],
  getInitialState () {
    return {}
  },
  componentDidMount () {
    log(this.props);
  },
  renderLoadingScreen () {
    return (
        <Panel width="10" offset="1">
          <i className='fa fa-spinner fa-spin' />
          &nbsp;
          {t('loading')}
        </Panel>
      );
  },
  renderHeader () {
    return (
          <h4>
            {this.state.name}
            &nbsp;
            <br />
            <small>
              <UserProfileLink
                    username={this.state.owner__username}
                    icon="user"
                  />
            </small>
          </h4>
      );
  },
  renderIcon (iconProps) {
    return (
          <BigIcon to={'form-view'} params={{assetid: this.props.uid}} {...iconProps} />
      );
  },
  renderCloseButton () {
    return (
          <div className="btn-group">
            <CloseButton
                to="forms"
                title={t('close')}
                className="btn btn-default"
                />
          </div>
      );
  },
  renderTimes () {
    return (
          <p className="col-md-12 text-right">
            <span className="text-muted date date--created">
             {t('created')}
             &nbsp;
             <MomentTime time={this.state.date_created} />
            </span>
            &nbsp;&mdash;&nbsp;
            <span className="text-muted date date--modified">
             {t('last edited')}
             &nbsp;
             <MomentTime time={this.state.date_modified} />
            </span>
          </p>
      );
  },
  renderTag (tag, i) {
    var kls, _root, _split = tag.split(':');
    if (_split.length > 1) {
      [_root, tag] = _split;
      kls = classNames('tag', 'tag--namespaced', `tag--${_root}`);
      return <span className={kls}>{tag}</span>;
    } else {
      kls = classNames('tag', 'tag--basic');
      return <span className={kls}>{tag}</span>;
    }
  },
  tagsChanged (tagList) {
    actions.resources.updateAsset(this.state.uid, {
      tags: tagList
    });
  },
  renderTags () {
    var valueLink = this.linkState('tags');
    var handleChange = (tags)=> {
      this.tagsChanged(tags);
      valueLink.requestChange(tags);
    };

    return (
        <div className='k-tags-wrap'>
          <TagsInput ref="tags"
                      classNamespace="k"
                      onChange={handleChange}
                      value={valueLink.value}
                    />
        </div>
      );
  },
  render () {
    if (!this.state.uid) {
      return this.renderLoadingScreen();
    } else {
      return this.renderContent();
    }
  }
});

class CollectionPage extends AssetCollectionBase {
  renderButtons () {
    return (
          <div className="btn-toolbar pull-right">
            <SharingButton {...{uid: this.state.uid}} />
            <DownloadButtons kind={this.state.kind} uid={this.state.uid} downloads={this.state.downloads} />
            {this.renderCloseButton()}
          </div>
      );
  }

  renderContent () {
    return (
          <Panel>
            {this.renderIcon({color: 'green', type: 'folder', overlay: 'users'})}
            {this.renderButtons()}
            {this.renderTimes()}
            {this.renderHeader()}
            {this.props.children}
          </Panel>
      );
  }
}

class AssetPage extends AssetCollectionBase {
  renderHeader () {
    return (
          <h4>
            {this.state.name}
            &nbsp;
            {this.renderTags()}
            <br />
            <small>
              <UserProfileLink username={this.state.owner__username}
                                icon="user" />
            </small>
          </h4>
      );
  }

  renderButtons () {
    return (
          <div className="btn-toolbar pull-right">
            <EditButton {...{uid: this.state.uid}} />
            <SharingButton {...{uid: this.state.uid}} />
            <PreviewButtons {...this.state} />
            <DownloadButtons {...this.state} /> 
            <div className="btn-group">
              <CloseButton
                  to="forms"
                  title={t('close')}
                  className="btn btn-default"
                  />
            </div>
          </div>
      );
  }
  renderContent () {
    return (
          <Panel>
            {this.renderIcon({color: 'blue', type: 'file-o', overlay: 'users'})}
            {this.renderButtons()}
            {this.renderTimes()}
            {this.renderHeader()}
            <div className='row'>
              <p className='col-md-12'>
                {this.renderTags()}
              </p>
            </div>
            { this.props.survey ?
              <SurveyPreview key={this.props.uid} survey={this.props.survey} />
            : null }

            {this.props.children}
          </Panel>
      );
  }
}

var SurveyRow = React.createClass({
  renderNote () {

  },
  renderLabel () {

  },
  renderItem () {
    var item = this.props.item;
    return (
      <div className="cell">
        <div className="cell__icon">
          <span>{item.getValue('type')}</span>
        </div>
        <div className="cell__label">
          <span>{item.getValue('label')}</span>
        </div>
      </div>
      );
  },
  render () {
    return (
        <div>
          {this.renderItem()}
        </div>
      );
  }
});

var SurveyGroup = React.createClass({
  render () {
    return (
        <div>
          SurveyGroup
        </div>
      );
  }
});

var SurveyPreview = React.createClass({
  render () {
    window._s = this.props.survey;
    // log(this.props.survey);
    var survey = this.props.survey;
    log('here', survey);
    return (
        <div>
          <h3>SurveyPreview</h3>
          <hr />
          <div>
            {this.props.survey.rows.models.map((r, i)=> {
              return <SurveyRow key={r.cid} item={r} />
            })}
          </div>
        </div>
      );
  }
})

// class PreviewButton extends React.Component {
//   render () {
//     return <div className="btn-group">
//               <Link to="form-preview-enketo"
//                       params={{assetid: this.props.uid}}
//                       className="btn btn-default"
//                       data-toggle="tooltip"
//                       title=""
//                       data-placement="bottom"
//                       data-original-title="tewltip">
//                 {t('preview')}
//                 &nbsp;
//                 &nbsp;
//                 <i className='fa fa-lg fa-eye' />
//               </Link>
//           </div>;
//   }
// }
class EditButton extends React.Component {
  render () {
    return <div className="btn-group">
              <Link to="form-editor"
                      params={{assetid: this.props.uid}}
                      className="btn btn-default"
                      data-toggle="tooltip"
                      title=""
                      data-placement="bottom"
                      data-original-title="tewltip">
                {t('edit')}
                &nbsp;
                &nbsp;
                <i className='fa fa-lg fa-pencil' />
              </Link>
          </div>;
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

var DocumentTitle = require('react-document-title');

var FormView = React.createClass({
  mixins: [
    Navigation,
    Reflux.connectFilter(assetContentStore, function(data){
      var assetid = this.props.params.assetid;
      if (assetid in data) {
        return {
          survey: assetContentStore.getSurvey(assetid),
          data: data[assetid]
        };
      }
    })
  ],
  getInitialState () {
    return {};
  },
  statics: {
    willTransitionTo (transition, params, idk, callback) {
      if (params.assetid[0] == 'a') {
        actions.resources.loadAssetContent({id: params.assetid});
      }
      callback();
    }
  },
  getInitialState () {
    return {};
  },
  componentWillMount () {

  },
  componentDidMount () {

  },
  render () {
    return (
        <div>
          asdf
        </div>
      )
  }
})

var FormPage = React.createClass({
  mixins: [
    Navigation
  ],
  getInitialState () {
    return {};
  },
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      actions.resources.loadAsset({id: params.assetid});
      callback();
    }
  },
  componentWillMount () {
    var kind = {
        a: 'asset',
        c: 'collection'
      }[this.props.params.assetid[0]];
    this.setState({
      kind: kind
    });
  },
  // componentWillReceiveProps (props) {
  //   log("WILL RECV PROPS");
  //   if (this.props.params.assetid !== props.params.assetid) {
  //     log("replacingstate because assetid changed");
  //     this.setState(this.getInitialState());
  //   }
  // },
  render () {
    var uid = this.props.params.assetid;
    return ({
      collection: () => {
        return (
            <CollectionPage key={uid} uid={uid} {...this.state}>
              <RouteHandler />
            </CollectionPage>
          );
      },

      asset: () => {
        return (
            <AssetPage key={uid} uid={uid} {...this.state}>
              <RouteHandler />
            </AssetPage>
          );
      }
    }[this.state.kind])();
  }
});

class FormNotFound extends React.Component {
  render () {
    return (
      <p> Form Not found :( </p>
      )
  }
}

class Panel extends React.Component {
  render () {
    var width = this.props.width || "12";
    var offset = this.props.offset;
    var widthClassName = classNames(`col-lg-${width}`, offset ? `col-lg-offset-${offset}` : '')
    return (
      <div className={classNames('row', this.props.className ? this.props.className : '')}>
        <div className={widthClassName}>
          <div className="panel panel-default">
            <div className="panel-body">
              {this.props.children}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

class UserList extends React.Component {
  componentDidMount () {

  }
  render () {
    return (
        <Panel>
          <h1>{t('users')}</h1>
          <hr />
          <p>Users</p>
        </Panel>
      );
  }
}

class ProfileSection extends React.Component {
  render () {
    return (
        <div className="well">
          <h3 className="page-header">{this.props.title}</h3>
          <div className="well-content">
            {this.props.children}
          </div>
        </div>
      );
  }
}

class UserProfile extends React.Component {
  render () {
    var username = this.props.username;
    return (
        <Panel>
          <h1>{t('user')}: {username}</h1>
          <hr />
          <ProfileSection title={t('my forms shared with user')}>
            <p>There are no forms shared with this user?</p>
          </ProfileSection>
          <ProfileSection title={t('public forms')}>
            <p>This user has no public forms</p>
          </ProfileSection>
        </Panel>
      );
  }
}

var SelfProfile = React.createClass({
  render () {
    return <Panel>
      Your Profile
    </Panel>
  }
});


class SectionNotFound extends React.Component {
  render () {
    return <div>
      Section Not Found
    </div>
  }
}

class Modal extends React.Component {
  backdropClick (evt) {
    if (evt.currentTarget === evt.target) {
      this.props.onClose.call(evt);
    }
  }
  renderTitle () {
    if (this.props.small) {
      return (
          <div>
            <h4 className="modal-title">
              {this.props.title}
            </h4>
            <h6>
              {this.props.small}
            </h6>
          </div>
        );
    } else {
      return (
          <h4 className="modal-title">
            {this.props.title}
          </h4>
        );
    }
  }
  render () {
    return <div className='modal-backdrop' style={{backgroundColor: 'rgba(0,0,0,0.3)'}} onClick={this.backdropClick.bind(this)}>
            <div className={this.props.open ? 'modal-open' : 'modal'}>
              <div className="modal-dialog k-modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-hidden="true" onClick={this.props.onClose}>×</button>
                    {this.renderTitle()}
                  </div>
                  {this.props.children}
                </div>
              </div>
            </div>
          </div>;
  }
}
class ModalFooter extends React.Component {
  render () {
    return <div className="modal-footer">{this.props.children}</div>;
  }
}
Modal.Footer = ModalFooter;
class ModalBody extends React.Component {
  render () {
    return <div className="modal-body">{this.props.children}</div>;
  }
}
Modal.Body = ModalBody;

var PreviewSubresource = React.createClass({
  mixins: [Navigation],
  getInitialState () {
    return {}
  },
  loadingMessage () {
    return t('loading');
  },
  render () {
    if (this.state.htmlContent) {
      return (
          <div dangerouslySetInnerHTML={{__html:this.state.htmlContent}} />
        );
    } else if (this.state.codeContent) {
      return (
          <pre><code>{this.state.codeContent}</code></pre>
        );
    } else if (this.state.error) {
      return (
          <div>{this.state.error}</div>
        );
    } else {
      return (
          <div>{this.loadingMessage()}</div>
        );
    }
  }
});

class FormPreviewXform extends PreviewSubresource {
  componentDidMount () {
    if (!this.props.params.assetid) {
      throw new Error("No asset id")
    }
    $.ajax({
      url: `/assets/${this.props.params.assetid}/xform/`
    }).done((content)=>{
      this.setState({
        htmlContent: content
      })
    }).fail((e) => {
      this.setState({
        error: 'failed to load xform'
      })
    })
  }
}

class FormPreviewXls extends PreviewSubresource {
  componentDidMount () {
    if (!this.props.params.assetid) {
      throw new Error("No asset id")
    }
    $.ajax({
      url: `/assets/${this.props.params.assetid}/xls/`
    }).done((content)=>{
      this.setState({
        codeContent: content
      })
    }).fail((e) => {
      this.setState({
        error: 'failed to load xls'
      })
    })
  }
}

var FormEnketoPreview = React.createClass({
  mixins: [Navigation],
  routeBack () {
    var params = this.context.router.getCurrentParams();
    this.transitionTo('form-view', {assetid: params.assetid});
  },
  render () {
    var sharedUsers = [];
    return <Modal open onClose={this.routeBack} title={t('enketo preview')}>
        <Modal.Body>
          <div className='row'>
            <div className='cutout-placeholder'>
              <span>
                Enketo
                &trade;
                Preview
              </span>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button"
                    className="btn btn-default"
                    data-dismiss="modal"
                    onClick={this.routeBack}>
            {t('done')}
          </button>
        </Modal.Footer>
      </Modal>;
  }
});

var historyStore = Reflux.createStore({
  __historyKey: 'user.history',
  init () {
    if (this.__historyKey in localStorage) {
      try {
        this.history = JSON.parse(localStorage.getItem(this.__historyKey));
      } catch (e) {
        console.error("could not load history from localStorage", e);
        this.history = [];
      }
    }
    this.listenTo(actions.navigation.historyPush, this.historyPush);
    this.listenTo(actions.auth.logout.completed, this.historyClear);
  },
  historyClear () {
    localStorage.removeItem(this.__historyKey);
  },
  historyPush (item) {
    this.history = [
      item, ...this.history.filter(function(xi){ return item.uid !== xi.uid; })
    ];
    localStorage.setItem(this.__historyKey, JSON.stringify(this.history));
    this.trigger(this.history);
  }
});

var userExistsStore = Reflux.createStore({
  init () {
    this.checked = {};
    this.listenTo(actions.misc.checkUsername.completed, this.usernameExists);
    this.listenTo(actions.misc.checkUsername.failed_, this.usernameDoesntExist);
  },
  checkUsername (username) {
    if (username in this.checked) {
      return this.checked[username];
    }
  },
  usernameExists (username) {
    this.checked[username] = true;
    this.trigger(this.checked, username)
  },
  usernameDoesntExist (username) {
    log('failey');
    this.checked[username] = false;
    this.trigger(this.checked, username)
  }
});

var FormViewMixin = {};

// shown
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
          pperms: parsePermissions(asset.owner__username, asset.permissions)
        };
      }
    }),
    Reflux.ListenerMixin
  ],
  // render () {
  //   return (
  //     <Modal open title={t('manage sharing settings:')}
  //                 small={t('note: this does not control permissions to the data collected by projects')}>
  //       <ModalBody>
  //         <Panel>
  //           {t('owner')}
  //           <StackedIcon frontIcon='user' />
  //         </Panel>
  //       </ModalBody>
  //     </Modal>
  //     );
  // },
  // getInitialState() {
  //   return {};
  // },
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      actions.resources.loadAsset({id: params.assetid});
      callback();
    }
  },
  componentDidMount () {
    this.listenTo(assetStore, this.asdf);
    this.listenTo(userExistsStore, this.userExistsStoreChange);
    this.listenTo(permissionStore, this.permissionStoreChange);
  },
  asdf (abc, def) {
    log('asset sore changed', abc, def)
  },
  routeBack () {
    var params = this.context.router.getCurrentParams();
    this.transitionTo('form-view', {assetid: params.assetid});
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
  usernameFieldValue () {
    return this.refs.usernameInput.refs.inp.getDOMNode().value;
  },
  permissionStoreChange (permissions, assetId) {
    log('permission store change', permissions, assetId)
    // if (assetId === this.props.params.assetid) {
    // }
  },
  usernameCheck (evt) {
    var username = evt.target.value;
    if (username && username.length > 3) {
      var result = userExistsStore.checkUsername(username);
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
  userFormSubmit (evt) {
    evt.preventDefault();
    var username = this.usernameFieldValue();
    if (userExistsStore.checkUsername(username)) {
      actions.permissions.assignPerm({
        username: username,
        kind: 'asset',
        uid: this.props.params.assetid,
        role: 'view'
      });
    }
  },
  render () {
    var sharedUsers = [];
    var inpStatus = this.state.userInputStatus;
    if (!this.state.pperms) {
      return <i className="fa fa-spin" />;
    }
    var perms = this.state.pperms;
    var userInputKls = classNames('form-group',
                                    (inpStatus !== false) ? `has-${inpStatus}` : '');
    var btnKls = classNames('btn',
                            'btn-block',
                            'btn-sm',
                            inpStatus === 'success' ? 'btn-success' : 'hidden');
    var publicPerm = {
      'username': 'public',
      'can': {
        'view': true
      },
      icon: 'group'
    };
    log(perms);
    if (!perms) {
      return <p>loading</p>
    }
    return (
      <Modal open onClose={this.routeBack} title={t('manage sharing settings:') + '[asset name]'}
                  small={t('note: this does not control permissions to the data collected by projects')}>
        <ModalBody>
          <Panel>
            {t('owner')}
            &nbsp;
            <StackedIcon frontIcon='user' />
            &nbsp;
            <UserProfileLink username={'tinok4'} />
          </Panel>
          <Panel>
            <form onSubmit={this.userFormSubmit}>
              <div className='col-sm-9'>
                <div className={userInputKls}>
                  <SmallInputBox ref='usernameInput' placeholder={t('username')} onKeyUp={this.usernameCheck} />
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
                return <UserPermDiv ref={perm.username} {...perm} />;
              })}
            </div>
          </Panel>
          <div className='row'>
            <PublicPermDiv />
          </div>
        </ModalBody>
      </Modal>
      );
  }
});

var UserPermDiv = React.createClass({
  mixins: [
    Navigation
  ],
  setPerm (permName, value) {
    return (evt) => {
      evt.preventDefault();
      actions.permissions.assignPerm({
        user: this.props.username,
        permName: permName,
        permission: value
      });
    }
  },
  renderPerm ([permName, permPermission]) {
    var btnCls = classNames('btn',
                            'btn-sm',
                            `perm-${permName}`,
                            'btn-block',
                            ({
                              "false": "btn-default",
                              "allow": "btn-primary",
                              "deny": "btn-danger"
                            })[permPermission]);
    var oppositePerm = {
      "false": "deny",
      "deny": "allow",
      "allow": "false"
    }[permPermission];
    return (
        <div className='k-col-2-nopadd'>
          <button className={btnCls} onClick={this.setPerm(permName, oppositePerm)} data-permission-name={permName}>
            {permName}
          </button>
        </div>
      );
  },
  render () {
    var hasAnyPerms = false;
    var cans = this.props.can;
    var availPerms = ['view', 'edit', 'share'].map((permName) => {
      if ( permName in cans ) {
        if (cans[permName].deny) {
          return [permName, "deny"];
        } else if (cans[permName]) {
          return [permName, "allow"];
        }
      }
      return [permName, "false"];
    });
    var closeButtonCls = hasAnyPerms ? 'hidden' : classNames('btn', 'btn-block', 'btn-sm', 'btn-default');
    return (
      <div className='row'>
        <div className='col-md-5'>
          <UserProfileLink icon={this.props.icon || 'user-o'} iconBefore='true' username={this.props.username} />
        </div>
        {availPerms.map(this.renderPerm)}
        <div className='col-md-1'>
          <button className={closeButtonCls}>
            <i className='fa fa-times' />
          </button>
        </div>
      </div>
      );
  }
});

class PublicPermDiv extends UserPermDiv {
  setPublicPerm (val) {
    return (evt) => {
      evt.preventDefault();
      log('setting public perm to ', val);
    }
  }
  render () {
    var isOn = Math.random() > 0.5;

    var btnCls = classNames('btn',
                            isOn ? 'btn-primary' : 'btn-default',
                            'btn-block');
    return (
      <div className='row'>
        <div className='col-md-12'>
          <button className={btnCls} onClick={this.setPublicPerm(!isOn)}>
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

var FormEditor = React.createClass({
  mixins: [
    Reflux.connectFilter(assetContentStore, function(data){
      var assetid = this.props.params.assetid;
      return data[assetid];
    })
  ],
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      actions.resources.loadAssetContent({id: params.assetid});
      callback();
    // },
    // willTransitionFrom (transition, params, callback) {
    //   // component.formHasUnsavedData()
    //   if (!confirm(t('You have unsaved information, are you sure you want to leave this page?'))) {
    //     transition.cancel();
    //   }
    }
  },
  getInitialState () {
    return {
      dkobo_xlform: !!window.dkobo_xlform,
      data: false
    };
  },
  renderSurvey () {
    var xlform = window.dkobo_xlform;
    var surveyModel = new xlform.model.Survey(this.state.data);
    this._surveyApp = new xlform.view.SurveyApp({
      survey: surveyModel,
      save: function(evt){
        var survey = this.survey;
        var p = new Promise(function(resolve, reject){
          try {
            var spreadsheetStructure = survey.toSsStructure();
            resolve()
          } catch (e) {
            reject(e)
          }
        });
        p.constructor.prototype.finally = p.constructor.prototype.then;
        return p;
      }
    });
    $('.form-wrap').html(this._surveyApp.$el);
    this._surveyApp.render()
  },
  componentDidMount () {
    this.renderSurvey();
  },
  componentDidUpdate () {
    this.renderSurvey();
  },
  // componentWillUnmount () {
  //   log('component will unmount');
  // },
  render () {
    if (!this.state.data) {
      return (
          <div>
            <i className='fa fa-spinner fa-spin' />
            &nbsp;
            &nbsp;
            {t('loading')}
          </div>
        );
    }

    if (!this.state.dkobo_xlform) {
      return (
          <div>
            <i className='fa fa-spinner fa-spin' />
            &nbsp;
            &nbsp;
            {t('loading scripts')}
          </div>
        );
    }
    var content;
    return (
        <div className='form-wrap'>
        </div>
      );
  }
});


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

var NewForm = React.createClass({
  mixins: [
    Navigation
  ],
  saveNewForm (evt) {
    var name = this.refs['new-form-name'].getDOMNode().value;
    evt.preventDefault();
    actions.resources.createResource({
      name: name,
      content: "{}"
    })
  },
  getInitialState () {
    return {};
  },
  renderSaveAndPreviewButtons () {
    log('here ', this.state);
    var disabled = !!this.state.disabled;
    var saveText = t('create');
    var saveBtnKls = classNames('btn','btn-default',
                              'btn-block',
                              disabled ? 'disabled' : '');
    var previewDisabled = !!this.state.previewDisabled;
    var previewBtnKls = classNames('btn',
                                  'btn-default',
                                  'btn-block',
                                  previewDisabled ? 'disabled': '')
    return (
          <div className="pull-right k-form-actions">
            <button className={saveBtnKls} onClick={this.saveNewForm}>
              <i className={classNames('fa', 'fa-sm', 'fa-save')} />
              &nbsp;
              &nbsp;
              {saveText}
            </button>
            <button className={previewBtnKls}>
              <i className={classNames('fa', 'fa-sm', 'fa-eye')} />
              &nbsp;
              &nbsp;
              {t('preview')}
            </button>
          </div>
        );
  },
  renderSubSettingsBar () {
    var spacer = ''
    return (
        <div>
          <span className="label label-default">
            form-id
          </span>
          &nbsp;|&nbsp;
          <button className="btn btn-xs btn-default">
            {t('meta questions')}
          </button>
          &nbsp;|&nbsp;
          <button className="btn btn-xs btn-default">
            {t('group questions')}
          </button>
          &nbsp;|&nbsp;
          <span className="label label-default">
            {t('view')}
            <a href='#' onClick={this.expandLabels}>
              {t('expanded')}
            </a>
            &nbsp;|&nbsp;
            <a href='#' onClick={this.expandLabels}>
              {t('minimized')}
            </a>
          </span>
        </div>
      );
  },
  creatingResource () {
    log('creating resource');
    this.setState({
      disabled: true
    });

  },
  creatingResourceCompleted (data) {
    this.transitionTo("form-editor", { assetid: data.uid });
  },
  componentDidMount () {
    actions.resources.createResource.listen(this.creatingResource);
    actions.resources.createResource.completed.listen(this.creatingResourceCompleted);
    this._survey = dkobo_xlform.model.Survey.create();
    var app = new dkobo_xlform.view.SurveyApp({
      survey: this._surveyr
    });
    $('.form-wrap').html(app.$el);
    app.render()
    this._app = app
  },
  componentWillUnmount () {

  },
  render () {
    return (
        <Panel>
          {/*
          <div className="progress">
            <div className="progress-bar" style={{width: '60%'}}></div>
          </div>
          */}
          <div className="row k-form-header-row">
            <div className="form-group">
              <input ref="new-form-name" className="form-control input-lg" type="text" placeholder={t('form name')} />
            </div>
            {this.renderSaveAndPreviewButtons()}
          </div>
          {this.renderSubSettingsBar()}
          <div className='form-wrap'>
          </div>
        </Panel>
      );
  },
  _render () {
    return (
      <Modal open onClose={this.routeBack}>
        <Modal.Body>
          <div className='row'>
            <div className='col-md-12'>
              <h4 className='page-header'>
                {t('new form')}
              </h4>
            </div>
          </div>
          <div className='row'>
            <div className='col-md-6'>
              <ul className='nav nav-pills nav-stacked'>
                <li>
                  <Link className='btn btn-block btn-primary' to='new-form'>
                    {t('launch')} <KoBo /> {t('form builder')}
                  </Link>
                </li>
                <li>
                  <Link to='home' className='btn btn-block btn-default'>
                    {t('upload xlsform')}
                  </Link>
                </li>
                {/*
                <li>
                  <Link className='btn btn-block'>
                    {t('third option?')}
                  </Link>
                </li>
                */}
              </ul>
            </div>
            <div className='col-md-6'>
              <ul className='nav nav-pills nav-stacked'>
                <li>
                  <Link className='btn btn-block btn-info' to='new-collection'>
                    <i className='fa fa-folder' />
                    &nbsp;
                    {t('new folder')}
                  </Link>
                </li>
                <li>
                  <Link className='btn btn-block btn-default' to='new-collection'>
                    {t('upload library')}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button"
                    className="btn btn-default"
                    data-dismiss="modal"
                    onClick={this.routeBack}>
            {t('cancel')}
          </button>
        </Modal.Footer>
      </Modal>
      );
  }
})

      // <Route name="new-form" handler={Builder} />
var routes = (
  <Route name="home" path="/" handler={App}>
    <Route name="forms">
      <Route name="new-form" path="new" handler={NewForm} />
      <Route name="form-page" path="/forms/:assetid" handler={FormPage}>
        <Route name="form-sharing" path="sharing" handler={FormSharing} />
        <Route name="form-preview-enketo" path="preview" handler={FormEnketoPreview} />
        <Route name="form-preview-xform" path="xform" handler={FormPreviewXform} />
        <Route name="form-preview-xls" path="xls" handler={FormPreviewXls} />
        <Route name="form-editor" path="edit" handler={FormEditor} />

        <DefaultRoute name="form-view" handler={FormView} />
      </Route>

      <DefaultRoute handler={Forms} />
      <NotFoundRoute handler={FormNotFound} />
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
    // log(state)
    // --> {"path":"/","action":null,"pathname":"/","routes": [...],"params":{},"query":{}}
    window._state = state;
    React.render(<Handler />, el);
  });
};