import React from 'react/addons';
import Router from 'react-router';

import {log, t} from '../utils';

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
  getInitialState () {
    return {} 
  },
  render () {
    return (
        <div>
          ...
        </div>
      );
  }
})

export class Sidebar extends React.Component {
  render () {
    var title = (
        <span className="kobo">
          <span className="ko">Ko</span><span className="bo">Bo</span>
        </span>
        );
    return (
        <div className="sidebar-wrapper" id="sidebar-wrapper">
          <ul className="sidebar" onClick={ (evt)=> {
                evt.currentTarget == evt.target && this.props.toggleIntentOpen(evt);
                return;
              }
            }>
            <SidebarMain onClick={this.props.toggleIntentOpen} label={title} />

            <SidebarTitle label={t('drafts in progress')} />
            <SidebarLink label={t('forms')} linkto='forms' fa-icon="files-o" />
            <SidebarLink label={t('recent')} fa-icon="clock-o" />
            <RecentHistory />

            <SidebarTitle label={t('deployed projects')} />
            <SidebarLink label={t('projects')} active='true' href={t('/')} fa-icon="globe" />

            <SidebarTitle label={t('support resources')} />
            {/*
              <SidebarLink label={t('question library')} linkto='libraries' fa-icon="book" />
            */}
            <SidebarLink label={t('kobo support')} active='true' href={t('https://support.kobotoolbox.org/')} fa-icon="question" />

          </ul>
          <div className="sidebar-footer">
            <SidebarFooterItem label="assets" href="/assets/" />
            <SidebarFooterItem label="collections" href="/collections/" />
            <SidebarFooterItem label="me" href="/me/" />
          </div>
        </div>
      )
  }
}