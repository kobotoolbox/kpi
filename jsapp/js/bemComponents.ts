/**
 * A list of some of our BEM components. We used to define all of them here, but
 * recently decided to define them inside their component files. Please don't
 * add anything more here :kiss:
 */

import bem, {makeBem} from 'js/bem';

bem.KoboSelect = makeBem(null, 'kobo-select');
bem.KoboSelect__wrapper = makeBem(bem.KoboSelect, 'wrapper');
bem.KoboSelect__label = makeBem(bem.KoboSelect, 'label', 'span');
bem.KoboSelect__error = makeBem(bem.KoboSelect, 'error');
bem.KoboSelect__optionWrapper = makeBem(bem.KoboSelect, 'option-wrapper');
bem.KoboSelect__optionBadge = makeBem(bem.KoboSelect, 'option-badge');

bem.PageWrapper = makeBem(null, 'page-wrapper');
bem.PageWrapper__content = makeBem(bem.PageWrapper, 'content');

bem.EmptyContent = makeBem(null, 'empty-content', 'section');
bem.EmptyContent__icon = makeBem(bem.EmptyContent, 'icon', 'i');
bem.EmptyContent__title = makeBem(bem.EmptyContent, 'title', 'h1');
bem.EmptyContent__message = makeBem(bem.EmptyContent, 'message', 'p');

bem.ServiceRow = makeBem(null, 'service-row');
bem.ServiceRow__column = makeBem(bem.ServiceRow, 'column');
bem.ServiceRow__linkOverlay = makeBem(bem.ServiceRow, 'link-overlay', 'a');

bem.FormBuilder = makeBem(null, 'form-builder');
bem.FormBuilder__contents = makeBem(bem.FormBuilder, 'contents');

bem.FormBuilderMessageBox = makeBem(null, 'form-builder-message-box');
bem.FormBuilderMessageBox__toggle = makeBem(bem.FormBuilderMessageBox, 'toggle', 'button');
bem.FormBuilderMessageBox__details = makeBem(bem.FormBuilderMessageBox, 'details', 'section');

bem.FormBuilderAside = makeBem(null, 'form-builder-aside');
bem.FormBuilderAside__content = makeBem(bem.FormBuilderAside, 'content');
bem.FormBuilderAside__header = makeBem(bem.FormBuilderAside, 'header', 'h2');
bem.FormBuilderAside__row = makeBem(bem.FormBuilderAside, 'row', 'section');

bem.FormBuilderHeader = makeBem(null, 'form-builder-header');
bem.FormBuilderHeader__row = makeBem(bem.FormBuilderHeader, 'row');
bem.FormBuilderHeader__cell = makeBem(bem.FormBuilderHeader, 'cell');
bem.FormBuilderHeader__item = makeBem(bem.FormBuilderHeader, 'item', 'span');

bem.FormMedia = makeBem(null, 'form-media');
bem.FormMedia__title = makeBem(bem.FormMedia, 'title');
bem.FormMedia__upload = makeBem(bem.FormMedia, 'upload');
bem.FormMedia__list = makeBem(bem.FormMedia, 'list');
bem.FormMedia__label = makeBem(bem.FormMedia, 'label', 'label');
bem.FormMedia__listItem = makeBem(bem.FormMedia, 'list-item', 'li');

bem.SearchInput = makeBem(null, 'search-input', 'input');

bem.Search = makeBem(null, 'search');
bem.Search__icon = makeBem(bem.Search, 'icon', 'i');
bem.Search__cancel = makeBem(bem.Search, 'cancel', 'i');

bem.LibNav = makeBem(null, 'lib-nav');
bem.LibNav__content = makeBem(bem.LibNav, 'content');
bem.LibNav__header = makeBem(bem.LibNav, 'header');
bem.LibNav__footer = makeBem(bem.LibNav, 'footer');
bem.LibNav__search = makeBem(bem.LibNav, 'search');
bem.LibNav__expanded = makeBem(bem.LibNav, 'expanded');
bem.LibNav__count = makeBem(bem.LibNav, 'count');
bem.LibNav__expandedToggle = makeBem(bem.LibNav, 'expandedToggle');

bem.TemplatesList = makeBem(null, 'templates-list');
bem.TemplatesList__header = makeBem(bem.TemplatesList, 'header');
bem.TemplatesList__column = makeBem(bem.TemplatesList, 'column');
bem.TemplatesList__template = makeBem(bem.TemplatesList, 'template', 'label');
bem.TemplatesList__templateRadio = makeBem(bem.TemplatesList, 'template-radio', 'input');

