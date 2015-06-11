import React from 'react/addons';
import Router from 'react-router';
import {log, t} from '../utils';
import icons from '../icons';
import stores from '../stores';
import classNames from 'classnames';
import Reflux from 'reflux';
import bem from '../bem';

var actions = require('../actions');

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
    Reflux.ListenerMixin
  ],
  getInitialState () {
    return {
      items: stores.history.history
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
    if (items.length > 0) {
      items = items.slice(1);
    }
    items = items.slice(0, 5);
    return (
        <ul className={classNames('k-sidebar-smallitems', this.props.visible ? '' : 'k-invisible')}>
          {items.map(this.renderLink)}
        </ul>
      );
  }
})

var Sidebar = React.createClass({
  mixins: [
    Reflux.connect(stores.session)
  ],
  getInitialState () {
    return {
      showRecent: true
    }
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
    // if (this.state.isLoggedIn) {
    //   return (
    //       <div>
    //         <SidebarTitle label={t('account')} />
    //       </div>
    //       );
    // }
    return null;
  },
  render () {
    var title = (
        <span className="kobo">
          <span className="ko">Ko</span><span className="bo">Bo</span>
        </span>
        );
    return (
        <div className="sidebar-wrapper">
          <ul className="sidebar" onClick={this.broadToggleIntent.bind(this)}>
            <SidebarMain onClick={this.props.toggleIntentOpen} label={title} />
            {this.renderAccountBar()}
            <hr />
            <SidebarTitle label={t('drafts in progress')} />
            <SidebarLink label={t('forms')} linkto='forms' fa-icon="files-o" />
            <SidebarLink label={t('recent')} onClick={this.toggleRecent.bind(this)} fa-icon="clock-o" />
            { this.state.showRecent ?
              <RecentHistory visible={this.props.isOpen} />
            : null}
            <SidebarTitle label={t('deployed projects')} />
            <SidebarLink label={t('projects')} active='true' href={t('/')} fa-icon="globe" />
            <SidebarTitle label={t('account actions')} />
            { this.state.isLoggedIn ? 
              <SidebarLink label={t('logout')} onClick={this.logout} fa-icon="sign-out" />
            : 
              <a href="/api-auth/login/?next=/">LOG IN</a>
            }
          </ul>
          <div className="sidebar-footer">
            <SidebarFooterItem label="help" href="https://support.kobotoolbox.org/" />
            <SidebarFooterItem label="about" href="http://www.kobotoolbox.org/" />
            <SidebarFooterItem label="source" href="https://github.com/kobotoolbox/" />
          </div>
        </div>
      )
  }
});

export default Sidebar;