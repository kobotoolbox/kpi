import React from 'react/addons';
import Reflux from 'reflux';
import {Link} from 'react-router';
import Select from 'react-select';

import {dataInterface} from '../dataInterface';
import actions from '../actions';
import stores from '../stores';
import bem from '../bem';
import cookie from 'react-cookie';
import {
  t,
  assign,
} from '../utils';

const LANGUAGE_COOKIE_NAME = 'django_language';

var leaveBetaUrl = stores.pageState.leaveBetaUrl;

class DrawerTitle extends React.Component {
  render () {
    var kls = 'sidebar-title';
    if (this.props.separator) {
      kls += ' separator';
    }
    return (
        <li className={kls}>
          <span>{this.props.label}</span>
        </li>
      );
  }
}
class DrawerLink extends React.Component {
  onClick (evt) {
    if (!this.props.href) {
      evt.preventDefault();
    }
    if (this.props.onClick) {
      this.props.onClick(evt);
    }
  }
  toggleDrawer () {
    stores.pageState.toggleDrawer();
  }
  render () {
    var icon_class = `menu-icon fa fa-fw fa-${this.props['fa-icon'] || 'table'}`;
    var icon = (<span className={icon_class}></span>);

    var link;
    var style = {};
    if (this.props.lowercase) {
      // to get navigation items looking the same,
      // a lowercase prop can be passed.
      // if the drawer items were all using a unique css class we could do this in css
      style = {'text-transform': 'lowercase'};
    }
    if (this.props.linkto) {
      link = (
            <Link to={this.props.linkto}
                  className='mdl-navigation__link'
                  style={style}
                  activeClassName='active'
                  onClick={this.toggleDrawer}>
              {icon} {this.props.label}
            </Link>
            );
    } else {
      link = (
          <a href={this.props.href || '#'}
                    style={style}
                    className='mdl-navigation__link'
                    onClick={this.onClick.bind(this)}>{icon} {this.props.label}</a>
        );
    }
    return link;
  }
}

function langsToValues (langs) {
  return langs.map(function(lang) {
    return {
      value: lang[0],
      label: lang[1],
    };
  });
}

var Drawer = React.createClass({
  mixins: [
    Reflux.connect(stores.session),
    Reflux.connect(stores.pageState),
    Reflux.ListenerMixin,
  ],
  getInitialState () {
    this.listenTo(stores.session, ({currentAccount}) => {
      this.setState({
        languageKeyValues: langsToValues(currentAccount.languages),
      });
    });

    var langKeys;
    if (stores.session.currentAccount) {
      langKeys = languageKeyValues(stores.session.currentAccount.languages);
    } else {
      langKeys = [];
    }

    return assign({
      currentLang: cookie.load(LANGUAGE_COOKIE_NAME) || 'en',
      showRecent: true,
      showLanguageSwitcher: false,
      languageKeyValues: langKeys,
      _langIndex: 0,
    }, stores.pageState.state);
  },
  logout () {
    actions.auth.logout();
  },
  languageChange (langCode) {
    if (langCode) {
      cookie.save(LANGUAGE_COOKIE_NAME, langCode);
    }
  },
  languagePrompt () {
    this.setState({
      showLanguageSwitcher: !this.state.showLanguageSwitcher,
    });
  },
  render () {
    return (
          <bem.Drawer m={{
              'toggled': this.state.drawerIsVisible,
                }} className='mdl-layout__drawer mdl-color--blue-grey-800'>
            <span className='mdl-layout-title'>
              <a href='/'>
                <bem.AccountBox__logo />
              </a>
            </span>
            <nav className='mdl-navigation'>
              <div className='drawer-separator'></div>
              <span className='mdl-navigation__heading'>{t('drafts in progress')}</span>

              <DrawerLink label={t('Form List')} linkto='forms' fa-icon='files-o' lowercase={true} />
              <DrawerLink label={t('Library List')} linkto='library' fa-icon='book' lowercase={true} />

              <div className='drawer-separator'></div>
              <span className='mdl-navigation__heading'>{t('deployed projects')}</span>
              { stores.session.currentAccount ?
                  <DrawerLink label={t('projects')} active='true' href={stores.session.currentAccount.projects_url} fa-icon='globe' />
              : null }

              <div className='drawer-separator'></div>
              <span className='mdl-navigation__heading' onDoubleClick={this.languagePrompt}>{t('account actions')}</span>
              { this.state.isLoggedIn ?
                <div>
                  <DrawerLink label={t('settings')} href={stores.session.currentAccount.projects_url + 'settings'} fa-icon='user' />
                  {leaveBetaUrl ?
                    <DrawerLink label={t('leave beta')} href={leaveBetaUrl} fa-icon='circle-o' />
                  :null}
                  <DrawerLink label={t('logout')} onClick={this.logout} fa-icon='sign-out' />
                  {this.state.showLanguageSwitcher ?
                    <DrawerLink label={t('language')} fa-icon='globe' />
                  : null }
                  {this.state.showLanguageSwitcher ?
                    <div style={{padding: '2px 20px'}}>
                      <Select
                        name="language-selector"
                        value={this.state.currentLang}
                        onChange={this.languageChange}
                        options={this.state.languageKeyValues}
                      />

                    </div>
                  : null }
                </div>
              :
                <DrawerLink label={t('login')} href='/api-auth/login/?next=/' fa-icon='sign-in' />
              }
            </nav>

            <div className='drawer__footer'>
              <a href='http://support.kobotoolbox.org/' target='_blank'>
                {t('help')}
              </a>
              <a href='http://www.kobotoolbox.org/' target='_blank'>
                {t('about')}
              </a>
              <a href='https://github.com/kobotoolbox/' target='_blank'>
                {t('source')}
              </a>
            </div>

          </bem.Drawer>
      );
  }
});

export default Drawer;
