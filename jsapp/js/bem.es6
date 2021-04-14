/**
 * A list of all our BEM components. It helps avoiding errors and code bloat.
 * Instead of writing BEM class names for `<div>`, please import this module and
 * use `<bem.ModuleName__partial m={['modifier1', 'modifier2']}>` in your JSX.
 */

import {BEM} from './libs/react-create-bem-element';
export const bem = BEM.init();

bem.Button = BEM('mdl-button', '<button>');

bem.KoboButton = BEM('kobo-button', '<button>');
bem.KoboLightButton = BEM('kobo-light-button', '<button>');
bem.KoboTextButton = BEM('kobo-text-button', '<button>');
bem.KoboLightBadge = BEM('kobo-light-badge', '<span>');

bem.PageWrapper = BEM('page-wrapper');
bem.PageWrapper__content = bem.PageWrapper.__('content');

bem.Loading = BEM('loading');
bem.Loading__inner = bem.Loading.__('inner');
bem.Loading__msg = bem.Loading.__('msg');

bem.EmptyContent = BEM('empty-content', '<section>');
bem.EmptyContent__icon = bem.EmptyContent.__('icon', '<i>');
bem.EmptyContent__title = bem.EmptyContent.__('title', '<h1>');
bem.EmptyContent__message = bem.EmptyContent.__('message', '<p>');
bem.EmptyContent__button = bem.EmptyContent.__('button', '<button>');

bem.AssetRow = BEM('asset-row', '<li>');
bem.AssetRow__cell        = bem.AssetRow.__('cell');
bem.AssetRow__cellmeta    = bem.AssetRow.__('cellmeta');
bem.AssetRow__description = bem.AssetRow.__('description', '<span>');
bem.AssetRow__tags        = bem.AssetRow.__('tags');
bem.AssetRow__tags__tag   = bem.AssetRow.__('tags__tag', '<span>');
bem.AssetRow__tags__notags = bem.AssetRow.__('tags__notags', '<span>');
bem.AssetRow__actionIcon  = bem.AssetRow.__('action-icon', '<a>');
bem.AssetRow__buttons        = bem.AssetRow.__('buttons');
bem.AssetRow__typeIcon  = bem.AssetRow.__('type-icon', '<span>');

bem.ServiceRow = BEM('service-row');
bem.ServiceRow__column = bem.ServiceRow.__('column');
bem.ServiceRow__actionButton = bem.ServiceRow.__('action-button', '<button>');
bem.ServiceRow__linkOverlay = bem.ServiceRow.__('link-overlay', '<a>');
bem.ServiceRowButton = BEM('service-row-button', '<button>');

bem.FormBuilder = BEM('form-builder');
bem.FormBuilder__contents = bem.FormBuilder.__('contents');

bem.FormBuilderMessageBox = BEM('form-builder-message-box');
bem.FormBuilderMessageBox__toggle = bem.FormBuilderMessageBox.__('toggle', 'button');
bem.FormBuilderMessageBox__details = bem.FormBuilderMessageBox.__('details', 'section');
bem.FormBuilderMessageBox__list = bem.FormBuilderMessageBox.__('list', 'ul');
bem.FormBuilderMessageBox__listTitle = bem.FormBuilderMessageBox.__('list-title', 'label');
bem.FormBuilderMessageBox__listItem = bem.FormBuilderMessageBox.__('list-item', 'li');

bem.FormBuilderMeta = bem('form-builder-meta');
bem.FormBuilderMeta__columns = bem.FormBuilderMeta.__('columns');
bem.FormBuilderMeta__column = bem.FormBuilderMeta.__('column');
bem.FormBuilderMeta__row = bem.FormBuilderMeta.__('row');

bem.FormBuilderAside = BEM('form-builder-aside');
bem.FormBuilderAside__content = bem.FormBuilderAside.__('content');
bem.FormBuilderAside__header = bem.FormBuilderAside.__('header', '<h2>');
bem.FormBuilderAside__row = bem.FormBuilderAside.__('row', '<section>');

bem.FormBuilderHeader = BEM('form-builder-header');
bem.FormBuilderHeader__row = bem.FormBuilderHeader.__('row');
bem.FormBuilderHeader__cell = bem.FormBuilderHeader.__('cell');
bem.FormBuilderHeader__item = bem.FormBuilderHeader.__('item', '<span>');
bem.FormBuilderHeader__button = bem.FormBuilderHeader.__('button', '<button>');
bem.FormBuilderHeader__close = bem.FormBuilderHeader.__('close', '<button>');

