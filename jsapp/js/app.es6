import $ from 'jquery';
window.jQuery = $;
window.$ = $;
require('jquery.scrollto');
require('jquery-ui/sortable');

import mdl from './libs/rest_framework/material';
import React from 'react';
import { render } from 'react-dom';
import classNames from 'classnames';
import DocumentTitle from 'react-document-title';
import Reflux from 'reflux';

import {
  IndexRoute,
  IndexRedirect,
  Link,
  Route,
  browserHistory,
  Router
} from 'react-router';
import Select from 'react-select';
import moment from 'moment';

import searches from './searches';
import actions from './actions';

import stores from './stores';
import {dataInterface} from './dataInterface';
import bem from './bem';
import ui from './ui';
import mixins from './mixins';
import MainHeader from './components/header';
import Drawer from './components/drawer';
import {
  AddToLibrary,
  FormPage,
} from './components/formEditors';

import Reports from './components/reports';
import FormLanding from './components/formLanding';
import FormSubScreens from './components/formSubScreens';
import FormViewTabs from './components/formViewTabs';
import Modal from './components/modal';
import {ChangePassword, AccountSettings} from './components/accountSettings';

import {
  ListSearch,
  ListTagFilter,
  ListCollectionFilter,
  ListExpandToggle
} from './components/list';

import {
  getAnonymousUserPermission,
  anonUsername,
  parsePermissions,
  log,
  t,
  assign,
  isLibrary,
  currentLang
} from './utils';


class ItemDropdown extends React.Component {
  render () {
    return (
        <div className="item dropdown">
          <a href="#" className="dropdown-toggle" data-toggle="dropdown">
            <i className={this.props.iconKls} />
          </a>
          <ul className="dropdown-menu dropdown-menu-right">
            {this.props.children}
          </ul>
        </div>
        );
  }
}

class ItemDropdownItem extends React.Component {
  render () {
    var baseName = isLibrary(this.context.router) ? 'library-' : '';
    return (
          <li>
            <Link to={`${baseName}form-edit`}
                  params={{assetid: this.props.uid}}>
              <i className={classNames('fa', 'fa-sm', this.props.faIcon)} />
              &nbsp;
              &nbsp;
              {this.props.name || t('no name')}
            </Link>
          </li>
      );
  }
}

class ItemDropdownHeader extends React.Component {
  render () {
    return <li className="dropdown-header">{this.props.children}</li>;
  }
}

class ItemDropdownDivider extends React.Component {
  render () {
    return <li className="divider" />;
  }
}

/*
var LoginForm = React.createClass({
  done (...args) {
    log(args, this);
  },

  fail (...args) {
    log(args, this);
  },

  handleSubmit (evt) {
    evt.preventDefault();
    var username = this.refs.username.getDOMNode().value;
    var password = this.refs.password.getDOMNode().value;
    actions.auth.login({
      username: username,
      password: password
    });
  },
  render () {
    return (
      <div className="col-md-4 pull-right">
        <form action="/api-auth/login/" className="form-inline" onSubmit={this.handleSubmit}>
          <div className="form-group">
            <input type="text" ref="username" placeholder="username" className="form-control input-sm" />
            <input type="password" ref="password" placeholder="password" className="form-control input-sm" />
            <button type="submit" className="btn btn-default btn-sm">{t('log in')}</button>
          </div>
        </form>
      </div>
      );
  }
});

var LiLink = React.createClass({
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
});
*/

var assetStore = stores.asset;
var sessionStore = stores.session;