bem.LibList = makeBem(null, 'lib-list', 'ul');
bem.LibList__item = makeBem(bem.LibList, 'item', 'li');
bem.LibList__tags = makeBem(bem.LibList, 'tags');
bem.LibList__tag = makeBem(bem.LibList, 'tag', 'span');
bem.LibList__label = makeBem(bem.LibList, 'label');
bem.LibList__dragbox = makeBem(bem.LibList, 'dragbox');
bem.LibList__qtype = makeBem(bem.LibList, 'qtype');

bem.TableMeta = makeBem(null, 'table-meta');
bem.TableMeta__counter = makeBem(bem.TableMeta, 'counter');
bem.TableMeta__additionalText = makeBem(bem.TableMeta, 'additional-text', 'span'); // generally text not needed on smaller screens
bem.TableMeta__bulkOptions = makeBem(bem.TableMeta, 'bulk-options');

bem.CollectionsWrapper = makeBem(null, 'collections-wrapper');

bem.FormView = makeBem(null, 'form-view');
// used in header.es6
bem.FormView__title = makeBem(bem.FormView, 'title');
bem.FormView__name = makeBem(bem.FormView, 'name');
bem.FormView__description = makeBem(bem.FormView, 'description');
bem.FormView__subs = makeBem(bem.FormView, 'subs');
// end used in header.es6
bem.FormView__sidetabs = makeBem(bem.FormView, 'sidetabs');

bem.FormView__label = makeBem(bem.FormView, 'label');
bem.FormView__group = makeBem(bem.FormView, 'group');
bem.FormView__item = makeBem(bem.FormView, 'item');

bem.FormView__row = makeBem(bem.FormView, 'row');
bem.FormView__cell = makeBem(bem.FormView, 'cell');
bem.FormView__cellLabel = makeBem(bem.FormView, 'cell-label');
bem.FormView__column = makeBem(bem.FormView, 'column');

bem.FormView__banner = makeBem(bem.FormView, 'banner');
bem.FormView__reportButtons = makeBem(bem.FormView, 'reportButtons');
bem.FormView__form = makeBem(bem.FormView, 'form', 'form');

bem.FormView__map = makeBem(bem.FormView, 'map');
bem.FormView__mapButton = makeBem(bem.FormView, 'map-button');
bem.FormView__mapList = makeBem(bem.FormView, 'map-list');

bem.ReportView = makeBem(null, 'report-view');
bem.ReportView__wrap = makeBem(bem.ReportView, 'wrap');
bem.ReportView__item = makeBem(bem.ReportView, 'item');
bem.ReportView__itemHeading = makeBem(bem.ReportView, 'itemHeading');
bem.ReportView__headingMeta = makeBem(bem.ReportView, 'headingMeta');
bem.ReportView__itemContent = makeBem(bem.ReportView, 'itemContent');
bem.ReportView__chart = makeBem(bem.ReportView, 'chart');

bem.GraphSettings = makeBem(null, 'graph-settings');
bem.GraphSettings__colors = makeBem(bem.GraphSettings, 'colors');
bem.GraphSettings__radio = makeBem(bem.GraphSettings, 'radio');

bem.FormModal = makeBem(null, 'form-modal');
bem.FormModal__form = makeBem(bem.FormModal, 'form', 'form');
bem.FormModal__item = makeBem(bem.FormModal, 'item');
bem.FormModal__group = makeBem(bem.FormModal, 'group');

bem.Modal = makeBem(null, 'modal');
bem.Modal__backdrop = makeBem(bem.Modal, 'backdrop');
bem.Modal__body = makeBem(bem.Modal, 'body');
bem.Modal__content = makeBem(bem.Modal, 'content');
bem.Modal__header = makeBem(bem.Modal, 'header', 'header');
bem.Modal__title = makeBem(bem.Modal, 'title', 'h4');
bem.Modal__subheader = makeBem(bem.Modal, 'subheader', 'header');
bem.Modal__footer = makeBem(bem.Modal, 'footer', 'footer');
bem.Modal__tabs = makeBem(bem.Modal, 'tabs');
bem.Modal__hr = makeBem(bem.Modal, 'hr', 'hr');

bem.PopoverMenu = makeBem(null, 'popover-menu');
bem.PopoverMenu__content = makeBem(bem.PopoverMenu, 'content');
bem.PopoverMenu__toggle = makeBem(bem.PopoverMenu, 'toggle', 'a');
bem.PopoverMenu__link = makeBem(bem.PopoverMenu, 'link', 'a');
bem.PopoverMenu__item = makeBem(bem.PopoverMenu, 'item');
bem.PopoverMenu__heading = makeBem(bem.PopoverMenu, 'heading');
bem.PopoverMenu__moveTo = makeBem(bem.PopoverMenu, 'moveTo');

bem.LoginBox = makeBem(null, 'login-box');

