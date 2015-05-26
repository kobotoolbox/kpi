import React from 'react/addons';
import $ from 'jquery';
import Router from 'react-router';
import {Sidebar} from './sidebar';
import {log} from './utils';
import TagsInput from 'react-tagsinput';
import moment from 'moment';

var DefaultRoute = Router.DefaultRoute;
var Link = Router.Link;
var Route = Router.Route;
var RouteHandler = Router.RouteHandler;


class SmallInputBox extends React.Component {
  render () {
    return (
        <input type="text" placeholder={this.props.placeholder}
                className="form-control input-sm pull-right" />
      );
  }
}

class AssetCollectionsTable extends React.Component {
  constructor () {
    super();
    this.state = {
      loading: 'your assets will load shortly'
    };
  }
  componentDidMount () {
    $.getJSON(this.props.source).success((result) => {
      this.setState(result, {
        loading: false
      });
    }).fail((resp, etype, emessage) => {
      this.setState({
        loading: false,
        error: "" + etype + ": "+emessage + " (" + resp.status + ")"
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
    var title = 'Asset Collections';
    if (this.state.results && this.state.results.length == 0) {
      rows = (
        <AssetCollectionPlaceholder notice={'there are no surveys to display'} />
        );
    } else if (this.state.results && this.state.results.length > 0) {
      rows = this.state.results.map((asset) => {
        asset.objectType = asset.url.match(/http\:\/\/[^\/]+\/(\w+)s/)[1];
        return <AssetCollectionRow {...asset} onFocusComponent={this.focusComponent.bind(this)} />;
      });
    } else {
      rows = (
        <AssetCollectionPlaceholder {...this.state} />
        );
    }
    return (
        <div className="widget asset-collections-table">
          <div className="widget-title">
            <i className="fa fa-fighter-jet"></i> {title}
            <SmallInputBox placeholder={'Search'} />
            <div className="clearfix"></div>
          </div>
          <div className="widget-body no-padding">
            <div className="table-responsive">
              <table className="table">
                <tbody>
                  {rows}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )
  }
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
                placeholder={'add user'}
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
    } else {
      $.ajax({
        url: '/me/',
        method: 'GET'
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
            title={'removes view permission'}>
          {'view'}
        </a>
      );
    } else {
      viewButton = (
        <a href={'#'}
            onClick={(evt)=>{ this.setPermission('view', true) }}
            className={'btn btn-sm'}
            title={'adds view permission'}>
          {'view'}
        </a>
      );
    }
    if (perms.edit) {
      editButton = (
        <a href={'#'}
            onClick={(evt)=>{ this.setPermission('edit', false) }}
            className={'btn btn-sm btn-primary'}
            title={'removes edit permission'}>
          {'edit'}
        </a>
      );
    } else {
      editButton = (
        <a href={'#'}
            onClick={(evt)=>{ this.setPermission('edit', true) }}
            className={'btn btn-sm'}
            title={'adds edit permission'}>
          {'edit'}
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
      this.props.onFocusComponent(this);
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
    var klasses = "permissions-editor";
    var expanded_content;
    if (isEmpty) {
      icon_classes = "permissions-editor__icon fa fa-fw fa-lock"
      klasses += " permissions-editor--unshared"
    } else {
      icon_classes = "permissions-editor__icon fa fa-fw fa-users"
    }
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

class MomentTime extends React.Component {
  render () {
    var mtime = moment(this.props.time).format('MMM-DD-YYYY');
    return (
        <span>{mtime}</span>
      )
  }
}

class AssetCollectionRow extends React.Component {
  constructor () {
    super();
    this.state = {
      permissionsObject: {}
    };
  }
  render () {
    var perm = parsePermissions(this.props.owner, this.props.permissions);
    var icon_cls = "fa-stack fa-fw fa-lg asset--type-"+this.props.assetType;
    var inner_icon_cls = this.props.objectType === "asset" ? "fa fa-circle fa-lg" : "fa fa-lg fa-folder";

    return (
        <tr className="assetcollection__row">
          <td className="text-center asset-icon-box">
            <span className={icon_cls}>
              <i className={inner_icon_cls}></i>
            </span>
          </td>
          <td>
            {this.props.owner__username}
          </td>
          <td>
            <a href={this.props.url}>{this.props.name || 'untitled'}</a>
            <TagsInput tags={this.props.tags} />
          </td>
          <td>
            <MomentTime time={this.date_modified} />
          </td>
          <td>
            <PermissionsEditor perms={perm} onFocusComponent={this.props.onFocusComponent} />
          </td>
          <td>
            <a href="#">
              <i className="fa fa-fw fa-ellipsis-v" />
            </a>
          </td>
        </tr>
      )
  }
}

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
        <TagsInput ref='tags' />
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

  toggleIntentOpen () {
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
        <ContentBox page="apiRoot" />
        <RouteHandler />
      </div>
    )
  }
}

class ContentBox extends React.Component {
  render () {
    return (
        <div id="content-wrapper" className="page-content contentbox row">
          <PageHeader />
          <div className="row">
            <AssetCollectionsTable source="/collections/?parent=" />
          </div>
        </div>
      )
  }
}

class UserDropdown extends React.Component {
  render () {
    return (
          <ul className="dropdown-menu dropdown-menu-right">
            <li className="dropdown-header">
              {this.props.username}
            </li>
            <li className="divider"></li>
            <li className="link">
              <a href="#">
                Profile
              </a>
            </li>
            <li className="link">
              <a href="#">
                Menu Item
              </a>
            </li>
            <li className="divider"></li>
            <li className="link">
              <a href="#">
                Logout
              </a>
            </li>
          </ul>
      )
  }
}
class UserIcon extends React.Component {
  render () {
    return (
        <a href="#" className="dropdown-toggle" data-toggle="dropdown">
          <img src={this.props.img} />
        </a>
      )
  }
}
class NotificationsBell extends React.Component {
  render () {
    var notifications;
    if (this.props.notifications.length == 0) {
      notifications = <li><a href="#">{'no notifications at this time'}</a></li>;
    } else {
      notifications = this.props.notifications.map((n)=> {<li><a href="#">{n}</a></li>})
    }
    return (
        <div className="item dropdown">
          <a href="#" className="dropdown-toggle" data-toggle="dropdown">
            <i className="fa fa-bell-o"></i>
          </a>
          <ul className="dropdown-menu dropdown-menu-right">
            <li className="dropdown-header">
              Notifications
            </li>
            <li className="divider"></li>
            {notifications}
          </ul>
        </div>
      )
  }
}
class UserInfo extends React.Component {
  constructor () {
    super();
    this.state = {
      loaded: false
    };
  }
  componentDidMount () {
    $.getJSON('/me/').done((me)=>{
      this.setState(me, {
        loaded: true
      });
      this.setState({
        gravatar: "http://www.gravatar.com/avatar/e71a8d4b19db1c3ad0b4b0e1cf66a25b?s=40"
      })
    });
  }
  render () {
    return (
      <div className="user pull-right">
        <div className="item dropdown">
          <UserIcon img={this.state.gravatar} />
          <UserDropdown name={this.state.username} />
        </div>
        <NotificationsBell notifications={[]} />
      </div>
    )
  }
}
class PageHeader extends React.Component {
  render () {
    return (
        <div className="row header">
          <div className="col-xs-12">
            <div className="meta pull-left">
              <div className="page">
                Dashboard
              </div>
              <div className="breadcrumb-links">
                Home / Dashboard
              </div>
            </div>
            <UserInfo />
          </div>
        </div>
      )
  }
}

class Dashboard extends React.Component {
  render() {
    return (
      <p className="hushed">dashboard</p>
    );
  }
}


var routes = (
  <Route name="app" path="/" handler={App}>
    <DefaultRoute handler={Dashboard} />
    <Route name="help" path="/help" handler={App} />
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