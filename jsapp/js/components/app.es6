import React from 'react/addons';
import $ from 'jquery';
import Router from 'react-router';
import {Sidebar} from './sidebar';
import {log, t} from './utils';
import TagsInput from 'react-tagsinput';
import moment from 'moment';
import classNames from 'classnames';
import alertify from 'alertifyjs';

var assign = require('react/lib/Object.assign');
var Reflux = require('reflux');

var Navigation = Router.Navigation;
let DefaultRoute = Router.DefaultRoute;
let Link = Router.Link;
let Route = Router.Route;
let RouteHandler = Router.RouteHandler;
let NotFoundRoute = Router.NotFoundRoute;


class SmallInputBox extends React.Component {
  render () {
    return (
        <input type="text" placeholder={this.props.placeholder}
                className="form-control input-sm pull-right" />
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

class AssetCollectionsContainer extends React.Component {
  constructor () {
    super();
    this.state = {
      loading: t('your assets will load shortly')
    };
  }
  componentDidMount () {
    $.getJSON(this.props.source).success((result) => {
      this.setState(assign({}, result, {
        loading: false
      }));
    }).fail((resp, etype, emessage) => {
      var errorMessage = `(${resp.status}): ${t(emessage)}`;
      if (resp.responseJSON && resp.responseJSON.detail) {
        errorMessage = t(resp.responseJSON.detail);
      }
      this.setState({
        loading: false,
        error: errorMessage
      });
    });
  }

  focusComponent (el) {
    if (this._focusedComponent) {
      this._focusedComponent.unfocus();
    }
    this._focusedComponent = el
  }
  render () {
    var rows;
    var title = t('Asset Collections');
    var itemName = this.props.itemname;
    if (this.state.results && this.state.results.length == 0) {
      rows = (
        <AssetCollectionPlaceholder notice={t(`there are no ${itemName} to display`)} />
        );
    } else if (this.state.results && this.state.results.length > 0) {
      rows = this.state.results.map((asset) => {
        asset.objectType = asset.url.match(/http\:\/\/[^\/]+\/(\w+)s/)[1];
        return <AssetCollectionRow key={asset.uid} {...asset} onFocusComponent={this.focusComponent.bind(this)} />;
      });
    } else {
      rows = (
        <AssetCollectionPlaceholder {...this.state} />
        );
    }
    var inDrag = this.state.inDrag;
    var cls = classNames('widget', 'asset-collections-table', inDrag ? 'asset-collections-table--indrag' : '')
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
  permissions.forEach((perm)=> {
    if(perm.user === owner) {
      return;
    }
    if(users.indexOf(perm.user) === -1) {
      users.push(perm.user);
      perms[perm.user] = []
    }
    perms[perm.user].push(perm);
  });
  return users.map((userurl)=>{
    return {
      user: userurl,
      permissions: perms[userurl]
    };
  });
}

function formatTime(timeStr) {
  return moment(timeStr).format('MMM-DD-YYYY');
}

class MomentTime extends React.Component {
  render () {
    var mtime = formatTime(this.props.time);
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
    log('rendering');
    var perm = parsePermissions(this.props.owner, this.props.permissions);
    var icon_cls = "fa-stack fa-fw fa-lg asset--type-"+this.props.assetType;
    var inner_icon_cls = this.props.objectType === "asset" ? "fa fa-file fa-lg" : "fa fa-lg fa-folder";
    let assetid = this.props.url.match(/\/(\w+)\/$/)[1];
    var currentUsername = sessionStore.currentAccount && sessionStore.currentAccount.username
    var selfOwned = this.props.owner__username == currentUsername;
    return (
        <tr className="assetcollection__row">
          <td className="text-center asset-icon-box">
            <span className={icon_cls}>
              <i className={inner_icon_cls}></i>
            </span>
          </td>
          <td>
            <Link to="forms-preview" params={{ assetid: assetid }}>
              {this.props.name || 'untitled'}
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

class AssetTags extends React.Component {
  constructor () {
    super();
    this.state = {
      tags: []
    };
  }
  saveTags () {
    console.log('tags: ', this.refs.tags.getTags().join(', '));
  }

  render () {
    return (
      <div className="assettags">
        <TagsInput />
        <button onClick={this.saveTags}>Save</button>
      </div>
      );
  }
}

class App extends React.Component {
  constructor () {
    super();
    this.resize = this.handleResize.bind(this);
    this.state = {
      intentOpen: true,
      isOpen: !this.widthLessThanMin()
    };
  }

  widthLessThanMin () {
    return window.innerWidth < 560;
  }

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
  }

  componentDidMount () {
    // can use window.matchMedia(...) here
    window.addEventListener('resize', this.resize);
  }
  componentWillUnmount () {
    window.removeEventListener('resize', this.resize);
  }

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
  }

  render() {
    var activeClass = this.state.isOpen ? 'active' : '';
    return (
      <div id="page-wrapper" className={activeClass}>
        <Sidebar toggleIntentOpen={this.toggleIntentOpen.bind(this)} />
        <PageHeader />
        <RouteHandler />
      </div>
    )
  }
}

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
          <img src={imgSrc} />
        </a>
      )
  }
}
class RecentHistoryDropdown extends React.Component {
  constructor () {
    super();
    this.state = {};
  }

  render () {
    var list;
    if (this.props.list.length == 0) {
      list = <li className="dropdown-header">
              {t('no recent items')}
            </li>;
    } else {
      list = this.props.list.map((n)=> {<li><a href="#">{n}</a></li>})
    }
    return (
        <div className="item dropdown">
          <a href="#" className="dropdown-toggle" data-toggle="dropdown">
            <i className="fa fa-clock-o"></i>
          </a>
          <ul className="dropdown-menu dropdown-menu-right">
            <li className="dropdown-header">
              {t('recent items')}
            </li>
            <li className="divider"></li>
            {list}
          </ul>
        </div>
      )
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
  mixins: [Navigation],
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
  mixins: [Reflux.ListenerMixin],
  getInitialState () {
    return {
      items: [],
      home: {
        title: t('home'),
        href: '/'
      }
    }
  },
  render () {
    var items = [this.state.home].concat(this.state.items);
    items = items.map((item)=> {
      return <li><a href={item.href}>{item.title}</a></li>;
      })
    return (
        <ul className="k-breadcrumb">
          {items}
        </ul>
      );
  }
});

var actions = {
  auth: Reflux.createActions({
    login: {
      children: [
        "completed",
        "failed"
      ]
    },
    verifyLogin: {
      children: [
        "completed",
        "failed"
      ]
    },
    logout: {
      children: [
        "completed",
        "failed"
      ]
    }
  })
};

var sessionDispatch;
(function(){
  var $ajax = (o)=> $.ajax(assign({}, {dataType: 'json', method: 'GET'}, o));

  assign(this, {
    selfProfile: ()=> $ajax({ url: '/me/' }),
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
    getAsset ({id}) {
      return $.getJSON(`/assets/${id}/`);
    },
    getCollection ({id}) {
      return $.getJSON(`/collections/${id}/`);
    },
    login: (creds)=> { return $ajax({ url: '/api-auth/login/?next=/me/', data: creds, method: 'POST'}); }
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

var PageHeader = React.createClass({
  mixins: [Reflux.ListenerMixin, Reflux.connect(sessionStore, "isLoggedIn")],
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
          <RecentHistoryDropdown list={[]} />
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
                <button className='k-table-cell btn btn-default' type='submit'>Submit</button>
              </div>
            </form>
        );
    }
    return this.__loginForm;
  },
  render () {
    var isLoggedIn = this.state.isLoggedIn;
    var _li = this.state.isLoggedIn && !this.state.username;
    var _pending = this.state.loginStatus === 'pending';

    var buttonKls = classNames("btn", "btn-small", "btn-default");
    var noop = (
      <div className='row'>
          <div className='col-lg-12'>
            <br />
            <div className='bs-component'>
              <nav className='navbar navbar-inverse'>
                <div className='container-fluid'>
                  <div className='navbar-header'>
                    <button data-target='#bs-example-navbar-collapse-2'
                            data-toggle='collapse'
                            className='navbar-toggle collapsed'
                            type='button'>
                      <span className='sr-only'>Toggle navigation</span>
                      <span className='icon-bar'></span>
                      <span className='icon-bar'></span>
                      <span className='icon-bar'></span>
                    </button>
                    <a href='#' className='navbar-brand'>Brand</a>
                  </div>

                  <div id='bs-example-navbar-collapse-2' className='collapse navbar-collapse'>
                    <ul className='nav navbar-nav'>
                      <LiDropdown />
                      <LiLink active href="#" sr-only={'(current)'}>{t('link')}</LiLink>
                      <LiLink />
                    </ul>

                    <ul className='nav navbar-nav navbar-right'>
                      <li><a href='#'>Link</a></li>
                    </ul>
                  </div>
                </div>
              </nav>
            </div>
            <SearchForm />

          </div>
        </div>
      );
    return (
        <div className="row header">
          <div className="col-xs-12">
            <div className="meta pull-left">
              <div className="page">
                <Breadcrumb />
              </div>
            </div>
            <ul className="nav navbar-nav">
              <LiDropdown sr-only />
              <LiLink active href="#" sr-only={'(current)'}>{t('link')}</LiLink>
              {/*
              */}
            </ul>
            <div className="pull-right k-user-details">
              {_pending || (this.state.username ? this._userInfo() : this._loginForm()) }
              {_pending ? <NavBarIcon icon="fa-spinner fa-spin fa-2x" title={this.state.loginStats} /> : '' }
              <MeViewer />
            </div>
          </div>
        </div>
      )
  }
});

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

class Home extends React.Component {
  _items () {
    return _.range(1, 200);
    return _.range(1, 1000).map((nn)=> {
      return <div className="vlist">{nn}</div>;
    })
  }
  dragover (evt) {
    window._evt = evt;
    evt.preventDefault();
    log(evt);
  }
  drop (evt) {
    window._dropevt = evt;
    evt.preventDefault();
  }
  renderItem (x, n) {
    return <Nn>{x}</Nn>;
  }
  _renderedItems () {
    return this._items().map(function(x){
      return <Nn>{x}</Nn>;
    });
  }
  render () {
    return (
      <Panel>
        <h1>Home</h1>
      </Panel>
      );
  }

}
class Forms extends React.Component {
  render () {
    return (
      <Panel>
        <BuilderBar />
        <Header title={t('collections')}
                small={t('organize and share your assets in folders')} />
        <div className="row">
          <AssetCollectionsContainer source="/collections/?parent=" itemname='collections' />
        </div>
        <Header title={t('assets')}
                small={t('start forms and stuff')} />
        <div className="row">
          <AssetCollectionsContainer source="/assets/?parent=" itemname='assets' />
        </div>
        <RouteHandler />
      </Panel>
      );
  }
}

class Shared extends React.Component {
  render () {
    return (
      <Panel>
        <Header title={t('shared collections')} />
        <p>
          Item
        </p>
        <hr />
        <Header title={t('shared forms')} />
        <p>Item</p>
        <p>Item</p>
      </Panel>
      );
  }
}

class LargeLink extends React.Component {
  routeTo (arg) {
    log('route to ', arg);
  }
  render () {
    return (
      <div className={t('col-lg-' + this.props.colspan + ' col-md-6 col-xs-12')}>
        <div className="widget">
          <div className="widget-body" onClick={(evt)=> this.routeTo(this.props.href) }>
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
      )
  }
}

class BuilderBar extends React.Component {
  render () {
    return (
      <div className="row">
        <div className="well">
          <LargeLink big={t('new')}
                      little={t('start new form')}
                      href={'/'}
                      colspan='4'
                      color='green'
                      icon='file'
            />
          <LargeLink big={t('template')}
                      little={t('load from template')}
                      href={'/'}
                      colspan='4'
                      color='red'
                      icon='files-o'
            />
          <LargeLink big={t('examples')}
                      little={t('browse examples')}
                      href={'/'}
                      colspan='4'
                      color='blue'
                      icon='times'
            />
        </div>
      </div>
      );
  }
}

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

class Public extends React.Component {
  render () {
    return (
      <div>
        <BuilderBar />
        <p>Public</p>
      </div>
      );
  }
}

class Builder extends React.Component {
  render () {
    return (
      <p>Builder</p>
      );
  }
}

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
          <Link to="forms-preview" params={{assetid: asset.uid}}>
            {asset_icon} - {asset.name}
          </Link>
        </li>
      );
  }
}
class CollectionAssetsList extends React.Component {
  render () {
    var _assets =  this.props.assets;
    var assets = (_assets).map((sa, i)=> <CollectionAssetItem key={sa.uid} asset={sa} /> )
    return (
      <ul className="list-group collection-asset-list">
        {assets}
      </ul>
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

    return (
      <div className={okls}>
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
    mainLink = <a href={href} className={mainClassnames}>{title}&nbsp;&nbsp;{iconEl}</a>;

    if (links.length > 0) {
      openLink = (
        <a href="#" className={caretClassnames} onClick={this.toggleExpandGroup.bind(this)}><span className="caret" /></a>
      );
      links = (
          <ul className="dropdown-menu">
            {links.map((lnk, i)=> {
              return (<li key={'asdfdl'+i}><a href={lnk.url}>{lnk.title || t(`format:${lnk.format}`)}</a></li>);
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
    return (
      <ButtonGroup href="#"
                    links={this.props.downloads}
                    disabled={this.props.downloads.length === 0}
                    icon="cloud-download"
                    title="download" />
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

class CollectionView extends React.Component {
  constructor () {
    super();
    this.state = {
      assetType: 'collection',
      uid: 'this.props.uid',
      name: 'xx?xx',
      tags: [],
      permissions: [],
      owner__username: 'a?b',
      date_created: new Date(),
      date_modified: new Date(),
      assets: []
    };
  }
  close () {
    log('close');
  }

  componentWillMount () {
    this.setState(this.props);
  }

  render () {
    var icon = <i className="fa fa-folder" />;
    var _rows = [];
    return (
          <Panel>
            <BigIcon color="green" type="folder" overlay="users" />
            <div className="btn-toolbar pull-right">
              <DownloadButtons assetType="collection" uid={this.state.uid} downloads={this.state.downloads} />
              <div className="btn-group">
                <CloseButton
                    title={t('close')}
                    to="forms"
                    className="btn btn-primary"
                    onClick={this.close.bind(this)}
                    />
              </div>
            </div>
            <h4>
              {this.state.name}
              <br />
              <small>
                <UserProfileLink username={this.state.owner__username}
                                  icon="user" />
              </small>
            </h4>
            <hr />
            <p className="col-md-4">
              <span className="label label-primary">
                {t('Created')} <MomentTime time={this.state.date_created} />
              </span> <span className="label label-primary">
               {t('Modified')} <MomentTime time={this.state.date_modified} />
              </span>
            </p>

            <div>
              <PermissionsList {...this.state} />
            </div>
            <hr />
            <asdf />
            <AssetsTable rows={_rows} />
            {/*
            <CollectionAssetsList {...this.state} />
            */}
          </Panel>
        );
  }
}
class AssetPreview extends React.Component {
  constructor () {
    super();

    this.state = {
      assetType: 'collection',
      uid: 'this.props.uid',
      name: 'a?p',
      tags: [],
      permissions: [],
      owner__username: 's?basdf',
      date_created: new Date(),
      date_modified: new Date(),
      assets: []
    };
  }
  close () {
    log('close');
  }

  componentWillMount () {
    this.setState(this.props);
  }

  render () {
    var pencil_icon = (<i className='fa fa-pencil' />);
    var parents = [];
    if(this.props.parent) {
      var parUid = this.props.parent.match(/\/(\w+)\/$/)[1]

      parents.push({
        uid: parUid,
        name: 'PARENT COLLECTION NAME [' + this.props.parent + ']'
      })
    }
    // <DownloadButtons assetType="collection" uid={this.state.uid} downloads={this.state.downloads} />
    return (
          <Panel>
            <BigIcon color="blue" type="file-o" overlay="users" />
            <div className="btn-toolbar pull-right">
              <div className="btn-group">
                <CloseButton
                    title={t('close')}
                    to="forms"
                    className="btn btn-primary"
                    onClick={this.close.bind(this)}
                    />
              </div>
            </div>
            <h4>
              {this.state.name}
              <br />
              <small>
                <UserProfileLink username={this.state.owner__username}
                                  icon="user" />
              </small>
            </h4>
            <hr />
            <p>
              {parents.length > 0 && 
                <Link to="forms-preview" params={{ assetid: parents[0].uid }}>
                  {parents[0].name}
                </Link>
              }
            </p>
            <p className="col-md-4">
              <span className="label label-primary">
                {t('Created')} <MomentTime time={this.state.date_created} />
              </span> <span className="label label-primary">
               {t('Modified')} <MomentTime time={this.state.date_modified} />
              </span>
            </p>
          </Panel>
      );
    return (
      <div className="form-preview row">
        <LargeLink big={t('asset')}
                    little={t('start new form')}
                    href={'/'}
                    colspan='12'
                    color='purple'
                    icon='file-o'
          />
        <Link to="forms-editor"
                params={{ assetid: 'this.props.params.assetid' }}
                className='btn btn-primary'
          >{pencil_icon} {t('edit')}</Link>
        <div className="col-md-6 well">
          <h3>{this.props.name}</h3>
          <dl>
            <dt>{t('Owner')}</dt>
            <dd>{this.props.owner__username}</dd>
            <dt>{t('Tags')}</dt>
            <dd>{this.props.tags.join(', ')}</dd>
            <dt>{t('Permissions')}</dt>
            <dd>{this.props.permissions.length}</dd>
            <dt>{t('Date created')}</dt>
            <dd>
              <MomentTime time={this.props.date_created} />
            </dd>
            <dt>{t('Date modified')}</dt>
            <dd>
              <MomentTime time={this.props.date_modified} />
            </dd>
          </dl>
        </div>
        <code>
          <pre>
            {JSON.stringify(this.state, null, 4)}
          </pre>
        </code>
        <div className="permissions">
          <h3>Permissions</h3>
        </div>
      </div>
      );
  }
}

class FormPreview extends React.Component {
  constructor () {
    super();
    this._initialState = {
      assetType: 'unknown',
      name: 'formpreview__name',
      tags: [],
      loaded: false,
      permissions: [],
      owner__username: 'formpreview__owner',
      date_created: new Date(),
      date_modified: new Date()
    };
    this.state = assign({}, this._initialState);
  }
  componentDidMount () {
    let assetType = (this.props.params.assetid[0] == 'c') ? 'collection' : 'asset';
    this.setState({
      assetType: assetType,
    });
    if (assetType === 'collection') {
      sessionDispatch.getCollection({id: this.props.params.assetid})
        .success((data,status,req)=>{ this.setState(assign({}, {loaded: true}, data)); })
        .fail(function fail(a,b,c) {
          if (a.statusText === 'NOT FOUND') {
            throw new Error('Not found');
          }
        });
    } else {
      sessionDispatch.getAsset({id: this.props.params.assetid}).success((data,status,req)=>{
        this.setState(assign({}, {loaded: true}, data));
      }).fail(function fail(a,b,c) {
        if (a.statusText === 'NOT FOUND') {
          throw new Error('Not found');
        }
      });
    }
  }
  componentWillReceiveProps (props) {
    if (this.props.params.assetid !== props.params.assetid) {
      log("replacingstate because assetid changed");
      this.replaceState(assign({}, this._initialState));
    }
  }
  render () {
    var content;
    if (this.state.loaded) {
      if (this.state.assetType === 'collection') {
        return (<CollectionView key={this.state.uid} {...this.state} />);
      } else {
        return (<AssetPreview key={this.state.uid} {...this.state} />);
      }
    }
    return (
      <Panel width="10" offset="1">
        <i className='fa fa-spinner fa-spin' />
        &nbsp;
        {t('loading')}
      </Panel>
      );
  }
}

class FormEditor extends React.Component {
  render () {
    return (
      <div className="form-editor">
        <LargeLink big={t('editor')}
                    little={t('start new form')}
                    href={'/'}
                    colspan='12'
                    color='purple'
                    icon='pencil'
          />
      </div>
      );
  }
}
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

class SectionNotFound extends React.Component {
  render () {
    return <div>
      Section Not Found
    </div>
  }
}

var routes = (
  <Route name="home" path="/" handler={App}>

    <Route name="public" handler={Public}>
      <Route name="public-builder" handler={Builder} />
    </Route>

    <Route name="forms">
      <Route name="forms-builder" handler={Builder} />
      <Route name="forms-preview" path="/forms/:assetid" handler={FormPreview} />
      <Route name="forms-editor" path="/forms/:assetid/edit" handler={FormPreview} />
      <DefaultRoute handler={Forms} />
      <NotFoundRoute handler={FormNotFound} />
    </Route>

    <Route name="users">
      <DefaultRoute name="users-list" handler={UserList} />
      <Route name="user-profile" handler={UserProfile}
              path="/users/:username" />
    </Route>

    <Route name="shared" handler={Shared} />
    <Route name="libraries" handler={Libraries} />
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