import {log, t} from './utils';
var $ = require('jquery').noConflict();
// window.jQuery = $;
// window.$ = $;
require('jquery.scrollto');
require('jquery-ui/sortable');
var select2 = require('select2-browserify');
var actions = require('./actions');
// import XLSX from 'xlsx';

// window._ = require('underscore');
// window.Backbone = require('backbone');
// window.Backbone.$ = $
// window.BackboneValidation = require('backbone-validation');

import {dataInterface} from './data';

import React from 'react/addons';
import Router from 'react-router';
import Sidebar from './components/sidebar';
import TagsInput from 'react-tagsinput';
import moment from 'moment';
import classNames from 'classnames';
import alertify from 'alertifyjs';
import {Sheeted} from './models/sheeted';
import stores from './stores';
import Dropzone from './libs/dropzone';
import icons from './icons';
import cookie from 'react-cookie';
import bem from './bem';

var ui = {};

import Favicon from 'react-favicon';


var bootstrap = require('./libs/rest_framework/bootstrap.min');

// window.dkobo_xlform = require('./libs/xlform');

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
  render () {
    var valid = false;
    return (
        <input type="text" placeholder={this.props.placeholder} ref='inp'
                className="form-control input-sm pull-right" onKeyUp={this.props.onKeyUp} onChange={this.props.onChange} />
      );
  }
}
ui.SmallInputBox = SmallInputBox;