bem.Search = BEM('search');
bem.Search__icon = bem.Search.__('icon', '<i>');
bem.Search__cancel = bem.Search.__('cancel', '<i>');
bem.Search__summary = bem.Search.__('summary');

bem.LibNav = BEM('lib-nav');
bem.LibNav__content = bem.LibNav.__('content');
bem.LibNav__header = bem.LibNav.__('header');
bem.LibNav__footer = bem.LibNav.__('footer');
bem.LibNav__search = bem.LibNav.__('search');
bem.LibNav__expanded = bem.LibNav.__('expanded');
bem.LibNav__count = bem.LibNav.__('count');
bem.LibNav__expandedToggle = bem.LibNav.__('expandedToggle');

bem.TemplatesList = BEM('templates-list');
bem.TemplatesList__header = bem.TemplatesList.__('header');
bem.TemplatesList__column = bem.TemplatesList.__('column');
bem.TemplatesList__template = bem.TemplatesList.__('template', '<label>');
bem.TemplatesList__templateRadio = bem.TemplatesList.__('template-radio', '<input>');

bem.LibList = BEM('lib-list', '<ul>');
bem.LibList__item = bem.LibList.__('item', '<li>');
bem.LibList__tags = bem.LibList.__('tags');
bem.LibList__tag = bem.LibList.__('tag', '<span>');
bem.LibList__label = bem.LibList.__('label');
bem.LibList__dragbox = bem.LibList.__('dragbox');
bem.LibList__qtype = bem.LibList.__('qtype');

bem.SubmissionDataTable = bem('submission-data-table');
bem.SubmissionDataTable__row = bem.SubmissionDataTable.__('row');
bem.SubmissionDataTable__column = bem.SubmissionDataTable.__('column');
bem.SubmissionDataTable__XMLName = bem.SubmissionDataTable.__('xml-name');
bem.SubmissionDataTable__value = bem.SubmissionDataTable.__('value');

bem.TableMeta = bem('table-meta');
bem.TableMeta__counter = bem.TableMeta.__('counter');
bem.TableMeta__additionalText = bem.TableMeta.__('additional-text', 'span'); // generally text not needed on smaller screens
bem.TableMeta__bulkOptions = bem.TableMeta.__('bulk-options');

bem.CollectionsWrapper = bem('collections-wrapper');

bem.CollectionNav = bem('collection-nav');
bem.CollectionNav__search = bem.CollectionNav.__('search');
bem.CollectionNav__searchcriteria = bem.CollectionNav.__('searchcriteria', '<ul>');
bem.CollectionNav__searchcriterion = bem.CollectionNav.__('searchcriterion', '<li>');
bem.CollectionNav__actions = bem.CollectionNav.__('actions');
bem.CollectionNav__button = bem.CollectionNav.__('button', '<button>');
bem.CollectionNav__link = bem.CollectionNav.__('link', '<a>');
bem.CollectionNav__searchcancel = bem.CollectionNav.__('searchcancel', '<i>');
bem.CollectionNav__searchicon = bem.CollectionNav.__('searchicon', '<i>');

bem.Library = BEM('library');
bem.Library__typeFilter = bem.Library.__('type-filter', '<label>');

bem.List = BEM('list');
bem.List__heading = bem.List.__('heading');
bem.List__subheading = bem.List.__('subheading');

bem.AssetList = BEM('asset-list');
bem.AssetItems = BEM('asset-items', '<ul>');

bem.AssetListSorts = BEM('asset-list-sorts', '<div>');
bem.AssetListSorts__item = bem.AssetListSorts.__('item');

bem.FormView = BEM('form-view');
// used in header.es6
bem.FormView__title = bem.FormView.__('title');
bem.FormView__name = bem.FormView.__('name');
bem.FormView__description = bem.FormView.__('description');
bem.FormView__subs = bem.FormView.__('subs');
// end used in header.es6
bem.FormView__toptabs = bem.FormView.__('toptabs');
bem.FormView__sidetabs = bem.FormView.__('sidetabs');
bem.FormView__tab = bem.FormView.__('tab', '<a>');