var AssetNavigatorListView = React.createClass({
  mixins: [
    searches.common,
  ],
  componentDidMount () {
    this.searchClear();
    this.listenTo(this.searchStore, this.searchStoreChanged);
  },
  getInitialState () {
    return {};
  },
  searchStoreChanged (searchStoreState) {
    this.setState(searchStoreState);
  },
  activateSortable() {
    if (!this.refs.liblist) {
      return;
    }
    var $el = $(this.refs.liblist.getDOMNode());
    if ($el.hasClass('ui-sortable')) {
      $el.sortable('destroy');
    }
    $el.sortable({
      helper: 'clone',
      cursor: 'move',
      distance: 5,
      items: '> li',
      connectWith: '.survey-editor__list',
      opacity: 0.9,
      scroll: false,
      deactivate: ()=> {
        $el.sortable('cancel');
      }
    });
  },
  render () {
    var list,
        count,
        status,
        isSearch = this.state.searchResultsDisplayed;

    if (isSearch) {
      status = this.state.searchState;
      list = this.state.searchResultsList;
      count = this.state.searchResultsCount;
    } else {
      status = this.state.defaultQueryState;
      list = this.state.defaultQueryResultsList;
      count = this.state.defaultQueryCount;
    }


    if (status !== 'done') {
      return (
          <bem.LibList m={'empty'}>
            <bem.LibList__item m={'message'}>
              {t('loading')}
            </bem.LibList__item>
          </bem.LibList>
        );
    } else if (count === 0) {
      return (
          <bem.LibList m={'empty'}>
            <bem.LibList__item m={'message'}>
              {t('no search results found')}
            </bem.LibList__item>
          </bem.LibList>
        );
    } else {

      window.setTimeout(()=>{
        this.activateSortable();
      }, 1);

      return (
            <bem.LibList m={['done', isSearch ? 'search' : 'default']} ref="liblist">
              {list.map((item)=> {
                var modifiers = [item.asset_type];
                var summ = item.summary;
                return (
                    <bem.LibList__item m={modifiers} key={item.uid} data-uid={item.uid}>
                      <bem.LibList__dragbox />
                      <bem.LibList__label m={'name'}>
                        <ui.AssetName {...item} />
                      </bem.LibList__label>
                      { item.asset_type === 'block' ?
                        <bem.LibList__qtype>
                          {t('block of ___ questions').replace('___', summ.row_count)}
                        </bem.LibList__qtype>
                      : null }
                      { (stores.pageState.state.assetNavExpanded && item.asset_type === 'block') ?
                        <ol>
                          {summ.labels.map(function(lbl){
                            return <li>{lbl}</li>;
                          })}
                        </ol>
                      : null }
                      { stores.pageState.state.assetNavExpanded ?
                        <bem.LibList__tags>
                          {(item.tags || []).map((tg)=>{
                            return <bem.LibList__tag>{tg}</bem.LibList__tag>;
                          })}
                        </bem.LibList__tags>
                      : null }
                    </bem.LibList__item>
                  );
              })}
            </bem.LibList>
        );
    }
  },
});

