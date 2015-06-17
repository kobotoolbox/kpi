import React from 'react/addons';

var BEM = require('./libs/react-create-bem-element').logClassNames();
var bem = BEM.init();

bem.PageWrapper = BEM('page-wrapper');
bem.PageWrapper__content = bem.PageWrapper.__('content');

bem.AssetRow = BEM('asset-row', '<li>');
bem.AssetRow__cell        = bem.AssetRow.__('cell');
bem.AssetRow__actionIcon  = bem.AssetRow.__('action-icon', '<a>');
bem.AssetRow__sharingIcon = bem.AssetRow.__('sharingIcon');
bem.AssetRow__sharingIcon__owner = 
                bem.AssetRow__sharingIcon.__('owner', '<span>');

bem.CollectionHeader = bem('collection-header');
bem.CollectionHeader__buttonRow = bem('collection-header__button-row')
bem.CollectionHeader__buttonGroup = bem('collection-header__button-group', [
                      'new',
                      'actions',
                      'deploy',

                      'flat',
                      'disabled',
                    ]);

bem.CollectionHeader__button = bem.CollectionHeader.__('button', '<a>')
// bem('collection-header__button', '<button>', [
//                         'new-form',
//                         'view-form',      'view-collection',
//                         'edit-form',      'edit-collection',
//                         'preview-form',   'preview-collection',
//                         'clone-form',     'clone-collection',
//                         'download-form',  'download-collection',
//                         'delete',

//                         'disabled',
//                     ]);

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
bem.AccountBox__name =      bem.AccountBox.__('name');
bem.AccountBox__image =     bem.AccountBox.__('image');
bem.AccountBox__indicator = bem.AccountBox.__('indicator');
bem.AccountBox__logout =    bem.AccountBox.__('logout');

bem.uiPanel = BEM('ui-panel');
bem.uiPanel__body = bem.uiPanel.__('body');


export default bem;