bem.FormView__label = bem.FormView.__('label');
bem.FormView__group = bem.FormView.__('group');
bem.FormView__item = bem.FormView.__('item');
bem.FormView__iconButton = bem.FormView.__('icon-button', '<button>');

bem.FormView__row = bem.FormView.__('row');
bem.FormView__cell = bem.FormView.__('cell');
bem.FormView__cellLabel = bem.FormView.__('cell-label');
bem.FormView__column = bem.FormView.__('column');

bem.FormView__banner = bem.FormView.__('banner');
bem.FormView__link = bem.FormView.__('link', '<a>');
bem.FormView__secondaryButtons = bem.FormView.__('secondaryButtons');
bem.FormView__secondaryButton = bem.FormView.__('secondaryButton', '<button>');
bem.FormView__reportButtons = bem.FormView.__('reportButtons');
bem.FormView__form = bem.FormView.__('form', '<form>');

bem.FormView__map = bem.FormView.__('map');
bem.FormView__mapButton = bem.FormView.__('map-button');
bem.FormView__mapList = bem.FormView.__('map-list');

bem.MainHeader = BEM('main-header', '<header>');
bem.MainHeader__icon = bem.MainHeader.__('icon', '<i>');
bem.MainHeader__title = bem.MainHeader.__('title');
bem.MainHeader__counter = bem.MainHeader.__('counter');


bem.ReportView = BEM('report-view');
bem.ReportView__wrap = bem.ReportView.__('wrap');
bem.ReportView__item = bem.ReportView.__('item');
bem.ReportView__itemHeading = bem.ReportView.__('itemHeading');
bem.ReportView__headingMeta = bem.ReportView.__('headingMeta');
bem.ReportView__itemContent = bem.ReportView.__('itemContent');
bem.ReportView__headingButton = bem.ReportView.__('headingButton', '<button>');
bem.ReportView__chart = bem.ReportView.__('chart');

bem.GraphSettings = BEM('graph-settings');
bem.GraphSettings__buttons = bem.GraphSettings.__('buttons');
bem.GraphSettings__charttype = bem.GraphSettings.__('charttype');
bem.GraphSettings__colors = bem.GraphSettings.__('colors');
bem.GraphSettings__radio = bem.GraphSettings.__('radio');

bem.FormModal = BEM('form-modal');
bem.FormModal__form = bem.FormModal.__('form', '<form>');
bem.FormModal__item = bem.FormModal.__('item');
bem.FormModal__group = bem.FormModal.__('group');

bem.Modal = BEM('modal');
bem.Modal__backdrop = bem.Modal.__('backdrop');
bem.Modal__body = bem.Modal.__('body');
bem.Modal__content = bem.Modal.__('content');
bem.Modal__header = bem.Modal.__('header', '<header>');
bem.Modal__title = bem.Modal.__('title', '<h4>');
bem.Modal__subheader = bem.Modal.__('subheader', '<header>');
bem.Modal__footer = bem.Modal.__('footer', '<footer>');
bem.Modal__tabs = bem.Modal.__('tabs');
bem.Modal__hr = bem.Modal.__('hr', '<hr>');

bem.PopoverMenu = BEM('popover-menu');
bem.PopoverMenu__content = bem.PopoverMenu.__('content');
bem.PopoverMenu__toggle = bem.PopoverMenu.__('toggle', '<a>');
bem.PopoverMenu__link = bem.PopoverMenu.__('link', '<a>');
bem.PopoverMenu__item = bem.PopoverMenu.__('item');
bem.PopoverMenu__heading = bem.PopoverMenu.__('heading');
bem.PopoverMenu__moveTo = bem.PopoverMenu.__('moveTo');

bem.Header = BEM('header');
bem.Header__logo = bem.Header.__('logo', '<span>');

bem.AccountBox = BEM('account-box');
bem.AccountBox__name = bem.AccountBox.__('name', '<div>');
bem.AccountBox__initials = bem.AccountBox.__('initials', '<span>');
bem.AccountBox__menu = bem.AccountBox.__('menu', '<ul>');
bem.AccountBox__menuLI = bem.AccountBox.__('menu-li', '<li>');
bem.AccountBox__menuItem = bem.AccountBox.__('menu-item', '<div>');
bem.AccountBox__menuLink = bem.AccountBox.__('menu-link', '<a>');