var AssetNavigator = React.createClass({
  mixins: [
    mixins.droppable,
    Reflux.connectFilter(stores.assetSearch, 'searchResults', function(results){
      if (this.searchFieldValue() === results.query) {
        return results;
      }
    }),
    Reflux.connect(stores.tags, 'tags')
  ],
  componentDidMount() {
    this.listenTo(stores.assetLibrary, this.assetLibraryTrigger);
    this.listenTo(stores.pageState, this.handlePageStateStore);
    this.state.searchContext.mixin.searchDefault();
  },
  assetLibraryTrigger (res) {
    this.setState({
      assetLibraryItems: res
    });
  },
  handlePageStateStore (state) {
    this.setState(state);
  },
  getInitialState () {
    return {
      searchResults: {},
      imports: [],
      searchContext: searches.getSearchContext('library', {
        filterParams: {
          assetType: 'asset_type:question OR asset_type:block'
        }
      }),
      selectedTags: [],
      assetNavIntentOpen: stores.pageState.state.assetNavIntentOpen,
      assetNavIsOpen: stores.pageState.state.assetNavIsOpen
    };
  },
  getImportsByStatus (n) {
    return this.imports.filter((i)=> i.status === n );
  },
  searchFieldValue () {
    return this.refs.navigatorSearchBox.refs.inp.getDOMNode().value;
  },
  liveSearch () {
    var queryInput = this.searchFieldValue(),
      r;
    if (queryInput && queryInput.length > 2) {
      r = stores.assetSearch.getRecentSearch(queryInput);
      if (r) {
        this.setState({
          searchResults: r
        });
      } else {
        actions.search.assets(queryInput);
      }
    }
  },
  _displayAssetLibraryItems () {
    var qresults = this.state.assetLibraryItems;
    // var alItems;
    // var contents;
    if (qresults && qresults.count > 0) {
      // var alItems = qresults.results;
      return (
              <bem.LibList ref="liblist">
                {qresults.results.map((item)=> {
                  var modifiers = [item.asset_type];
                  // var summ = item.summary;
                  return (
                      <bem.LibList__item m={modifiers} key={item.uid} data-uid={item.uid}>
                        <bem.LibList__dragbox />
                        <bem.LibList__label>
                          <ui.AssetName {...item} />
                        </bem.LibList__label>
                        <bem.LibList__qtype>
                          {t(item.asset_type)}
                        </bem.LibList__qtype>
                      </bem.LibList__item>
                    );
                })}
              </bem.LibList>
              );
    } else {
      return (
              <bem.LibList m={'loading'}>
                <bem.LibList__item m={'message'}>
                  <i />
                  {t('loading library assets')}
                </bem.LibList__item>
              </bem.LibList>
              );
    }
  },
  renderSearchResults () {
  },
  toggleTagSelected (tag) {
    var tags = this.state.selectedTags,
        _ti = tags.indexOf(tag);
    if (_ti === -1) {
      tags.push(tag);
    } else {
      tags.splice(tags.indexOf(_ti), 1);
    }
    this.setState({
      selectedTags: tags
    });
  },
  toggleOpen () {
    stores.pageState.toggleAssetNavIntentOpen();
  },
  render () {
    return (
        <bem.LibNav m={{
              deactivated: !this.state.assetNavIsOpen
            }}>
          {this.state.assetNavIsOpen && 
            <bem.LibNav__header>
              <bem.LibNav__logo onClick={this.toggleOpen}>
                <i />
              </bem.LibNav__logo>
              <bem.LibNav__search>
                <ListSearch
                    placeholder={t('search library')}
                    searchContext={this.state.searchContext}
                  />
              </bem.LibNav__search>
              <ListTagFilter searchContext={this.state.searchContext} />
              <ListCollectionFilter searchContext={this.state.searchContext} />
              <ListExpandToggle searchContext={this.state.searchContext} />
            </bem.LibNav__header>
          }
          {this.state.assetNavIsOpen && 
            <bem.LibNav__content>
              <AssetNavigatorListView searchContext={this.state.searchContext} />
            </bem.LibNav__content>
          }
          <bem.LibNav__footer />
        </bem.LibNav>
      );
  }
});

/*
var Icon = React.createClass({
  render () {
    var kls = classNames('fa', `fa-${this.props.fa}`, this.props.also);
    return (
      <i className={kls} />
      );
  }
})
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
*/

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

class StackedIcon extends React.Component {
  render () {
    var size = this.props.size || 'lg';
    var backIcon = this.props.backIcon || 'square';
    var frontIcon = this.props.frontIcon || 'file-o';
    return (
        <span className={classNames('fa-stack', `fa-${size}`, this.props.className)}>
          <i className={`fa fa-${backIcon} fa-stack-2x`}></i>
          <i className={`fa fa-${frontIcon} fa-stack-1x fa-inverse`}></i>
        </span>
      );
  }
}
/*
var ActionLink = React.createClass({
  render () {
    return <bem.AssetRow__actionIcon {...this.props} />
  }
});
var collectionAssetsStore = stores.collectionAssets;
*/

