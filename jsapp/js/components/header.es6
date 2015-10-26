import React from 'react/addons';
import {Link} from 'react-router';
import mdl from '../libs/rest_framework/material';

import stores from '../stores';
import Reflux from 'reflux';
import bem from '../bem';
import actions from '../actions';
import {assign} from '../utils';

var MainHeader = React.createClass({
  mixins: [
    Reflux.connect(stores.session),
    Reflux.connect(stores.pageState),
  ],
  getInitialState () {
    return assign({}, stores.pageState.state);
  },
  logout () {
    actions.auth.logout();
  },
  renderAccountNavLink () {
    var accountName = this.state.currentAccount && this.state.currentAccount.username;
    var defaultGravatarImage = `${window.location.protocol}//www.gravatar.com/avatar/64e1b8d34f425d19e1ee2ea7236d3028?s=40`;
    var gravatar = this.state.currentAccount && this.state.currentAccount.gravatar || defaultGravatarImage;

    if (this.state.isLoggedIn) {
      return (
          <a className="mdl-navigation__link">
            <bem.AccountBox__name>{accountName}</bem.AccountBox__name>
            <bem.AccountBox__image>
              <img src={gravatar} />
            </bem.AccountBox__image>
          </a>
        );
    }
    return (
          <span className="mdl-navigation__link">not logged in</span>
        );
  },
  _breadcrumbItem (item) {
    return (
        <span className="header-breadcrumb__item">
          {
            ('to' in item) ?
            <Link to={item.to} params={item.params}>{item.label}</Link>
            :
            <a href={item.href}>{item.label}</a>
          }
        </span>
      );
  },
  renderBreadcrumb() {
    var bc = this.state.headerBreadcrumb;
    return bc.map(this._breadcrumbItem);
  },
  render () {

    return (
        <header className="mdl-layout__header">
          <div className="mdl-layout__header-row">
            <span className="mdl-layout-title">{this.renderBreadcrumb()}</span>
            <div className="mdl-layout-spacer"></div>
            <nav className="mdl-navigation">
              <a className="mdl-navigation__link" href="/">
                <bem.AccountBox__logo />
              </a>
              {this.renderAccountNavLink()}
            </nav>
          </div>
        </header>
      );
  },
  componentDidUpdate() {
    mdl.upgradeDom();
  }
});

export default MainHeader;
