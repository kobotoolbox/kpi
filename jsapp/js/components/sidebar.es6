import React from 'react/addons';
import Router from 'react-router';

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
  render () {
    var icon_class = "menu-icon fa fa-fw fa-"+(this.props['fa-icon'] || 'table')
    var icon = (<span className={icon_class}></span>);

    var link;
    if (this.props.linkto) {
      link = <Link to={this.props.linkto}
                    activeClassName="active">{this.props.label} {icon}</Link>
    } else if (this.props.href) {
      link = <a href={this.props.href}>{this.props.label} {icon}</a>
    } else {
      link = <Link to="help">{this.props.label} {icon}</Link>
    }
    return (
        <li className="sidebar-list">{link}</li>
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

            <SidebarTitle label={'QUICK LINKS'} />
            <SidebarLink label={'forms'} linkto='forms' fa-icon="files-o" />
            <SidebarLink label={'question library'} linkto='libraries' fa-icon="book" />

            <SidebarTitle label={'tools'} separator="true" />
            <SidebarLink label={'projects'} active='true' href={'/'} fa-icon="globe" />
            <SidebarLink label={'settings'} active='true' href={'/'} fa-icon="cog" />
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