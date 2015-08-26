import React from 'react/addons';
import Router from 'react-router';
import {log, t} from '../utils';
import icons from '../icons';
import stores from '../stores';
import classNames from 'classnames';
import Reflux from 'reflux';
import bem from '../bem';

var actions = require('../actions');
var assign = require('react/lib/Object.assign');

let Link = Router.Link;

class SidebarMain extends React.Component {
  render () {
    var icon_class = "menu-icon kobo-icon"
    return (
        <li className="sidebar-main">
          <a href="#" onClick={this.props.onClick}>
            {this.props.label}
            <i className={icon_class}></i>
          </a>
        </li>
      )
  }
}
class SidebarTitle extends React.Component {
  render () {
    var kls = "sidebar-title"
    if (this.props.separator) {
      kls += " separator";
    }
    return (
        <li className={kls}>
          <span>{this.props.label}</span>
        </li>
      )
  }
}
class SidebarLink extends React.Component {
  onClick (evt) {
    if (!this.props.href) {
      evt.preventDefault();
    }
    if (this.props.onClick) {
      this.props.onClick(evt);
    }
  }
  render () {
    var icon_class = "menu-icon fa fa-fw fa-"+(this.props['fa-icon'] || 'table')
    var icon = (<span className={icon_class}></span>);

    var link;
    if (this.props.linkto) {
      link = <Link to={this.props.linkto}
                    activeClassName="active">{this.props.label} {icon}</Link>
    } else {
      link = <a href={this.props.href || "#"} onClick={this.onClick.bind(this)}>{this.props.label} {icon}</a>
    }
    return (
        <li className="sidebar-list">{link}</li>
      );
  }
}

class SidebarFooterItem extends React.Component {
  render () {
    var content;
    if (this.props.href) {
      content = (
        <a href={this.props.href || '#'} target="_blank">
          {this.props.label}
        </a>
        )
    } else {
      content = (
        <span>{this.props.label}</span>
        )
    }
    return (
      <div className="col-xs-4">
        {content}
      </div>
    )
  }
}

var RecentHistory = React.createClass({
  mixins: [
    Reflux.ListenerMixin,
    Router.Navigation,
  ],
  getInitialState () {
    return {
      items: stores.history.history || []
    };
  },
  componentDidMount () {
    this.listenTo(stores.history, this.historyStoreChanged);
  },
  historyStoreChanged (history) {
    this.setState({
      items: history
    })
  },
  renderLink (item) {
    return (
        <li className="k-sidebar-smallitems__item">
          <Link to='form-landing' params={{assetid: item.uid}}>
            {icons.asset()}
            <span className='name'>
              {item.name}
            </span>
          </Link>
        </li>
      );
  },
  render () {
    var items = this.state.items;
    var params = this.context.router.getCurrentParams(),
        hasCurrentAsset = 'assetid' in params || 'uid' in params;
    if (items.length > 0 && hasCurrentAsset) {
      items = items.slice(1);
    }
    items = items.slice(0, 5);
    if (this.props.visible) {
      return (
          <ul className={classNames('k-sidebar-smallitems', this.props.visible ? '' : 'k-invisible')}>
            {items.map(this.renderLink)}
          </ul>
        );
    } else {
      return <i />;
    }
  }
})


var toolTipped = {
  renderToolTip () {
    return (
        <div className="popover fade bottom in" role="tooltip">
          <div className="arrow"></div>
          <h3 className="popover-title"></h3>
          <div className="popover-content">
            Vivamus sagittis lacus vel augue laoreet rutrum faucibus.
          </div>
        </div>
      );
  }
};

var Sidebar = React.createClass({
  mixins: [
    Reflux.connect(stores.session),
    Reflux.connect(stores.pageState),
    toolTipped,
  ],
  getInitialState () {
    return assign({
      showRecent: true
    }, stores.pageState.state);
  },
  logout () {
    actions.auth.logout();
  },
  toggleRecent () {
    this.setState({
      showRecent: !this.state.showRecent
    });
  },
  broadToggleIntent (evt) {
    evt.currentTarget == evt.target && this.props.toggleIntentOpen(evt)
    return;
  },
  renderAccountBar () {
    var accountName = this.state.currentAccount && this.state.currentAccount.username;
    var defaultGravatarImage = `${window.location.protocol}//www.gravatar.com/avatar/64e1b8d34f425d19e1ee2ea7236d3028?s=40`;
    var gravatar = this.state.currentAccount && this.state.currentAccount.gravatar || defaultGravatarImage;

    if (this.state.isLoggedIn) {
      return (
          <bem.AccountBox m="loggedin">
            <bem.AccountBox__name>{accountName}</bem.AccountBox__name>
            <bem.AccountBox__indicator />
            <bem.AccountBox__image>
              <img src={gravatar} />
            </bem.AccountBox__image>
            <bem.AccountBox__logout href="#" onClick={this.logout}>{t('logout')}</bem.AccountBox__logout>
          </bem.AccountBox>
        );
    }
    return (
        <div>
          <SidebarTitle label={t('logged out')} />
        </div>
        );

  },
  render () {
    var title = (
        <span className="kobo">
          <span className="ko">Ko</span><span className="bo">Bo</span><span className="toolbox">Toolbox</span>
        </span>
        );
    return (
        <div className="sidebar-wrapper">
          <ul className="sidebar" onClick={this.broadToggleIntent}>
            <SidebarMain onClick={this.props.toggleIntentOpen} label={title} />
            {this.renderAccountBar()}
            <hr />
            <SidebarTitle label={t('drafts in progress')} />
            <SidebarLink label={t('forms')} linkto='forms' fa-icon="files-o" />
            <SidebarLink label={t('library')} linkto='library' fa-icon="book" />
            <SidebarLink label={t('collections')} linkto='collections' fa-icon="folder-o" />
            {/* this.state.showRecent && this.state.sidebarIsOpen ?
              <div>
                <SidebarLink label={t('recent')} onClick={this.toggleRecent} fa-icon="clock-o" />
                <RecentHistory />
              </div>
            : null
            */}
            <SidebarTitle label={t('deployed projects')} />
            { stores.session.currentAccount ?
                <SidebarLink label={t('projects')} active='true' href={stores.session.currentAccount.projects_url} fa-icon="globe" />
            :null }
            <SidebarTitle label={t('account actions')} />
            { this.state.isLoggedIn ?
              <SidebarLink label={t('logout')} onClick={this.logout} fa-icon="sign-out" />
            :
              <SidebarLink label={t('login')} href='/api-auth/login/?next=/' fa-icon="sign-in" />
            }
          </ul>
          <div className="sidebar-footer">
            <SidebarFooterItem label="help" href="http://support.kobotoolbox.org/" />
            <SidebarFooterItem label="about" href="http://www.kobotoolbox.org/" />
            <SidebarFooterItem label="source" href="https://github.com/kobotoolbox/" />
          </div>
        </div>
      )
  }
});

export default Sidebar;
