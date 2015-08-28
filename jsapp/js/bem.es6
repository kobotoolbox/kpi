import React from 'react/addons';

var BEM = require('./libs/react-create-bem-element');
var bem = BEM.init();

bem.PageWrapper = BEM('page-wrapper');
bem.PageWrapper__content = bem.PageWrapper.__('content');

bem.Loading = BEM('loading');
bem.Loading__message = bem.Loading.__('message');
bem.Loading__img = bem.Loading.__('img', '<img>');

bem.AssetRow = BEM('asset-row', '<li>');
bem.AssetRow__cell        = bem.AssetRow.__('cell');

bem.AssetRow__celllink    = bem.AssetRow.__('celllink', '<a>');
bem.AssetRow__cellmeta    = bem.AssetRow.__('cellmeta');
bem.AssetRow__name        = bem.AssetRow.__('name', '<span>');
bem.AssetRow__tags        = bem.AssetRow.__('tags');
bem.AssetRow__tags__tag   = bem.AssetRow.__('tags__tag', '<span>');
bem.AssetRow__tags__notags = bem.AssetRow.__('tags__notags', '<span>');
bem.AssetRow__actionIcon  = bem.AssetRow.__('action-icon', '<a>');
bem.AssetRow__sharingIcon = bem.AssetRow.__('sharingIcon');
bem.AssetRow__sharingIcon__owner =
                bem.AssetRow__sharingIcon.__('owner', '<span>');

bem.Search = BEM('search');
bem.Search__icon = bem.Search.__('icon', '<i>');
bem.Search__cancel = bem.Search.__('cancel', '<i>');
bem.Search__summary = bem.Search.__('summary');

bem.LibNav = BEM('lib-nav');
bem.LibNav__content = bem.LibNav.__('content');
bem.LibNav__header = bem.LibNav.__('header');
bem.LibNav__footer = bem.LibNav.__('footer');
bem.LibNav__search = bem.LibNav.__('search');
bem.LibNav__logo = bem.LibNav.__('logo');

bem.LibNav__tags = bem.LibNav.__('tags');
bem.LibNav__tag = bem.LibNav.__('tag', '<span>');

bem.LibList = BEM('lib-list', '<ul>')
bem.LibList__item = bem.LibList.__('item', '<li>');
bem.LibList__tags = bem.LibList.__('tags');
bem.LibList__tag = bem.LibList.__('tag', '<span>');
bem.LibList__label = bem.LibList.__('label');
bem.LibList__dragbox = bem.LibList.__('dragbox');
bem.LibList__qtype = bem.LibList.__('qtype');

bem.CollectionNav = bem('collection-nav');
bem.CollectionNav__search = bem.CollectionNav.__('search');
bem.CollectionNav__searchcriteria = bem.CollectionNav.__('searchcriteria', '<ul>');
bem.CollectionNav__searchcriterion = bem.CollectionNav.__('searchcriterion', '<li>');
bem.CollectionNav__actions = bem.CollectionNav.__('actions');
bem.CollectionNav__button = bem.CollectionNav.__('button', '<button>');
bem.CollectionNav__link = bem.CollectionNav.__('link', '<a>');
bem.CollectionNav__searchcancel = bem.CollectionNav.__('searchcancel', '<i>');
bem.CollectionNav__searchicon = bem.CollectionNav.__('searchicon', '<i>');

bem.CollectionAssetList = bem('collection-asset-list', '<ul>');
bem.CollectionAssetList__message = bem.CollectionAssetList.__('message');

bem.CollectionHeader = bem('collection-header');
bem.CollectionHeader__item = bem.CollectionHeader.__('item');
bem.CollectionHeader__input = bem.CollectionHeader.__('input', '<input>');
bem.CollectionHeader__buttonRow = bem('collection-header__button-row');
bem.CollectionHeader__iconwrap = bem.CollectionHeader.__('iconwrap')

bem.CollectionHeader__buttonGroup = bem('collection-header__button-group', [
                      'new',
                      'actions',
                      'deploy',

                      'flat',
                      'disabled',
                    ]);