bem.AccountBox = makeBem(null, 'account-box');
bem.AccountBox__name = makeBem(bem.AccountBox, 'name', 'div');
bem.AccountBox__menu = makeBem(bem.AccountBox, 'menu', 'ul');
bem.AccountBox__menuLI = makeBem(bem.AccountBox, 'menu-li', 'li');
bem.AccountBox__menuItem = makeBem(bem.AccountBox, 'menu-item', 'div');
bem.AccountBox__menuLink = makeBem(bem.AccountBox, 'menu-link', 'a');

bem.UserRow = makeBem(null, 'user-row');
bem.UserRow__info = makeBem(bem.UserRow, 'info');
bem.UserRow__avatar = makeBem(bem.UserRow, 'avatar');
bem.UserRow__name = makeBem(bem.UserRow, 'name');
bem.UserRow__email = makeBem(bem.UserRow, 'email');
bem.UserRow__perms = makeBem(bem.UserRow, 'perms');
bem.UserRow__perm = makeBem(bem.UserRow, 'perm');
bem.UserRow__editor = makeBem(bem.UserRow, 'editor');

bem.FormSidebarWrapper = makeBem(null, 'form-sidebar-wrapper');
bem.FormSidebar = makeBem(null, 'form-sidebar');
bem.FormSidebar__item = makeBem(bem.FormSidebar, 'item', 'a');
bem.FormSidebar__itemText = makeBem(bem.FormSidebar, 'item-text');
bem.FormSidebar__label = makeBem(bem.FormSidebar, 'label');
bem.FormSidebar__labelText = makeBem(bem.FormSidebar, 'label-text');
bem.FormSidebar__labelCount = makeBem(bem.FormSidebar, 'label-count');
bem.FormSidebar__grouping = makeBem(bem.FormSidebar, 'grouping');

bem.KDrawer = makeBem(null, 'k-drawer');
bem.KDrawer__primaryIcons = makeBem(bem.KDrawer, 'primary-icons', 'nav');
bem.KDrawer__secondaryIcons = makeBem(bem.KDrawer, 'secondary-icons', 'nav');
bem.KDrawer__sidebar = makeBem(bem.KDrawer, 'sidebar', 'aside');

bem.tagSelect = makeBem(null, 'tag-select');
bem.collectionFilter = makeBem(null, 'collection-filter');

bem.ToggleSwitch = makeBem(null, 'toggle-switch');
bem.ToggleSwitch__wrapper = makeBem(bem.ToggleSwitch, 'wrapper', 'label');
bem.ToggleSwitch__input = makeBem(bem.ToggleSwitch, 'input', 'input');
bem.ToggleSwitch__slider = makeBem(bem.ToggleSwitch, 'slider', 'span');
bem.ToggleSwitch__label = makeBem(bem.ToggleSwitch, 'label', 'span');

bem.Breadcrumbs = makeBem(null, 'breadcrumbs');
bem.Breadcrumbs__crumb = makeBem(bem.Breadcrumbs, 'crumb', 'a');
bem.Breadcrumbs__divider = makeBem(bem.Breadcrumbs, 'divider', 'i');

bem.AssetInfoBox = makeBem(null, 'asset-info-box');
bem.AssetInfoBox__column = makeBem(bem.AssetInfoBox, 'column');
bem.AssetInfoBox__cell = makeBem(bem.AssetInfoBox, 'cell');

bem.PrintOnly = makeBem(null, 'print-only');

bem.ProjectDownloads = makeBem(null, 'project-downloads');
bem.ProjectDownloads__advancedView = makeBem(bem.ProjectDownloads, 'advanced-view', 'section');
bem.ProjectDownloads__column = makeBem(bem.ProjectDownloads, 'column');
bem.ProjectDownloads__columnRow = makeBem(bem.ProjectDownloads, 'column-row');
bem.ProjectDownloads__title = makeBem(bem.ProjectDownloads, 'title', 'span');
bem.ProjectDownloads__selectorRow = makeBem(bem.ProjectDownloads, 'selector-row');
bem.ProjectDownloads__anonymousRow = makeBem(bem.ProjectDownloads, 'anonymous-row');
bem.ProjectDownloads__legacyIframeWrapper = makeBem(bem.ProjectDownloads, 'legacy-iframe-wrapper');
bem.ProjectDownloads__submitRow = makeBem(bem.ProjectDownloads, 'submit-row', 'footer');
bem.ProjectDownloads__exportsSelector = makeBem(bem.ProjectDownloads, 'exports-selector');
bem.ProjectDownloads__exportsCreator = makeBem(bem.ProjectDownloads, 'exports-creator');

bem.BackgroundAudioPlayer = makeBem(null, 'background-audio-player');
bem.BackgroundAudioPlayer__label = makeBem(bem.BackgroundAudioPlayer, 'label', 'label');
bem.BackgroundAudioPlayer__audio = makeBem(bem.BackgroundAudioPlayer, 'audio', 'audio');