bem.AccountSettings = BEM('account-settings');
bem.AccountSettings__left = bem.AccountSettings.__('left');
bem.AccountSettings__right = bem.AccountSettings.__('right');
bem.AccountSettings__item = bem.FormModal.__('item');
bem.AccountSettings__desc = bem.AccountSettings.__('desc');
bem.AccountSettings__actions = bem.AccountSettings.__('actions');

bem.UserRow = BEM('user-row');
bem.UserRow__info = bem.UserRow.__('info');
bem.UserRow__avatar = bem.UserRow.__('avatar');
bem.UserRow__name = bem.UserRow.__('name');
bem.UserRow__email = bem.UserRow.__('email');
bem.UserRow__perms = bem.UserRow.__('perms');
bem.UserRow__perm = bem.UserRow.__('perm');
bem.UserRow__editor = bem.UserRow.__('editor');

bem.uiPanel = BEM('ui-panel');
bem.uiPanel__body = bem.uiPanel.__('body');

bem.FormSidebar = BEM('form-sidebar');
bem.FormSidebar__item = bem.FormSidebar.__('item', '<a>');
bem.FormSidebar__itemText = bem.FormSidebar.__('item-text');
bem.FormSidebar__label = bem.FormSidebar.__('label', '<a>');
bem.FormSidebar__labelText = bem.FormSidebar.__('label-text');
bem.FormSidebar__labelCount = bem.FormSidebar.__('label-count');
bem.FormSidebar__grouping = bem.FormSidebar.__('grouping');

bem.KDrawer = BEM('k-drawer');
bem.KDrawer__primaryIcons = bem.KDrawer.__('primary-icons', 'nav');
bem.KDrawer__secondaryIcons = bem.KDrawer.__('secondary-icons', 'nav');
bem.KDrawer__sidebar = bem.KDrawer.__('sidebar', 'aside');

bem.HelpBubble = BEM('help-bubble');
bem.HelpBubble__close = bem.HelpBubble.__('close', 'button');
bem.HelpBubble__back = bem.HelpBubble.__('back', 'button');
bem.HelpBubble__trigger = bem.HelpBubble.__('trigger', 'button');
bem.HelpBubble__triggerCounter = bem.HelpBubble.__('trigger-counter', 'span');
bem.HelpBubble__popup = bem.HelpBubble.__('popup');
bem.HelpBubble__popupContent = bem.HelpBubble.__('popup-content');
bem.HelpBubble__row = bem.HelpBubble.__('row');
bem.HelpBubble__rowAnchor = bem.HelpBubble.__('row', 'a');
bem.HelpBubble__rowWrapper = bem.HelpBubble.__('row-wrapper');

bem.SimpleTable = BEM('simple-table', 'table');
bem.SimpleTable__header = bem.SimpleTable.__('header', 'thead');
bem.SimpleTable__body = bem.SimpleTable.__('body', 'tbody');
bem.SimpleTable__footer = bem.SimpleTable.__('footer', 'tfoot');
bem.SimpleTable__row = bem.SimpleTable.__('row', 'tr');
bem.SimpleTable__cell = bem.SimpleTable.__('cell', 'td');

bem.AssetsTable = BEM('assets-table');
bem.AssetsTable__header = bem.AssetsTable.__('header');
bem.AssetsTable__body = bem.AssetsTable.__('body');
bem.AssetsTable__footer = bem.AssetsTable.__('footer');
bem.AssetsTableRow = BEM('assets-table-row');
bem.AssetsTableRow__link = bem.AssetsTableRow.__('link', '<a>');
bem.AssetsTableRow__buttons = bem.AssetsTableRow.__('buttons');
bem.AssetsTableRow__column = bem.AssetsTableRow.__('column');
bem.AssetsTableRow__headerLabel = bem.AssetsTableRow.__('header-label', 'span');
bem.AssetsTableRow__tags = bem.AssetsTableRow.__('tags', '<div>');
bem.AssetsTableRow__tag = bem.AssetsTableRow.__('tag', '<span>');
bem.AssetsTablePagination = BEM('assets-table-pagination');
bem.AssetsTablePagination__button = bem.AssetsTablePagination.__('button', '<button>');
bem.AssetsTablePagination__index = bem.AssetsTablePagination.__('index');