function stringifyRoutes(contextRouter) {
  return JSON.stringify(contextRouter.getCurrentRoutes().map(function(r){
    return {
      name: r.name,
      href: r.path
    };
  }), null, 4);
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
    mainLink = <a href={href}
                  onClick={this.toggleExpandGroup.bind(this)}
                  className={mainClassnames}>{title}&nbsp;&nbsp;{iconEl}</a>;

    // var action = this.props.action || 'view';
    if (links.length > 0) {
      openLink = (
        <a href="#" className={caretClassnames} onClick={this.toggleExpandGroup.bind(this)}><span className="caret" /></a>
      );
      links = (
          <ul className="dropdown-menu">
            {links.map((lnk)=> {
              var _key = lnk.code;
              return (<li key={_key}><a href={lnk.url}>{t(lnk.title || lnk.code)}</a></li>);
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
    // var title = 'there are no available downloads';
    var links = this.props.downloads.map((link) => {
      return assign({
        code: `download.${this.props.kind}.${link.format}`
      }, link);
    });
    return (
      <ButtonGroup href="#"
                    links={links}
                    kind={this.props.kind}
                    disabled={links.length === 0}
                    icon="cloud-download"
                    title={t('download')} />
      );
  }
}


class UserProfileLink extends React.Component {
  render () {
    var before, after, icon;
    if (this.props.icon) {
      icon = (
          <i className={`fa fa-${this.props.icon}`} />
        );
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

class KoBo extends React.Component {
  render () {
    return (
        <span className='kobo'>
          <span className='ko'>Ko</span>
          <span className='bo'>Bo</span>
        </span>
      );
  }
}

/*
var FormInput = React.createClass({
  render () {
    return (
        <div className="form-group">
          <div className="mdl-textfield mdl-js-textfield">
            <input className="mdl-textfield__input" type="text" id={this.props.id}
                  onChange={this.props.onChange} />
            <label className="mdl-textfield__label" htmlFor={this.props.id}>{this.props.label}</label>

          </div>
        </div>
      );
  }
});
*/

var App = React.createClass({
  mixins: [
    Reflux.connect(stores.pageState, 'pageState'),
  ],
  getInitialState () {
    moment.locale(currentLang());
    return assign({}, stores.pageState.state);
  },
  // componentWillMount() {},
  // componentWillReceiveProps() {},
  render() {
    // console.log(this.props);
    var showFormViewTabs = false;
    if (!this.state.drawerHidden && this.props.routes[2] && this.props.routes[2].name == 'form-landing') 
      showFormViewTabs = true;

    return (
      <DocumentTitle title="KoBoToolbox">
        <div className="mdl-wrapper">
          { !this.state.headerHidden && 
            <div className="k-header__bar"></div>
          }
          <bem.PageWrapper m={{
              'asset-nav-present': this.state.assetNavPresent,
              'asset-nav-open': this.state.assetNavIsOpen && this.state.assetNavPresent,
              'fixed-drawer': this.state.showFixedDrawer,
              'header-hidden': this.state.headerHidden,
              'drawer-hidden': this.state.drawerHidden,
                }} className="mdl-layout mdl-layout--fixed-header">
              {/*{ this.state.modal &&*/}
                {/*<Modal params={this.state.modal} />*/}
              {/*}*/}

              { !this.state.headerHidden &&
                <MainHeader {...this.props}/>
              }
              { !this.state.drawerHidden &&
                <Drawer {...this.props}/>
              }
              <bem.PageWrapper__content className='mdl-layout__content' m={showFormViewTabs ? 'form-landing' : ''}>
                {/*<FormViewTabs type={'top'} show={showFormViewTabs} />*/}
                {/*<FormViewTabs type={'side'} show={showFormViewTabs} />*/}
                {this.props.children}
                {/*{React.cloneElement(this.props.children, {appstate: this.state})}*/}

              </bem.PageWrapper__content>
              { this.state.assetNavPresent ?
                <AssetNavigator />
              : null }
          </bem.PageWrapper>
        </div>
      </DocumentTitle>
    );
  },
  componentDidUpdate() {
    mdl.upgradeDom();
  }
});

// intended to provide a component we can export to html
var Loading = React.createClass({
  render () {
    return (
        <bem.Loading>
          <bem.Loading__inner>
            <i />
            {t('loading kobotoolbox')}
          </bem.Loading__inner>
        </bem.Loading>
      );
  }
});

var Forms = React.createClass({
  // mixins: [
  //   Navigation
  // ],
  // statics: {
  //   willTransitionTo: function(transition, params, idk, callback) {
  //     if (params.assetid && params.assetid[0] === 'c') {
  //       transition.redirect('collection-page', {
  //         uid: params.assetid
  //       });
  //     }
  //     callback();
  //   }
  // },
  render () {
    return this.props.children;
  }
});

// var FormDownload = React.createClass({
//   statics: {
//     willTransitionTo: function(transition, params, idk, callback) {
//       actions.resources.loadAsset({id: params.assetid});
//       callback();
//     }
//   },
//   componentDidMount () {
//     this.listenTo(assetStore, this.assetStoreTriggered);
//   },
//   getInitialState () {
//     return {
//       downloads: []
//     };
//   },
//   assetStoreTriggered (data, uid) {
//     this.setState({
//       downloads: data[uid].downloads
//     });
//   },
//   render () {
//     return (
//         <ui.Panel>
//           <ul>
//             {
//               this.state.downloads.map(function(item){
//                 var fmt = `download-format-${item.format}`;
//                 return (
//                     <li>
//                       <a href={item.url} ref={fmt}>
//                         {t(fmt)}
//                       </a>
//                     </li>
//                   );
//               })
//             }
//           </ul>
//         </ui.Panel>
//       );
//   }
// });

var FormJson = React.createClass({
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      actions.resources.loadAsset({id: params.assetid});
      callback();
    }
  },
  componentDidMount () {
    this.listenTo(assetStore, this.assetStoreTriggered);
  },
  assetStoreTriggered (data, uid) {
    this.setState({
      assetcontent: data[uid].content
    });
  },
  getInitialState () {
    return {
      assetcontent: false
    };
  },
  render () {
    return (
        <ui.Panel>
          <pre>
            <code>
              { this.state.assetcontent ?
                JSON.stringify(this.state.assetcontent, null, 4)
             : null }
            </code>
          </pre>
        </ui.Panel>
      );
  }
});

var FormXform = React.createClass({
  componentDidMount () {
    dataInterface.getAssetXformView(this.props.params.assetid).done((content)=>{
      this.setState({
        xformLoaded: true,
        xformHtml: {
          __html: $('<div>').html(content).find('.pygment').html()
        },
      });
    });
  },
  getInitialState () {
    return {
      xformLoaded: false
    };
  },
  render () {
    if (!this.state.xformLoaded) {
      return (
          <p>XForm is loading</p>
        );
    } else {
      return (
          <div className="pygment"
                    dangerouslySetInnerHTML={this.state.xformHtml}
                  />
        );
    }
  }
});

var LibrarySearchableList = require('./lists/library');
var FormsSearchableList = require('./lists/forms');
var CollectionList = require('./lists/collection');

var CollectionLanding = require('./lists/collectionlanding');

var FormNotFound = React.createClass({
  render () {
    return (
        <ui.Panel>
          <bem.Loading>
            <bem.Loading__inner>
              {t('path not found / recognized')}
            </bem.Loading__inner>
          </bem.Loading>
        </ui.Panel>
      );
  }
});

var UserList = React.createClass({
  render () {
    return (
        <ui.Panel className="k-div--userlist">
          <h1>{t('users')}</h1>
        </ui.Panel>
      );
  }
});

var UserProfile = React.createClass({
  render () {
    var username = this.props.username;
    return (
        <ui.Panel className="k-div--userprofile">
          <h1>{t('user')}: {username}</h1>
          <hr />
          <div className="well">
            <h3 className="page-header">
              {t('my forms shared with user')}
            </h3>
            <div className="well-content">
              <p>There are no forms shared with this user?</p>
            </div>
          </div>

          <div className="well">
            <h3 className="page-header">
              {t('public forms')}
            </h3>
            <div className="well-content">
              <p>This user has no public forms</p>
            </div>
          </div>

        </ui.Panel>
      );
  }
});

var Public = React.createClass({
  render () {
    return (
      <div>
        <p>Public</p>
      </div>
      );
  }
});

// var Builder = React.createClass({
//   mixins: [Navigation],
//   render () {
//     var _routes = stringifyRoutes(this.context.router);
//     return (
//       <ui.Panel className="k-div--builder">
//         <h1 className="page-header">Builder</h1>
//         <hr />
//         <pre>
//           <code>
//             {_routes}
//             <hr />
//             {JSON.stringify(this.context.router.getCurrentParams(), null, 4)}
//           </code>
//         </pre>
//       </ui.Panel>
//       );
//   }
// });

var SelfProfile = React.createClass({
  render () {
    return (
        <ui.Panel className="k-div--selfprofile">
          <em>{t('self profile')}</em>
        </ui.Panel>
      );
  }
});


var SectionNotFound = React.createClass({
  render () {
    return (
        <ui.Panel className="k404">
          <i />
          <em>section not found</em>
        </ui.Panel>
      );
  }
});

var routes = (
  <Route name="home" path="/" component={App}>
    <Route name="account-settings" path="account-settings" component={AccountSettings} />
    <Route name="change-password" component={ChangePassword} />

    <Route name="library" path="library">
      <Route name="library-new-form" path="new" component={AddToLibrary} />
      <Route name="library-form-landing" path="/library/:assetid">
        {/*<Route name="library-form-download" path="download" handler={FormDownload} />,*/}
        <Route name="library-form-json" path="json" handler={FormJson} />,
        <Route name="library-form-xform" path="xform" handler={FormXform} />,
        <Route name="library-form-edit" path="edit" handler={FormPage} />
        <IndexRoute component={FormLanding} />
      </Route>
      <IndexRoute component={LibrarySearchableList} />
    </Route>

    <IndexRedirect to="forms" />
    <Route name="forms" path="forms" component={Forms}>
      <IndexRoute component={FormsSearchableList} />

      <Route name="form-landing" path="/forms/:assetid"> 
        {/*<Route name="form-download" path="download" component={FormDownload} />*/}
        <Route name="form-json" path="json" component={FormJson} />
        <Route name="form-xform" path="xform" component={FormXform} />
        <Route name="form-reports" path="reports" component={Reports} />
        <Route name='form-edit' path="edit" component={FormPage} />
        <Route name='form-data-report' path="data/report" component={FormSubScreens} />
        <Route name='form-data-table' path="data/table" component={FormSubScreens} />
        <Route name='form-data-downloads' path="data/downloads" component={FormSubScreens} />
        <Route name='form-data-gallery' path="data/gallery" component={FormSubScreens} />
        <Route name='form-data-map' path="data/map" component={FormSubScreens} />
        <Route name='form-settings' path="settings" component={FormSubScreens} />
        <Route name='form-settings-kobocat' path="settings/kobocat" component={FormSubScreens} />
        <Route name='form-settings-sharing' path="settings/sharing" component={FormSubScreens} />
        <Route name='form-collect-web' path="collect" component={FormSubScreens} />
        <Route name='form-collect-android' path="android" component={FormSubScreens} />
        <IndexRoute component={FormLanding} />
      </Route>

      <Route path="*" component={FormNotFound} />
    </Route>

{/*    <Route name="collections">
      <Route name="collection-page" path=":uid" component={CollectionLanding} />
      <IndexRoute component={CollectionList} />
    </Route>

    <Route name="users">
      <IndexRoute name="users-list" component={UserList} />
      <Route name="user-profile" component={UserProfile}
              path="/users/:username" />
    </Route>
*/}

    {/*<Route name="public" component={Public}>
      <Route name="public-builder" component={Builder} />
    </Route>*/}
    {/*<Route name="profile" component={SelfProfile} />*/}

    <Route path="*" component={SectionNotFound} />
  </Route>
);

class RunRoutes extends React.Component {
  render() {
    return (
      <Router history={browserHistory}>
        {routes}
      </Router>
    );
  }
}

export default RunRoutes;
