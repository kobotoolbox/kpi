import React from 'react/addons';
import Router from 'react-router';
import {log, t} from '../utils';
import icons from '../icons';
import stores from '../stores';
import classNames from 'classnames';
import Reflux from 'reflux';

var actions = require('../actions');

// var Reflux = require('reflux');

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
      items: [],
      expanded: false
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
          <Link to='form-view' params={{assetid: item.uid}}>
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

export class Sidebar extends React.Component {
  logout () {
    actions.auth.logout();
  }
  render () {
    var title = (
        <span className="kobo">
          <span className="ko">Ko</span><span className="bo">Bo</span>
        </span>
        );
    return (
        <div className="sidebar-wrapper">
          <ul className="sidebar" onClick={ (evt)=> {
                evt.currentTarget == evt.target && this.props.toggleIntentOpen(evt);
                return;
              }
            }>
            <SidebarMain onClick={this.props.toggleIntentOpen} label={title} />
            <SidebarTitle label={t('drafts in progress')} />
            <SidebarLink label={t('forms')} linkto='forms' fa-icon="files-o" />
            <SidebarLink label={t('recent')} linkto='forms' fa-icon="clock-o" />
            <RecentHistory visible={this.props.isOpen} />
            <SidebarTitle label={t('deployed projects')} />
            <SidebarLink label={t('projects')} active='true' href={t('/')} fa-icon="globe" />
            <SidebarTitle label={t('account actions')} />
            <SidebarLink label={t('logout')} onClick={this.logout} fa-icon="sign-out" />
          </ul>
          <div className="sidebar-footer">
            <SidebarFooterItem label="help" href="https://support.kobotoolbox.org/" />
            <SidebarFooterItem label="about" href="http://www.kobotoolbox.org/" />
            <SidebarFooterItem label="source" href="https://github.com/kobotoolbox/" />
          </div>
        </div>
      )
  }
}