import React from 'react';

class SidebarMain extends React.Component {
  render () {
    var icon_class = "menu-icon fa fa-fw fa-transfer"
    return (
        <li className="sidebar-main">
          <a href="#" onClick={this.props.onClick}>
            {this.props.label}
            <span className={icon_class}></span>
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
  render () {
    var icon_class = "menu-icon fa fa-fw fa-"+(this.props['fa-icon'] || 'table')
    var icon = (<span className={icon_class}></span>);

    var link;
    if (this.props.href) {
      link = <a href={this.props.href}>{this.props.label} {icon}</a>
    } else {
      link = <Link to="help">{this.props.label} {icon}</Link>
    }
    return (
        <li className="sidebar-list" id="sidebar-list">{link}</li>
      )
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

export class Sidebar extends React.Component {
  render () {
    return (
        <div className="sidebar-wrapper" id="sidebar-wrapper">
          <ul className="sidebar" onClick={ (evt)=> {
                evt.currentTarget == evt.target && this.props.toggleIntentOpen(evt);
                return;
              }
            }>
            <SidebarMain onClick={this.props.toggleIntentOpen} label="Kobo API" />

            <SidebarTitle label="QUICK LINKS" separator="true" />
            <SidebarLink label={'react'} href={'/'} fa-icon="tachometer" />

            <SidebarTitle label="API LINKS" separator="true" />

            <SidebarLink label={'survey assets'} href={'/assets/'} />
            <SidebarLink label={'collections'} href={'/collections/'} />
            <SidebarLink label={'users'} href={'/users/'} />
            <SidebarLink label={'tags'} href={'/tags/'} />
            <SidebarLink label={'permissions'} href={'/permissions/'} />
          </ul>
          <div className="sidebar-footer">
            <SidebarFooterItem label="Github" href="https://github.com/kobotoolbox/" />
            <SidebarFooterItem label="Support" href="https://support.kobotoolbox.org/" />
            <SidebarFooterItem label="Info" href="http://www.kobotoolbox.org/" />
          </div>
        </div>
      )
  }
}