var MeViewer = React.createClass({
  mixins: [Reflux.ListenerMixin],
  getInitialState () {
    return {
      status: 'loading'
    };
  },
  componentDidMount () {
    var _this = this;
    dataInterface.selfProfile().done(function(user){
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
/*
class AssetCollectionsContainer extends React.Component {
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
        return <AssetCollectionRow key={asset.uid} {...asset} />;
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
            <ui.SmallInputBox placeholder={t('Search')} />
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

*/

// class SearchForm extends React.Component {
//   render () {
//     return (
//           <form role='search' className='navbar-form navbar-left'>
//             <div className='form-group'>
//               <input type='text' placeholder='Search' className='form-control' />
//             </div>
//             <button className='btn btn-default' type='submit'>Submit</button>
//           </form>
//         );
//   }
// }


function notify(msg, atype='success') {
  alertify.notify(msg, atype);
}

/*
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
                onChange={this.onKeyUp.bind(this)}
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
      perms[perm.permission.match(/(\w+)_.* /)[1]] = true;
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
*/

// class PermissionsEditor extends React.Component {
//   constructor () {
//     super();
//     this.state = {
//       expanded: false
//     }
//   }

//   toggleExpand () {
//     if (this.state.expanded) {
//       this.setState({expanded: false});
//     } else {
//       this.setState({expanded: true});
//     }
//   }

//   unfocus () {
//     this.setState({
//       expanded: false
//     });
//   }

//   render () {
//     var user_count = this.props.perms.length;
//     var isEmpty = user_count === 0;
//     var icon, icon_classes;
//     var klasses = classNames("permissions-editor", {
//       "permissions-editor--unshared": !!isEmpty
//     });

//     icon_classes = classNames("permissions-editor__icon", "fa", "fa-fw",
//       !!isEmpty ? "fa-lock" : "fa-users"
//       )

    
//     return (
//         <div className={klasses}>
//           <i className={icon_classes} onClick={this.toggleExpand.bind(this)} />
//           {user_count}
//         </div>
//       );
//   }
// }

var anonUsername = 'AnonymousUser';
function getAnonymousUserPermission(permissions) {
  return permissions.filter(function(perm){
    return perm.user__username === anonUsername;
  })[0];
}
function parsePermissions(owner, permissions) {
  var users = [];
  var perms = {};
  permissions.map((perm) => {
    perm.user__username = perm.user.match(/\/users\/(.*)\//)[1];
    return perm;
  }).filter((perm)=> {
    return ( perm.user__username !== owner && perm.user__username !== anonUsername);
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

// var AssetCollectionRow = React.createClass({
//   // mixins: [Reflux.connect(sessionStore, "currentUsername")],
//   getInitialState () {
//     return {
//       permissionsObject: {}
//     };
//   },
//   render () {
//     var perm = parsePermissions(this.props.owner, this.props.permissions);
//     var isAsset = this.props.objectType === "asset";
//     let assetid = this.props.url.match(/\/(\w+)\/$/)[1];
//     var currentUsername = sessionStore.currentAccount && sessionStore.currentAccount.username
//     var selfOwned = this.props.owner__username == currentUsername;
//     var icon_stack;
//     if (isAsset) {
//       icon_stack = icons.large.asset;
//     } else {
//       icon_stack = icons.large.collection;
//     }

//     return (
//         <tr className="assetcollection__row">
//           <td className="text-center asset-icon-box">
//             {icon_stack}
//           </td>
//           <td>
//             <Link to='form-edit' params={{ assetid: assetid }}>
//               {this.props.name || t('untitled form')}
//             </Link>
//           </td>
//           <td>
//             {
//               selfOwned ?
//                 '' :
//                 <UserProfileLink icon='user' iconBefore='true' username={this.props.owner__username} />
//             }
//           </td>
//           <td>
//             {formatTime(this.props.date_modified)}
//           </td>
//           <td>
//             <PermissionsEditor perms={perm} />
//           </td>
//         </tr>
//       )
//   }
// });
/*
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
*/

var BgTopPanel = React.createClass({
  render () {
    var h = this.props.bgTopPanelHeight;
    var kls = classNames('bg-fixed-top-panel', `bg--h${h}`, {
      'bg--fixed': this.props.bgTopPanelFixed
    });
    return (<div className={kls} />);
  }
});

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
    var activeClass = classNames('page-wrapper', {
      'page--activenav': this.state.sidebarIsOpen,
      'page-wrapper--asset-nav-present': this.state.assetNavPresent,
      'page-wrapper--asset-nav-open': this.state.assetNavIsOpen && this.state.assetNavPresent,
      'page-wrapper--header-search': this.state.headerSearch
    })

    var panelKls = classNames("app-children-wrap", {
      "app-children-wrap--navigator-open": this.state.assetNavigatorIsOpen,
      "app-children-wrap--navigator-present": this.state.assetNavigator
    });
    // <PageHeader ref="page-header" headerSearch={this.state.headerSearch} />
    return (
      <DocumentTitle title="KoBo">
        <div className={activeClass}>
          <Sidebar isOpen={this.state.sidebarIsOpen} toggleIntentOpen={this.toggleSidebarIntentOpen} />
          <div className={panelKls}>
            <BgTopPanel {...this.state} />
            <RouteHandler appstate={this.state} />
          </div>
          { this.state.assetNavPresent ? 
            <AssetNavigator />
          :null}
        </div>
      </DocumentTitle>
    )
  }
});

/*
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
        <div className="content-wrapper page-content contentbox row">
          <div className="row">
            <AssetCollectionsContainer source="/collections/?parent=" itemname='collections' />
          </div>
        </div>
      )
  }
}*/

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

// class RecentHistoryDropdown extends RecentHistoryDropdownBase {
//   componentDidMount () {
//     this.listenTo(historyStore, this.historyStoreChange);
//   }

//   historyStoreChange (history) {
//     this.setState({
//       items: history
//     });
//   }

//   getList () {
//     return this.state.items;
//   }

//   renderEmptyList () {
//     return (
//       <ItemDropdown iconKls={classNames('fa',
//                                         'fa-clock-o',
//                                         'k-history',
//                                         'k-history--empty')}>
//         <li className="dropdown-header">
//           {t('no recent items')}
//         </li>
//       </ItemDropdown>
//     );
//   }
//   render () {
//     var list = this.getList();
//     if (list.length === 0) {
//       return this.renderEmptyList();
//     }

//     return (
//       <ItemDropdown iconKls={classNames('fa', 'fa-clock-o', 'k-history')}>
//         <ItemDropdownHeader>{t('recent items')} - ({list.length})</ItemDropdownHeader>
//         <ItemDropdownDivider />
//         {list.map((item)=> {
//           var iconKls = item.kind === 'collection' ? 'fa-folder-o' : 'fa-file-o';
//           return <ItemDropdownItem key={item.uid} faIcon={iconKls} {...item} />
//         })}
//       </ItemDropdown>
//       );
//   }
// }

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
            <button type="submit" className="btn btn-default btn-small">{t('log in')}</button>
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
})

// class LiDropdown extends React.Component {
//   render () {
//     return (
//         <li className='dropdown'>
//           <a aria-expanded='false' role='button' data-toggle='dropdown' className='dropdown-toggle' href='#'>Dropdown <span className='caret'></span></a>
//           <ul role='menu' className='dropdown-menu'>
//             <LiLink>Action</LiLink>
//             <LiLink>Another action</LiLink>
//             <LiLink>Something else here</LiLink>
//             <li className='divider'></li>
//             <LiLink>Separated link</LiLink>
//             <li className='divider'></li>
//             <LiLink>One more separated link</LiLink>
//           </ul>
//         </li>
//       )
//   }
// }

actions.misc.checkUsername.listen(function(username){
  dataInterface.queryUserExistence(username)
    .done(actions.misc.checkUsername.completed)
    .fail(actions.misc.checkUsername.failed_);
});

actions.resources.listTags.listen(function(){
  dataInterface.listTags()
    .done(actions.resources.listTags.completed)
    .fail(actions.resources.listTags.failed);
});

actions.resources.updateAsset.listen(function(uid, values){
  dataInterface.patchAsset(uid, values)
    .done(actions.resources.updateAsset.completed)
    .fail(actions.resources.updateAsset.failed);
});

actions.resources.deployAsset.listen(function(uid){
  dataInterface.deployAsset(uid)
    .done(actions.resources.deployAsset.completed)
    .fail(actions.resources.deployAsset.failed);
})

actions.resources.createResource.listen(function(details){
  dataInterface.createResource(details)
    .done(actions.resources.createResource.completed)
    .fail(actions.resources.createResource.failed);
});

actions.resources.deleteAsset.listen(function(details){
  dataInterface.deleteAsset(details)
    .done(function(result){
      actions.resources.deleteAsset.completed(details)
    })
    .fail(actions.resources.deleteAsset.failed);
});
actions.resources.readCollection.listen(function(details){
  dataInterface.readCollection(details)
      .done(actions.resources.readCollection.completed)
      .fail(actions.resources.readCollection.failed);
})
actions.resources.cloneAsset.listen(function(details){
  dataInterface.cloneAsset(details)
    .done(actions.resources.cloneAsset.completed)
    .fail(actions.resources.cloneAsset.failed);
});

actions.search.assets.listen(function(queryString){
  dataInterface.searchAssets(queryString)
    .done(function(...args){
      actions.search.assets.completed.apply(this, [queryString, ...args])
    })
    .fail(function(...args){
      actions.search.assets.failed.apply(this, [queryString, ...args])
    })
});

actions.search.libraryDefaultQuery.listen(function(){
  dataInterface.libraryDefaultSearch()
    .done(actions.search.libraryDefaultQuery.completed)
    .fail(actions.search.libraryDefaultQuery.failed);
});

actions.search.tags.listen(function(queryString){
  dataInterface.searchTags(queryString)
    .done(actions.search.searchTags.completed)
    .fail(actions.search.searchTags.failed)
});

actions.permissions.assignPerm.listen(function(creds){
  dataInterface.assignPerm(creds)
    .done(actions.permissions.assignPerm.completed)
    .fail(actions.permissions.assignPerm.failed);
});
actions.permissions.assignPerm.completed.listen(function(val){
  // var uid = val.content_object.match(/\/(assets|collections)\/(.*)\//)[2];
  actions.resources.loadAsset({url: val.content_object});
  // var uid = val.content_object.match(/\/(assets|collections)\/(.*)\//)[2];
  // actions.resources.loadAsset({id: uid});
});

actions.permissions.removePerm.listen(function(details){
  if (!details.content_object_uid) {
    throw new Error('removePerm needs a content_object_uid parameter to be set')
  }
  dataInterface.removePerm(details.permission_url)
    .done(function(resp){
      actions.permissions.removePerm.completed(details.content_object_uid, resp);
    })
    .fail(actions.permissions.removePerm.failed);
});

actions.permissions.removePerm.completed.listen(function(uid){
  actions.resources.loadAsset({id: uid});
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


actions.auth.login.listen(function(creds){
  dataInterface.login(creds).done(function(){
    dataInterface.selfProfile().done(actions.auth.login.completed)
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
  dataInterface.logout().done(actions.auth.logout.completed).fail(function(){
    console.error('logout failed for some reason. what should happen now?');
  });
})

actions.resources.loadAsset.listen(function(params){
  var dispatchMethodName;
  if (params.url) {
    dispatchMethodName = params.url.indexOf('collections') === -1 ? 
        'getAsset' : 'getCollection';
  } else {
    dispatchMethodName = {
      c: 'getCollection',
      a: 'getAsset'
    }[params.id[0]];
  }

  dataInterface[dispatchMethodName](params)
      .done(actions.resources.loadAsset.completed)
      .fail(actions.resources.loadAsset.failed)
});

actions.resources.loadAsset.completed.listen(function(asset){
  actions.navigation.historyPush(asset);
});

actions.resources.loadAssetContent.listen(function(params){
  dataInterface.getAssetContent(params)
      .done(function(data, ...args) {
        // data.sheeted = new Sheeted([['survey', 'choices', 'settings'], data.data])
        actions.resources.loadAssetContent.completed(data, ...args);
      })
      .fail(actions.resources.loadAssetContent.failed)
});

actions.resources.listAssets.listen(function(){
  dataInterface.listAllAssets()
      .done(actions.resources.listAssets.completed)
      .fail(actions.resources.listAssets.failed)
})

// this didn't work. logins were not consistent from one tab to the next
// actions.auth.verifyLogin.listen(function(){
//   dataInterface.selfProfile().then(function success(acct){
//     if (acct.username) {
//       log('sessionStore', sessionStore);
//     } else {
//       log('sessionStore', sessionStore.currentAccount);
//     }
//   })
// })


var assetContentStore = stores.assetContent;
var assetStore = stores.asset;
var sessionStore = stores.session;

var PageHeader = React.createClass({
  mixins: [
    Navigation,
    Reflux.ListenerMixin,
    Reflux.connect(sessionStore, "isLoggedIn"),
    Reflux.connectFilter(stores.assetSearch, 'searchResults', function(results){
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
    if (this.refs.headerSearch) {
      return this.refs.headerSearch.refs.inp.getDOMNode().value;
    }
    return;
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
  renderSearch () {
    return (
        <ui.SmallInputBox ref="headerSearch" placeholder={t('search for questions to include')} onKeyUp={this.liveSearch} />
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
    var headerSearch = this.props.headerSearch;

    return (
        <div className="row header">
          <div className="col-xs-12">
            {/*
            <div className="meta pull-left" style={{marginTop: '11px'}}>
              <div className={classNames('btn-group')}>
                <Link to='new-form' className='btn btn-circle btn-default'>
                  <i className='fa fa-plus' />
                </Link>
              </div>
            </div>
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



class Import {
  constructor(f) {
    this.name = f.name;
    this.f = f;
    this.status = 1;
    this.steps = this.stepSequence().reverse();
    this.d = new $.Deferred();
    this.p = this.d.promise();
  }
  run () {
    var nextStep = this.steps.pop().bind(this);
    if (nextStep) {
      nextStep().done(this.run.bind(this));
    } else {
      this.p.resolve(this);
    }
  }
  stepSequence () {
    return [
      this.loadWorkbook,
      this.parseWorkbook,
    ]
  }
  loadWorkbook () {
    var d = new $.Deferred()
    var fr = FileReader();
    fr.onload = (e)=> {
      try {
        var _data = e.target.result;
        this.workbook = XLSX.read(_data, {type: 'binary'});
        d.resolve(this.workbook)
      } catch (err) {
        d.reject(err);
      }
    }
    return d.promise();
  }
  parseWorkbook () {
    var d = new $.Deferred();
    debugger;
    return d.promise();
  }
}

var TagList = React.createClass({
  renderTag (tag, n) {
    return <span className="taglist__tag" key={tag.name} onClick={(evt)=>{this.props.onTagClick(tag.name, evt)}}>{tag.name}</span>
  },
  render () {
    var tags = this.props.tags || [];
    return (
      <div className="taglist">
        {tags.map(this.renderTag)}
      </div>
      )
  }
});

// var NavStateStore = Reflux.createStore({
//   init () {
//     this.state = {
//       isOpen: true
//     };
//   },
//   toggleState () {
//     this.state.isOpen = !this.state.isOpen;
//     this.trigger(this.state);
//   }
// })

var DraggableResult = React.createClass({
  dragEnd () {
    log('drag end');
  },
  dragStart (evt) {
    console.dir(evt);
    log('drag start');
  },
  render () {
    var draggableIcon = (function(){
          return (
              <span className='k-draggable'>
                <span className='k-draggable-iconwrap'>
                  <i className='fa fa-icon fa-th' />
                </span>
              </span>
            )
        })();

    return (
        <li className="library-asset-list__item questions__question"
            draggable="true"
            onDragEnd={this.dragEnd}
            onDragStart={this.dragStart}
            >
          <div className="l-a__item__draggable" />
          <div className="l-a__item__label questions__question__name">Who what where when why?</div>
          <div className="l-a__item__qtype question__type">Integer</div>
        </li>
      );
  }
})

stores.assetLibrary = Reflux.createStore({
  init () {
    this.results = [];
    this.listenTo(actions.search.libraryDefaultQuery.completed, this.libraryDefaultDone)
  },
  libraryDefaultDone (res) {
    this.results = res;
    this.trigger(res);
  }
});

var mixins = {};
mixins.droppable = {
  dropFiles (files) {
    if (files.length > 1) {
      notify('cannot load multiple files');
    } else {
      files.map(function(file){
        var reader = new FileReader();
        var name = file.name;
        reader.onload = (e)=>{
          var fd = new FormData();
          fd.append('xls', e.target.result);
          $.ajax({
            type: 'POST',
            url: '/imports/',
            data: fd,
            processData: false,
            contentType: false
          }).done(function(...args){
            log(this, args)
          });
          // var data = e.target.result;
          // try {
          //   var workbook = XLSX.read(data, {type: 'binary'});
          // } catch (e) {
          //   console.error('XLSX error', e);
          // }
        }
        reader.readAsBinaryString(file);
        // return $.ajax({
        //   url: "/imports/",
        //   type: "POST",
        //   data: file,
        //   processData: false
        // });
      });
    }
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
    })
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
        <Panel className="k-div--formview--innerrender">
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
        </Panel>
      );
  },
};

mixins.collectionState = {
  getInitialState () {
    return {
      results: false
    }
  },
  clickActionView () {

  },
  clickActionDownload () {

  },
  clickActionClone () {

  },
  clickActionDelete () {

  },
  deploySelected (evt) {
    evt.preventDefault();
    if (this.state.results && stores.selectedAsset.uid) {
      actions.resources.deployAsset(stores.selectedAsset.uid);
    }
  },
  renderActionButtons () {
    var assetIsSelected = this.state.results && stores.selectedAsset.uid;
    var kls = classNames("btn", "btn-default", "btn-sm",
                  !assetIsSelected ? "disabled" : '')
    var mutedTextClassesIfSelected = classNames("text-muted", assetIsSelected ? "k-invisible" : "")
    var deployKls = classNames("btn", assetIsSelected ? "" : "disabled", "btn-block", "btn-success", "btn-sm");
    var aboveButtonKls = classNames({
      "k-header-formname-text": assetIsSelected,
      "text-muted": !assetIsSelected,
      "k-header-select-form": !assetIsSelected
    });
    var aboveButtonTxt = assetIsSelected ? stores.selectedAsset.asset.name : t('select a form')
    var btnState = 'muted';
    var actionButtonKls = classNames('btn', 'btn-primary', 'k-actbtn', {
      'k-actbtn--flat': btnState === 'flat',
      'k-actbtn--muted': btnState === 'muted'
    })
    var activeResourceUrl = assetIsSelected ? `${stores.selectedAsset.asset.url}.xls` : '#';
    var assetLink;
    if (assetIsSelected) {
      if (stores.selectedAsset.asset.kind === "asset") {
        assetLink = (
              <Link to='form-edit' params={{assetid: stores.selectedAsset.uid}} className={kls}>{t('view and edit')}</Link>
            );
      } else if (stores.selectedAsset.asset.kind === "collection") {
        assetLink = (
              <Link to="collection-page" params={{uid: stores.selectedAsset.uid}} className={kls}>{t('view and edit')}</Link>
            );
      }
    } else {
      assetLink = (
            <a href="#" onClick={this.clickActionView} className={kls}>{t('view and edit')}</a>
          );
    }
    var assetIsPublishable = assetIsSelected && stores.selectedAsset.asset.kind === 'asset';
    return (
        <div className="row k-header-button-row">
          <div className="k-btn-wrap--newform">
            <Link to="new-form" className={actionButtonKls}>{t('+')}</Link>
          </div>
          <div className="col-md-9 col-md-offset-1 k-header-buttons">
            <span className={aboveButtonKls}>{aboveButtonTxt}</span>
            <div className="btn-group btn-group-justified">
              {assetLink}
              <a href={activeResourceUrl} className={kls}>{t('download')}</a>
              <a href="#" onClick={this.clickActionClone} className={kls}>{t('clone')}</a>
              <a href="#" onClick={this.clickActionDelete} className={kls}>{t('delete')}</a>
            </div>
          </div>
          <div className="col-md-2">
            { assetIsPublishable ?
              <span className="text-muted">{t('collect data')}</span>
              :
              <em className={mutedTextClassesIfSelected}>{t('collect data')}</em>
            }

            <button className={deployKls} title={t('deploy')} onClick={this.deploySelected}>{t('deploy')}</button>
          </div>
        </div>
      );
  },
  onToggleSelect () {
    this.setState({
      selectOn: !this.state.selectOn
    })
  },
  searchChange (evt) {
    log(this.refs);//this.refs['formlist-search'].getDOMNode(), this);
  },
  renderResults () {
    return this.state.results.map((resource) => {
            var isSelected = stores.selectedAsset.uid === resource.uid;
            return <AssetRow key={resource.uid} {...resource} onToggleSelect={this.onToggleSelect} isSelected={isSelected} />
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
      <Panel className="k-div--formspanel">
        {this._renderFormsSearchRow()}
        <ul className="collection-asset-list list-group">
          {this.state.results === false ?
            this.renderLoadingMessage()
            :
            this.renderResults()
          }
        </ul>
        <RouteHandler />
      </Panel>
    );
  },
  componentDidMount () {
    stores.pageState.setTopPanel(60, true);
  },
  render () {
    return (
      <DocumentTitle title={this._title()}>
        <div>
          <div className="row k-div--forms1">
            <div className="col-md-12">
              {this.renderActionButtons()}
            </div>
          </div>
          {this.renderPanel()}
        </div>
      </DocumentTitle>
      );
  }
};

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
  assetLibraryTrigger (res) {
    this.setState({
      assetLibraryItems: res
    });
  },
  handlePageStateStore (state) {
    this.setState(state);
  },
  // handleResize () {
  //   if (this.widthLessThanMin()) {
  //     stores.pageState.hideSidebar();
  //   } else if (this.state.sidebarIntentOpen && !this.state.sidebarIsOpen) {
  //     stores.pageState.showSidebar();
  //   }
  // },
  getInitialState () {
    return {
      searchResults: {},
      imports: [],
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
      return (<ul className="library-asset-list">
                {qresults.results.map((item)=> {
                  return <DraggableResult {...item} />;
                })}
              </ul>);
    } else {
      return (<ul className="library-asset-list">
                <li>
                  <i className='fa fa-spinner fa-spin' />
                  &nbsp;&nbsp;
                  {t('loading library assets...')}
                </li>
              </ul>);
    }
  },
  renderSearchResults () {
    var draggableIcon = function(){
      return (
          <span className='k-draggable'>
            <span className='k-draggable-iconwrap'>
              <i className='fa fa-icon fa-th' />
            </span>
          </span>
        )
    }
    var sr = this.state.searchResults;
    var _icons;
    if (!sr || !('count' in sr)) {
      return this._displayAssetLibraryItems();
    } else if (sr.count === 0) {
      return <p>{t('no search results found')}</p>
    } else if (sr.count > 0) {
      _icons = {
        'asset': <i className='fa fa-file-o' />,
        'collection': <i className='fa fa-folder-o' />,
        'question': <i className='fa fa-question' />
      };
      return (
          <ul className="assetnav-search-results">
            {sr.results.map(function(item){
              return (
                <li>
                  {draggableIcon()}
                  {_icons[item.kind] || _icons.question}
                  &nbsp;
                  {item.name}
                </li>
                );
            })}
          </ul>
        )
      return <p>{t('no search results found')}</p>
    }
  },
  renderRecentAssets () {
    return (
      <p>Hi</p>
      );
  },
  onTagClick () {
    log('tag click; filter search results?')
  },
  renderClosedContent () {
    var navKls = classNames("asset-navigator", this.state.assetNavIsOpen ? "" : "asset-navigator--deactivated")
    return (
        <div className={navKls}>
          <div className="asset-navigator__header asset-navigator__header--deactivated">
            <div className="asset-navigator__logo" onClick={this.toggleOpen}>
              <i className="fa fa-icon fa-book fa-2x" />
            </div>
          </div>
        </div>
      );
  },
  toggleOpen () {
    stores.pageState.toggleAssetNavIntentOpen()
  },
  render () {
    var navKls = classNames("asset-navigator", this.state.assetNavIsOpen ? "" : "asset-navigator--shrunk")
    if (!this.state.assetNavIsOpen) {
      return this.renderClosedContent();
    }
    return (
        <div className={navKls}>
          <div className="asset-navigator__header">
            <div className="asset-navigator__logo" onClick={this.toggleOpen}>
              <i className="fa fa-icon fa-book fa-2x" />
            </div>
            <div className="asset-navigator__search">
              <ui.SmallInputBox ref="navigatorSearchBox" placeholder={t('search library')} onKeyUp={this.liveSearch} />
            </div>
            <TagList tags={this.state.tags} onTagClick={this.onTagClick} />
          </div>
          <div className="asset-navigator__content">
            {this.renderSearchResults()}
          </div>
          <div className="asset-navigator__footer">
            <div className="btn-toolbar">
              <div className="btn-group">
                <i className={classNames('fa', 'fa-sm', 'fa-file-o')} />
                &nbsp;&nbsp;
                {t('upload forms')}
              </div>
            </div>
          </div>
        </div>
      );
        // <Dropzone onDropFiles={this.dropFiles}>
        // </Dropzone>
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
      <Panel className="k-div--home">
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

var ActionLink = React.createClass({
  render () {
    return <bem.AssetRow__actionIcon {...this.props} />
  }
})
var ActionButton = React.createClass({
  render () {
    if (this.props.action && !this.props.disabled) {
      return (
        <bem.AssetRow__actionIcon
            m={this.props.m}
            onClick={this.props.action}>
          {this.props.children}
        </bem.AssetRow__actionIcon>
        );
    } else {
      return (
        <bem.AssetRow__actionIcon
            m={[this.props.m, this.props.disabled ? 'disabled' : null]}
            onClick={this.props.action}>
          {this.props.children}
        </bem.AssetRow__actionIcon>
        );
    }
  }
});

var AssetRow = React.createClass({
  mixins: [
    Navigation
  ],
  clickAsset (evt) {
    evt.preventDefault();
    stores.selectedAsset.toggleSelect(this.props.uid);
    this.props.onToggleSelect();
  },
  clickView () {
    if (this.props.kind === 'collection') {
      this.transitionTo('collection-page', {uid: this.props.uid})
    } else if (this.props.kind === 'asset') {
      this.transitionTo('form-landing', {assetid: this.props.uid})
    }
  },
  clickEdit () {
    this.transitionTo('form-edit', {assetid: this.props.uid})
  },
  clickPreview () {
    this.transitionTo('form-preview-enketo', {assetid: this.props.uid})
  },
  clickDownload () {
    this.transitionTo('form-landing', {assetid: this.props.uid})
  },
  clickDelete () {
    this.transitionTo('form-landing', {assetid: this.props.uid})
  },
  render () {
    var icon = <i className="fa fa-icon fa-question" />;
    if (this.props.kind === 'collection') {
      icon = <i className="fa fa-icon fa-folder" />;
    } else if(this.props.kind === 'asset') {
      icon = <i className="fa fa-icon fa-file-o" />;
    }
    var currentUsername = sessionStore.currentAccount && sessionStore.currentAccount.username
    var selfOwned = this.props.owner__username == currentUsername;
    var perm = parsePermissions(this.props.owner, this.props.permissions);
    var rowKls = classNames('asset-row', 'clearfix', {
                                'asset-row--selected': this.props.isSelected
                              });

    return (
        <bem.AssetRow classNames={{ 'asset-row--selected': this.props.isSelected, clearfix: true }}
                        onClick={this.clickAsset}>
          <bem.AssetRow__cell m='name'>
            {icon}&nbsp;
            {this.props.name || t('no name')}
          </bem.AssetRow__cell>
          <bem.AssetRow__cell m='date-modified'>
            <span className="date date--modified">{formatTime(this.props.date_modified)}</span>
          </bem.AssetRow__cell>
          <bem.AssetRow__cell m='userlink'>
            {
              selfOwned ?
                '' :
                <UserProfileLink icon='user' iconBefore='true' username={this.props.owner__username} />
            }
          </bem.AssetRow__cell>
          { this.props.kind === 'asset' ?
            <bem.AssetRow__cell m={['action-icons', 'asset-action-icons']}>
              <ActionButton m='view' action={this.clickView} disabled={!this.props.isSelected}>
                <i className="fa fa-icon fa-info" />
              </ActionButton>
              <ActionButton m='preview' action={this.clickPreview} disabled={!this.props.isSelected}>
                <i className="fa fa-icon fa-eye" />
              </ActionButton>
              <ActionButton m='edit' action={this.clickEdit} disabled={!this.props.isSelected}>
                <i className="fa fa-icon fa-pencil" />
              </ActionButton>
              <ActionButton m='download' action={this.clickDownload} disabled={!this.props.isSelected}>
                <i className="fa fa-icon fa-save" />
              </ActionButton>
              <ActionButton m='delete' action={this.clickDelete} disabled={!this.props.isSelected}>
                <i className="fa fa-icon fa-trash-o" />
              </ActionButton>
            </bem.AssetRow__cell>
           : null }
          { this.props.kind === 'collection' ?
            <bem.AssetRow__cell m={['action-icons', 'collection-action-icons']}>
              <ActionButton m='view' action={this.clickView} disabled={!this.props.isSelected}>
                <i className="fa fa-icon fa-info" />
              </ActionButton>
              <ActionButton m='download' action={this.clickDownload} disabled={!this.props.isSelected}>
                <i className="fa fa-icon fa-save" />
              </ActionButton>
              <ActionButton m='delete' action={this.clickDelete} disabled={!this.props.isSelected}>
                <i className="fa fa-icon fa-trash-o" />
              </ActionButton>
            </bem.AssetRow__cell>
          : null }
        </bem.AssetRow>
      );
  }
})

var allAssetsStore = stores.allAssets;

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
    return (
        <RouteHandler />
        );
  }
})

var FormList = React.createClass({
  mixins: [
    mixins.droppable,
    mixins.collectionState,
    Reflux.connect(allAssetsStore, "results")
  ],
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      actions.resources.listAssets();
      stores.pageState.setHeaderSearch(true);
      stores.pageState.setTopPanel(60, true);
      callback();
    }
  },
  _title () {
    return t('KoBo form drafts');
  },
  _loadingMessage () {
    return t('loading forms...')
  },
  _renderFormsSearchRow () {
    return (
      <div className="row">
        <div className="col-sm-4 k-form-list-search-bar">
          <ui.SmallInputBox ref="formlist-search" placeholder={t('search drafts')} onChange={this.searchChange} />
        </div>
        <div className="col-sm-6 k-form-list-search-bar">
          <label>
            <input type="radio" name="formlist__search__type" id="formlist__search__type--1" value="type1" checked />
            {t('my forms')}
          </label>
          <label>
            <input type="radio" name="formlist__search__type" id="formlist__search__type--2" value="type2" />
            {t('shared with me')}
          </label>
        </div>
        <div className="col-sm-2 k-form-list-search-bar">
          <Dropzone fileInput onDropFiles={this.dropFiles}>
            <button className="btn btn-default btn-block btn-sm">
              <i className='fa fa-icon fa-cloud fa-fw' />
              &nbsp;&nbsp;
              {t('upload')}
            </button>
          </Dropzone>
        </div>
      </div>
      );
  }
})

var collectionAssetsStore = Reflux.createStore({
  init () {
    this.collections = {};
    this.listenTo(actions.resources.readCollection.completed, this.readCollectionCompleted);
  },
  readCollectionCompleted (data, x, y) {
    data.children.forEach((childAsset)=> {
      allAssetsStore.registerAssetOrCollection(childAsset);
    });
    this.collections[data.uid] = data;
    this.trigger(data, data.uid);
  }
})

var CollectionList = React.createClass({
  mixins: [
    mixins.collectionState,
    Reflux.connectFilter(collectionAssetsStore, function(data){
      if (data.uid === this.props.params.uid) {
        return {
          results: data.children,
          collection: data
        };
      }
    })
  ],
  statics: {
    willTransitionTo (transition, params, idk, callback) {
      stores.pageState.setHeaderSearch(true);
      stores.pageState.setTopPanel(60, true);
      actions.resources.readCollection({uid: params.uid})
      callback();
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

// // no shown atm
// var CollectionAssetsList = React.createClass({
//   mixins: [
//     Navigation,
//     Reflux.connectFilter(assetStore, 'asset', function(data){
//       log('ok asseet 3 CollectionAssetsList')

//       var assetid = this.props.params.assetid;
//       return data[assetid];
//     })
//   ],
//   componentDidMount () {
//     this.transitionTo('form-list');
//   },
//   render () {
//     // log('collection chilxs', this.state, this.props);
//     // var children = (this.props.children || []).map((sa, i)=> <CollectionAssetItem key={sa.uid} asset={sa} /> )

//     var children = <span>blah</span>;
//     return (
//       <ul className="list-group collection-asset-list">
//         {children}
//       </ul>
//       );
//   }
// });

// var LargeLink = React.createClass({
//   mixins: [Navigation],
//   routeTo (rtTo) {
//     this.transitionTo(rtTo);
//   },
//   render () {
//     return (
//       <div className={t('col-lg-' + this.props.colspan + ' col-md-6 col-xs-12')}>
//         <div className="widget">
//           <div className="widget-body" onClick={(evt)=> this.routeTo(this.props.to) }>
//             <div className={'widget-icon pull-left ' + this.props.color}>
//               <i className={'fa fa-' + this.props.icon}></i>
//             </div>
//             <div className="widget-content pull-left">
//               <div className="title">{this.props.big}</div>
//               <div className="comment">{this.props.little}</div>
//             </div>
//             <div className="clearfix"></div>
//           </div>
//         </div>
//       </div>
//       );
//   }
// });

// class Libraries extends React.Component {
//   render () {
//     return (
//       <Panel className="k-div--libraries">
//         <h1 className="page-header">
//           Libraries
//         </h1>
//       </Panel>
//       );
//   }
// }

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
      <Panel className="k-div--builder">
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
          <Link to='form-edit' params={{assetid: asset.uid}}>
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

// is subclassed, but should probably be a mixin
var AssetCollectionBase = React.createClass({
  mixins: [
    Navigation,
    Reflux.connectFilter(assetStore, function(data){
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
        <Panel className="k-div--assetcollectionsbase">
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
          <BigIcon to={'form-edit'} params={{assetid: this.props.uid}} {...iconProps} />
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

/* 
class OriginalCollectionPage extends AssetCollectionBase {
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
          <Panel className="k-div--originalcollectionpage">
            {this.renderIcon({color: 'green', type: 'folder', overlay: 'users'})}
            {this.renderButtons()}
            {this.renderTimes()}
            {this.renderHeader()}
            {this.props.children}
          </Panel>
      );
  }
}
*/

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
              <Link to='form-edit'
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


class FormNotFound extends React.Component {
  render () {
    return (
      <p> Form Not found :( </p>
      )
  }
}

class Panel extends React.Component {
  render () {
    return (
      <div className={"panel panel-default k-panel k-panel-default " + this.props.className }>
        <div className="panel-body k-panel-body">
          {this.props.children}
        </div>
      </div>
      );
    return (
      <div className={classNames('row', this.props.className)}>
        <div className="col-lg-12">
          <div className="panel panel-default k-panel k-panel-default">
            <div className="panel-body k-panel-body">
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
        <Panel className="k-div--userlist">
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
        <Panel className="k-div--userprofile">
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
    return <Panel className="k-div--selfprofile">
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
  mixins: [
    Navigation
  ],
  routeBack () {
    var params = this.context.router.getCurrentParams();
    this.transitionTo('form-landing', {assetid: params.assetid});
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
    this.checked[username] = false;
    this.trigger(this.checked, username)
  }
});

var PermissionsMixin = {
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
          pperms: parsePermissions(asset.owner__username, asset.permissions),
          public_permission: getAnonymousUserPermission(asset.permissions),
          related_users: assetStore.relatedUsers[uid]
        };
      }
    }),
    PermissionsMixin,
    Reflux.ListenerMixin
  ],

  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      actions.resources.loadAsset({id: params.assetid});
      callback();
    }
  },
  componentDidMount () {
    this.listenTo(userExistsStore, this.userExistsStoreChange);
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
  addInitialUserPermission (evt) {
    evt.preventDefault();
    var username = this.usernameFieldValue();
    if (userExistsStore.checkUsername(username)) {
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
      <Modal open onClose={this.routeBack} title={this.state.asset.name}
                  small={t('manage sharing permissions')}
                  label={t('note: this does not control permissions to the data collected by projects')}>
        <ModalBody>
          <Panel className="k-div--sharing">
            {t('owner')}
            &nbsp;
            <StackedIcon frontIcon='user' />
            &nbsp;
            <UserProfileLink username={'tinok4'} />
          </Panel>
          <Panel className="k-div--sharing2">
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
          </Panel>
          <div className='row'>
            {(() => {
              if (this.state.public_permission) {
                return <PublicPermDiv isOn={true} onToggle={this.removePerm('view', this.state.public_permission, uid)} />
              } else {
                return <PublicPermDiv isOn={false}
                            onToggle={this.setPerm('view', {
                                username: anonUsername,
                                uid: uid,
                                kind: kind,
                                objectUrl: objectUrl
                              })} />
              }
            })()}
          </div>
        </ModalBody>
      </Modal>
      );
  },
  removePublicPerm () {
    log('removing public perm')
  },
  addPublicPerm () {
    log('adding public perm')
  }
});


var UserPermDiv = React.createClass({
  mixins: [
    Navigation,
    PermissionsMixin,
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
    var oppositePerm = {
      "false": "deny",
      "deny": "allow",
      "allow": "false"
    }[permPermission];

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
  // setPublicPerm (val) {
  //   return (evt) => {
  //     evt.preventDefault();
  //     log('setting public perm to ', val);
  //   }
  // }
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

// var NavStateStore = Reflux.createStore({
//   init () {
//     this.navs = ['sitenav', 'assetnav'];
//     this.states = {};
//     this.navs.forEach((navtype)=> {
//       this.states[navtype] = {
//         intentOpen: currentIntentOpen,
//         open: currentIntentOpen
//       };
//     });
//   },
//   changeIntent (type) {
//     if (!this.states[type]) {
//       throw new Error(`NavStateStore.states[type] does not exist ${type}`);
//     }
//     var state = this.states[type];
//   },
//   toggleOpen (type) {

//   }
// })

// var FormEditor = React.createClass({
//   mixins: [
//     Reflux.connectFilter(assetContentStore, function(data){
//       var assetid = this.props.params.assetid;
//       return data[assetid];
//     })
//   ],
//   statics: {
//     willTransitionTo: function(transition, params, idk, callback) {
//       actions.resources.loadAssetContent({id: params.assetid});
//       callback();
//     // },
//     // willTransitionFrom (transition, params, callback) {
//     //   // component.formHasUnsavedData()
//     //   if (!confirm(t('You have unsaved information, are you sure you want to leave this page?'))) {
//     //     transition.cancel();
//     //   }
//     }
//   },
//   getInitialState () {
//     return {
//       dkobo_xlform: !!window.dkobo_xlform,
//       data: false
//     };
//   },
//   renderSurvey () {
//     var xlform = window.dkobo_xlform;
//     var surveyModel = new xlform.model.Survey.loadDict(this.state.data);
//     this.surveyApp = new xlform.view.SurveyApp({
//       survey: surveyModel,
//       save: function(evt){
//         var survey = this.state.survey;
//         var p = new Promise(function(resolve, reject){
//           try {
//             var spreadsheetStructure = survey.toSsStructure();
//             resolve()
//           } catch (e) {
//             reject(e)
//           }
//         });
//         p.constructor.prototype.finally = p.constructor.prototype.then;
//         return p;
//       }
//     });
//     $('.form-wrap').html(this.surveyApp.$el);
//     this.surveyApp.render()
//   },
//   componentDidMount () {
//     this.renderSurvey();
//   },
//   componentDidUpdate () {
//     this.renderSurvey();
//   },
//   // componentWillUnmount () {
//   //   log('component will unmount');
//   // },
//   render () {
//     if (!this.state.data) {
//       return (
//           <div>
//             <i className='fa fa-spinner fa-spin' />
//             &nbsp;
//             &nbsp;
//             {t('loading')}
//           </div>
//         );
//     }

//     if (!this.state.dkobo_xlform) {
//       return (
//           <div>
//             <i className='fa fa-spinner fa-spin' />
//             &nbsp;
//             &nbsp;
//             {t('loading scripts')}
//           </div>
//         );
//     }
//     var content;
//     return (
//         <div className='form-wrap'>
//         </div>
//       );
//   }
// });


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
          <label for={this.props.id} className="col-lg-2 control-label">{this.props.label}</label>
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
          <label for={this.props.name} className="col-lg-8 control-label">{this.props.label}</label>
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
                return <FormCheckbox for={mtype} onChange={this.props.onCheckboxChange} {...mtype} />
              })}
            </div>
            <div className="col-md-6">
              {this.props.phoneMeta.map((mtype) => {
                return <FormCheckbox for={mtype} onChange={this.props.onCheckboxChange} {...mtype} />
              })}
            </div>
          </div>
          <div className="form-group">
            <label for="select" className="col-lg-2 control-label">{t('form style')}</label>
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
      formId: formId,
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
      formId: this.props.survey.settings.get('form_id')
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
            <span className="settings-preview">{t('form id')}: {this.state.formId}</span>
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

/*
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
          <Panel className="k-div--assetpage">
            {
            // this.renderIcon({color: 'blue', type: 'file-o', overlay: 'users'})
            // this.renderButtons()
            // this.renderTimes()
            // this.renderHeader()
            }
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
*/

// var existingAssetMixin = (function(){
//   var obj = {};
//   obj.refluxConnect = Reflux.connectFilter(assetContentStore, function(data){
//     var assetid = this.props.params.assetid;
//     if (assetid in data) {
//       return {
//         survey_loaded: true,
//         // survey: assetContentStore.getSurvey(assetid),
//         data: data[assetid]
//       };
//     }
//   });
//   return obj;
// })();

// var changeCounterStore = React.createStore({
//   init () {
//     this.count = 0;
//   },
//   bump () {
//     this.count ++;
//     if (this.count > 15) {
//       return 3;
//     } else if (this.count > 7) {
//       return 2;
//     } else if (this.count > 0) {
//       return 1;
//     }
//     return 0;
//   },
//   reset () {
//     this.count = 0;
//   }
// })

var FormLanding = React.createClass({
  mixins: [
    Navigation,
    mixins.formView,
    Reflux.ListenerMixin,
  ],
  renderSaveAndPreviewButtons () {
    return;
  },
  renderSubTitle () {
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
    var downloadLink, xlsLink;

    if (this.state.asset && this.state.asset.downloads) {
      xlsLink = this.state.asset.downloads.filter((f)=>f.format==="xls")[0]
      downloadLink = <a href={xlsLink.url} className={saveBtnKls}>{t('xls')}</a>
    }
    return (
      <div className="row">
      <div className="col-md-12">
        <div className="k-form-actions" style={{marginLeft:-10}}>
          <div className='btn-toolbar'>
            <div className='btn-group'>
              <Link to='form-edit' params={{assetid: this.props.params.assetid}} className={saveBtnKls}>
                <i className={classNames('fa', 'fa-fw', 'fa-sm', 'fa-pencil')} />
              </Link>
              <Link to="form-preview-enketo" params={{assetid: this.props.params.assetid}} className={saveBtnKls}>
                <i className={classNames('fa', 'fa-fw', 'fa-sm', 'fa-eye')} />
              </Link>
              {downloadLink}
              <SharingButton uid={this.props.params.assetid}>
                {t('sharing')}
              </SharingButton>
            </div>
          </div>
        </div>
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
  // renderFormNameInput () {
  //   var nameKls = this.state.survey_name_valid ? '' : 'has-warning';
  //   var nameInputKls = classNames('form-control',
  //                                 'input-lg',
  //                                 nameKls);
  //   var nameVal = this.state.survey_name;
  //   return (
  //       <input ref="form-name"
  //               className={nameInputKls}
  //               type="text"
  //               value={nameVal}
  //               onChange={this.nameInputChange}
  //               placeholder={t('form name')}
  //             />
  //     );
  // },
  renderFormNameInput () {
    var nameVal = this.state.survey_name;
    return <p>{nameVal}</p>;
  },
  assetStoreTriggered (data, uid, stateUpdates) {
    var s = data[uid],
      survey,
      updates = {};
    if (stateUpdates) {
      assign(updates, stateUpdates);
    }
    if (s) {
      assign(updates, {
        survey_name: s.name,
        asset: s
      });
      this.setState(updates);
    }
  },
  assetContentStoreTriggered (data, uid) {
    var s = data[uid],
      survey;
    if (s) {
      this.setState({
        survey_data: s.data,
        survey_loaded: true
      });
    }
  },
  componentDidMount () {
    this.listenTo(assetStore, this.assetStoreTriggered)
    this.listenTo(assetContentStore, this.assetContentStoreTriggered);
    log('cdm topPanel')
    stores.pageState.setTopPanel(30, false);
  },
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      stores.pageState.setHeaderSearch(false);
      stores.pageState.setTopPanel(30, false);
      log('wtt topPanel');
      actions.resources.loadAsset({id: params.assetid});
      actions.resources.loadAssetContent({id: params.assetid});
      callback();
    }
  },
  render () {
    if (this.state.asset) {
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

// var FormLanding = React.createClass({
//   mixins: [
//     Navigation,
//     mixins.formView,
//   ],
//   render () {
//     return this.innerRender();
//   }
// })

var FormPage = React.createClass({
  mixins: [
    Navigation,
    mixins.formView,
    // existingAssetMixin.refluxConnect,
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
            {/*
            <a href="#" className={previewBtnKls}>
              <i className={classNames('fa', 'fa-sm', 'fa-eye')} />
              &nbsp;
              &nbsp;
              {t('preview')}
            </a>
            */}
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
      updates = {};
    if (stateUpdates) {
      assign(updates, stateUpdates);
    }
    if (s) {
      assign(updates, {
        survey_name: s.name,
        asset: s
      });
      this.setState(updates);
    }
  },
  assetContentStoreTriggered (data, uid) {
    var s = data[uid],
      survey;
    if (s) {
      survey = dkobo_xlform.model.Survey.loadDict(s.data);
      var formId = survey.settings.get('form_id')
      if (this.state.survey_name) {
        survey.settings.set('form_title', this.state.survey_name);
      }
      window._survey = survey;
      window.setTimeout(( () => {
        survey.settings.on('change', this.onSurveyChange);
        survey.rows.on('change', this.onSurveyChange);
        survey.rows.on('sort', this.onSurveyChange);
      } ), 500);
      this.setState({
        survey: survey,
        survey_loaded: true,
        formId: formId
      });
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
    this.listenTo(assetContentStore, this.assetContentStoreTriggered);
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
    this.app = new dkobo_xlform.view.SurveyApp({
      survey: this.state.survey
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
        actions.resources.loadAssetContent({id: params.assetid});
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
  // componentWillMount () {
  //   var kind = {
  //       a: 'asset',
  //       c: 'collection'
  //     }[this.props.params.assetid[0]];
  //   this.setState({
  //     kind: kind
  //   });
  // }
});

function surveyToValidJson(survey) {
  var surveyDict = survey.toFlatJSON();
  return JSON.stringify(surveyDict);
}

var surveyStore = Reflux.createStore({
  init() {
    this.surveysByUid={};
  }
})

var NewForm = React.createClass({
  mixins: [
    Navigation,
    mixins.formView,
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
                {/*
                <a href="#" className={previewBtnKls}>
                  <i className={classNames('fa', 'fa-sm', 'fa-eye')} />
                  &nbsp;
                  &nbsp;
                  {t('preview')}
                </a>
                */}
              </div>
            </div>
          </div>
        );
  },
  saveNewForm (evt) {
    var name = this.refs['form-name'].getDOMNode().value;
    evt.preventDefault();
    actions.resources.createResource({
      name: name,
      content: surveyToValidJson(this.state.survey)
    })
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
    var app = new dkobo_xlform.view.SurveyApp({
      survey: survey
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

var CollectionPage = React.createClass({
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      stores.pageState.setHeaderSearch(true);
      stores.pageState.setTopPanel(60, true);
    }
  },
  render () {
    return (
        <Panel className="k-collection-page">
          <h1>Collection page</h1>
          <hr />
          {this.props.params.uid}
        </Panel>
      );
  }
})

      // <Route name="new-form" handler={Builder} />
var routes = (
  <Route name="home" path="/" handler={App}>

    <Route name="forms" handler={Forms}>
      <Route name="new-form" path="new" handler={NewForm} />

      <Route name="collections">
        <Route name="collection-page" path=":uid" handler={CollectionList} />
      </Route>

      <Route name="form-landing" path="/forms/:assetid">
        <Route name="form-sharing" path="sharing" handler={FormSharing} />
        <Route name="form-preview-enketo" path="preview" handler={FormEnketoPreview} />
        <Route name="form-preview-xform" path="xform" handler={FormPreviewXform} />
        <Route name="form-preview-xls" path="xls" handler={FormPreviewXls} />
        <Route name='form-edit' path="edit" handler={FormPage} />
        <DefaultRoute handler={FormLanding} />
      </Route>

      <DefaultRoute handler={FormList} />
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
    React.render(<Handler />, el);
  });
};