bem.AssetActionButtons = BEM('asset-action-buttons', '<menu>');
bem.AssetActionButtons__button = bem.AssetActionButtons.__('button', '<a>');
bem.AssetActionButtons__iconButton = bem.AssetActionButtons.__('icon-button', '<a>');

bem.tagSelect = BEM('tag-select');
bem.collectionFilter = BEM('collection-filter');

bem.TextBox = BEM('text-box', '<label>');
bem.TextBox__label = bem.TextBox.__('label');
bem.TextBox__labelLink = bem.TextBox.__('label-link', '<a>');
bem.TextBox__input = bem.TextBox.__('input', '<input>');
bem.TextBox__description = bem.TextBox.__('description');
bem.TextBox__error = bem.TextBox.__('error');

bem.Checkbox = BEM('checkbox');
bem.Checkbox__wrapper = bem.Checkbox.__('wrapper', '<label>');
bem.Checkbox__input = bem.Checkbox.__('input', '<input>');
bem.Checkbox__label = bem.Checkbox.__('label', '<span>');

bem.MultiCheckbox = BEM('multi-checkbox', 'ul');
bem.MultiCheckbox__item = bem.MultiCheckbox.__('item', '<li>');

bem.ToggleSwitch = BEM('toggle-switch');
bem.ToggleSwitch__wrapper = bem.ToggleSwitch.__('wrapper', '<label>');
bem.ToggleSwitch__input = bem.ToggleSwitch.__('input', '<input>');
bem.ToggleSwitch__slider = bem.ToggleSwitch.__('slider', '<span>');
bem.ToggleSwitch__label = bem.ToggleSwitch.__('label', '<span>');

bem.Radio = BEM('radio');
bem.Radio__row = bem.Radio.__('row', '<label>');
bem.Radio__input = bem.Radio.__('input', '<input>');
bem.Radio__label = bem.Radio.__('label', '<span>');

bem.PasswordStrength = BEM('password-strength');
bem.PasswordStrength__title = bem.PasswordStrength.__('title');
bem.PasswordStrength__bar = bem.PasswordStrength.__('bar');
bem.PasswordStrength__indicator = bem.PasswordStrength.__('indicator');
bem.PasswordStrength__messages = bem.PasswordStrength.__('messages', '<ul>');
bem.PasswordStrength__message = bem.PasswordStrength.__('message', '<li>');

bem.Breadcrumbs = BEM('breadcrumbs');
bem.Breadcrumbs__crumb = bem.Breadcrumbs.__('crumb', '<a>');
bem.Breadcrumbs__divider = bem.Breadcrumbs.__('divider', '<i>');

bem.AssetInfoBox = BEM('asset-info-box');
bem.AssetInfoBox__column = bem.AssetInfoBox.__('column');
bem.AssetInfoBox__cell = bem.AssetInfoBox.__('cell');
bem.AssetInfoBox__toggle = bem.AssetInfoBox.__('toggle', '<button>');

bem.PrintOnly = BEM('print-only');

bem.GitRev = BEM('git-rev');
bem.GitRev__item = bem.GitRev.__('item', '<div>');

bem.ProjectDownloads = BEM('project-downloads');
bem.ProjectDownloads__advancedView = bem.ProjectDownloads.__('advanced-view', 'section');
bem.ProjectDownloads__column = bem.ProjectDownloads.__('column');
bem.ProjectDownloads__columnRow = bem.ProjectDownloads.__('column-row');
bem.ProjectDownloads__title = bem.ProjectDownloads.__('title', 'span');
bem.ProjectDownloads__textButton = bem.ProjectDownloads.__('text-button', 'button');
bem.ProjectDownloads__selectorRow = bem.ProjectDownloads.__('selector-row');
bem.ProjectDownloads__legacyIframeWrapper = bem.ProjectDownloads.__('legacy-iframe-wrapper');
bem.ProjectDownloads__submitRow = bem.ProjectDownloads.__('submit-row', 'footer');
bem.ProjectDownloads__definedExportsSelector = bem.ProjectDownloads.__('defined-exports-selector');
bem.ProjectDownloads__deleteSettingsButton = bem.ProjectDownloads.__('delete-settings-button', 'button');
bem.ProjectDownloads__exportsCreator = bem.ProjectDownloads.__('exports-creator');

bem.create = BEM;