bem.Message = BEM('message');

bem.ListView = BEM('list-view');
bem.ListView__header = bem.ListView.__('header');
bem.ListView__content = bem.ListView.__('content');
bem.ListView__search = bem.ListView.__('search');
bem.ListView__searchcriteria = bem.ListView.__('searchcriteria', '<ul>');
bem.ListView__searchcriterion = bem.ListView.__('searchcriterion', '<li>');
bem.ListView__headerbutton = bem.ListView.__('headerbutton');
bem.ListView__attr = bem.ListView.__('attr');

bem.AssetView = BEM('asset-view');
// bem.AssetView__header = bem.AssetView.__('header');
// bem.AssetView__attr = bem.AssetView.__('attr');
// bem.AssetView__icon = bem.AssetView.__('icon');

bem.AssetView__label = bem.AssetView.__('label', '<label>');
bem.AssetView__content = bem.AssetView.__('content');
bem.AssetView__value = bem.AssetView.__('value', '<span>');
bem.AssetView__assetTypeWrap = bem.AssetView.__('asset-type-wrap');
bem.AssetView__assetType = bem.AssetView.__('asset-type');

bem.AssetView__row = bem.AssetView.__('row');
bem.AssetView__name = bem.AssetView.__('name');
bem.AssetView__key = bem.AssetView.__('key');
bem.AssetView__val = bem.AssetView.__('val');
bem.AssetView__ancestor = bem.AssetView.__('ancestor');
bem.AssetView__ancestors = bem.AssetView.__('ancestors');
bem.AssetView__parent = bem.AssetView.__('parent');
bem.AssetView__iconwrap = bem.AssetView.__('iconwrap')
bem.AssetView__times = bem.AssetView.__('times');
bem.AssetView__col = bem.AssetView.__('col');
bem.AssetView__span = bem.AssetView.__('span', '<span>');
bem.AssetView__colsubtext = bem.AssetView.__('colsubtext');
bem.AssetView__tags = bem.AssetView.__('tags');
bem.AssetView__tags__tag = bem.AssetView__tags.__('tag', '<span>');
bem.AssetView__users = bem.AssetView.__('users');
bem.AssetView__inlibrary = bem.AssetView.__('inlibrary');
bem.AssetView__langs = bem.AssetView.__('langs');
bem.AssetView__buttons = bem.AssetView.__('buttons');
bem.AssetView__buttoncol = bem.AssetView.__('buttoncol');
bem.AssetView__button = bem.AssetView.__('button', '<button>');
bem.AssetView__link = bem.AssetView.__('link', '<a>');
bem.AssetView__deployments = bem.AssetView.__('deployments');
bem.AssetView__deploybutton = bem.AssetView.__('deploybutton', '<button>');



bem.CollectionHeader__button = bem.CollectionHeader.__('button', '<a>')

// bem.Sidebar = BEM('sidebar')
// bem.Sidebar__link = bem.Sidebar.__('link');
// bem.Sidebar__title = bem.Sidebar.__('title');
// bem.Sidebar__footer = bem.Sidebar.__('footer');
// bem.Sidebar__footeritem = bem.Sidebar.__('footeritem');

// trying out an alternative syntax
bem.Sidebar = bem('sidebar');
bem.Sidebar__link = bem('sidebar__link', ['active']);
bem.Sidebar__title = bem('sidebar__title');
bem.Sidebar__footer = bem('sidebar__footer');
bem.Sidebar__footeritem = bem('sidebar__footeritem');

bem.AccountBox = BEM('account-box');
bem.AccountBox__name =      bem.AccountBox.__('name', '<span>');
bem.AccountBox__image =     bem.AccountBox.__('image', '<span>');
bem.AccountBox__logo =     	bem.AccountBox.__('logo', '<span>');
// bem.AccountBox__indicator = bem.AccountBox.__('indicator');
// bem.AccountBox__logout =    bem.AccountBox.__('logout');

bem.uiPanel = BEM('ui-panel');
bem.uiPanel__body = bem.uiPanel.__('body');

export default bem;