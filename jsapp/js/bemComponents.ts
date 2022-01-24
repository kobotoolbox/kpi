/**
 * A list of some of our BEM components. We used to define all of them here, but
 * recently decided to define them inside their component files. Please don't
 * add anything more here :kiss:
 */

import bem, {makeBem} from 'js/bem';

bem.Button = makeBem(null, 'mdl-button', 'button');

bem.KoboButton = makeBem(null, 'kobo-button', 'button');
bem.KoboLightButton = makeBem(null, 'kobo-light-button', 'button');
bem.KoboTextButton = makeBem(null, 'kobo-text-button', 'button');
bem.KoboLightBadge = makeBem(null, 'kobo-light-badge', 'span');

bem.KoboSelect = makeBem(null, 'kobo-select');
bem.KoboSelect__wrapper = makeBem(bem.KoboSelect, 'wrapper');
bem.KoboSelect__label = makeBem(bem.KoboSelect, 'label', 'span');
bem.KoboSelect__error = makeBem(bem.KoboSelect, 'error');
bem.KoboSelect__optionWrapper = makeBem(bem.KoboSelect, 'option-wrapper');
bem.KoboSelect__optionBadge = makeBem(bem.KoboSelect, 'option-badge');

bem.PageWrapper = makeBem(null, 'page-wrapper');
bem.PageWrapper__content = makeBem(bem.PageWrapper, 'content');

bem.Loading = makeBem(null, 'loading');
bem.Loading__inner = makeBem(bem.Loading, 'inner');
bem.Loading__msg = makeBem(bem.Loading, 'msg');

bem.EmptyContent = makeBem(null, 'empty-content', 'section');
bem.EmptyContent__icon = makeBem(bem.EmptyContent, 'icon', 'i');
bem.EmptyContent__title = makeBem(bem.EmptyContent, 'title', 'h1');
bem.EmptyContent__message = makeBem(bem.EmptyContent, 'message', 'p');
bem.EmptyContent__button = makeBem(bem.EmptyContent, 'button', 'button');

bem.AssetRow = makeBem(null, 'asset-row', 'li');
bem.AssetRow__cell        = makeBem(bem.AssetRow, 'cell');
bem.AssetRow__cellmeta    = makeBem(bem.AssetRow, 'cellmeta');
bem.AssetRow__description = makeBem(bem.AssetRow, 'description', 'span');
bem.AssetRow__tags        = makeBem(bem.AssetRow, 'tags');
bem.AssetRow__tags__tag   = makeBem(bem.AssetRow, 'tags__tag', 'span');
bem.AssetRow__tags__notags = makeBem(bem.AssetRow, 'tags__notags', 'span');
bem.AssetRow__actionIcon  = makeBem(bem.AssetRow, 'action-icon', 'a');
bem.AssetRow__buttons        = makeBem(bem.AssetRow, 'buttons');
bem.AssetRow__typeIcon  = makeBem(bem.AssetRow, 'type-icon', 'span');

bem.ServiceRow = makeBem(null, 'service-row');
bem.ServiceRow__column = makeBem(bem.ServiceRow, 'column');
bem.ServiceRow__actionButton = makeBem(bem.ServiceRow, 'action-button', 'button');
bem.ServiceRow__linkOverlay = makeBem(bem.ServiceRow, 'link-overlay', 'a');
bem.ServiceRowButton = makeBem(null, 'service-row-button', 'button');

bem.FormBuilder = makeBem(null, 'form-builder');
bem.FormBuilder__contents = makeBem(bem.FormBuilder, 'contents');

bem.FormBuilderMessageBox = makeBem(null, 'form-builder-message-box');
bem.FormBuilderMessageBox__toggle = makeBem(bem.FormBuilderMessageBox, 'toggle', 'button');
bem.FormBuilderMessageBox__details = makeBem(bem.FormBuilderMessageBox, 'details', 'section');

bem.FormBuilderMeta = makeBem(null, 'form-builder-meta');
bem.FormBuilderMeta__columns = makeBem(bem.FormBuilderMeta, 'columns');
bem.FormBuilderMeta__column = makeBem(bem.FormBuilderMeta, 'column');
bem.FormBuilderMeta__row = makeBem(bem.FormBuilderMeta, 'row');

bem.FormBuilderAside = makeBem(null, 'form-builder-aside');
bem.FormBuilderAside__content = makeBem(bem.FormBuilderAside, 'content');
bem.FormBuilderAside__header = makeBem(bem.FormBuilderAside, 'header', 'h2');
bem.FormBuilderAside__row = makeBem(bem.FormBuilderAside, 'row', 'section');

bem.FormBuilderHeader = makeBem(null, 'form-builder-header');
bem.FormBuilderHeader__row = makeBem(bem.FormBuilderHeader, 'row');
bem.FormBuilderHeader__cell = makeBem(bem.FormBuilderHeader, 'cell');
bem.FormBuilderHeader__item = makeBem(bem.FormBuilderHeader, 'item', 'span');
bem.FormBuilderHeader__button = makeBem(bem.FormBuilderHeader, 'button', 'button');
bem.FormBuilderHeader__close = makeBem(bem.FormBuilderHeader, 'close', 'button');

bem.FormMedia = makeBem(null, 'form-media');
bem.FormMedia__title = makeBem(bem.FormMedia, 'title');
bem.FormMedia__upload = makeBem(bem.FormMedia, 'upload');
bem.FormMedia__list = makeBem(bem.FormMedia, 'list');
bem.FormMedia__label = makeBem(bem.FormMedia, 'label', 'label');
bem.FormMedia__listItem = makeBem(bem.FormMedia, 'list-item', 'li');

bem.FormMediaUploadUrl = makeBem(null, 'form-media-upload-url');
bem.FormMediaUploadUrl__label = makeBem(bem.FormMediaUploadUrl, 'label', 'label');
bem.FormMediaUploadUrl__form = makeBem(bem.FormMediaUploadUrl, 'form');

bem.SearchInput = makeBem(null, 'search-input', 'input');

bem.Search = makeBem(null, 'search');
bem.Search__icon = makeBem(bem.Search, 'icon', 'i');
bem.Search__cancel = makeBem(bem.Search, 'cancel', 'i');
bem.Search__summary = makeBem(bem.Search, 'summary');

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

bem.SubmissionDataTable = makeBem(null, 'submission-data-table');
bem.SubmissionDataTable__row = makeBem(bem.SubmissionDataTable, 'row');
bem.SubmissionDataTable__column = makeBem(bem.SubmissionDataTable, 'column');
bem.SubmissionDataTable__XMLName = makeBem(bem.SubmissionDataTable, 'xml-name');
bem.SubmissionDataTable__value = makeBem(bem.SubmissionDataTable, 'value');

bem.TableMeta = makeBem(null, 'table-meta');
bem.TableMeta__counter = makeBem(bem.TableMeta, 'counter');
bem.TableMeta__additionalText = makeBem(bem.TableMeta, 'additional-text', 'span'); // generally text not needed on smaller screens
bem.TableMeta__bulkOptions = makeBem(bem.TableMeta, 'bulk-options');

bem.CollectionsWrapper = makeBem(null, 'collections-wrapper');

bem.CollectionNav = makeBem(null, 'collection-nav');
bem.CollectionNav__search = makeBem(bem.CollectionNav, 'search');
bem.CollectionNav__searchcriteria = makeBem(bem.CollectionNav, 'searchcriteria', 'ul');
bem.CollectionNav__searchcriterion = makeBem(bem.CollectionNav, 'searchcriterion', 'li');
bem.CollectionNav__actions = makeBem(bem.CollectionNav, 'actions');
bem.CollectionNav__button = makeBem(bem.CollectionNav, 'button', 'button');
bem.CollectionNav__link = makeBem(bem.CollectionNav, 'link', 'a');
bem.CollectionNav__searchcancel = makeBem(bem.CollectionNav, 'searchcancel', 'i');
bem.CollectionNav__searchicon = makeBem(bem.CollectionNav, 'searchicon', 'i');

bem.Library = makeBem(null, 'library');
bem.Library__typeFilter = makeBem(bem.Library, 'type-filter', 'label');

bem.List = makeBem(null, 'list');
bem.List__heading = makeBem(bem.List, 'heading');
bem.List__subheading = makeBem(bem.List, 'subheading');

bem.AssetList = makeBem(null, 'asset-list');
bem.AssetItems = makeBem(null, 'asset-items', 'ul');

bem.AssetListSorts = makeBem(null, 'asset-list-sorts', 'div');
bem.AssetListSorts__item = makeBem(bem.AssetListSorts, 'item');

bem.FormView = makeBem(null, 'form-view');
// used in header.es6
bem.FormView__title = makeBem(bem.FormView, 'title');
bem.FormView__name = makeBem(bem.FormView, 'name');
bem.FormView__description = makeBem(bem.FormView, 'description');
bem.FormView__subs = makeBem(bem.FormView, 'subs');
// end used in header.es6
bem.FormView__toptabs = makeBem(bem.FormView, 'toptabs');
bem.FormView__sidetabs = makeBem(bem.FormView, 'sidetabs');

bem.FormView__label = makeBem(bem.FormView, 'label');
bem.FormView__group = makeBem(bem.FormView, 'group');
bem.FormView__item = makeBem(bem.FormView, 'item');
bem.FormView__iconButton = makeBem(bem.FormView, 'icon-button', 'button');

bem.FormView__row = makeBem(bem.FormView, 'row');
bem.FormView__cell = makeBem(bem.FormView, 'cell');
bem.FormView__cellLabel = makeBem(bem.FormView, 'cell-label');
bem.FormView__column = makeBem(bem.FormView, 'column');

bem.FormView__banner = makeBem(bem.FormView, 'banner');
bem.FormView__link = makeBem(bem.FormView, 'link', 'a');
bem.FormView__secondaryButtons = makeBem(bem.FormView, 'secondaryButtons');
bem.FormView__secondaryButton = makeBem(bem.FormView, 'secondaryButton', 'button');
bem.FormView__reportButtons = makeBem(bem.FormView, 'reportButtons');
bem.FormView__form = makeBem(bem.FormView, 'form', 'form');

bem.FormView__map = makeBem(bem.FormView, 'map');
bem.FormView__mapButton = makeBem(bem.FormView, 'map-button');
bem.FormView__mapList = makeBem(bem.FormView, 'map-list');

bem.MainHeader = makeBem(null, 'main-header', 'header');
bem.MainHeader__icon = makeBem(bem.MainHeader, 'icon', 'i');
bem.MainHeader__title = makeBem(bem.MainHeader, 'title');
bem.MainHeader__counter = makeBem(bem.MainHeader, 'counter');


bem.ReportView = makeBem(null, 'report-view');
bem.ReportView__wrap = makeBem(bem.ReportView, 'wrap');
bem.ReportView__item = makeBem(bem.ReportView, 'item');
bem.ReportView__itemHeading = makeBem(bem.ReportView, 'itemHeading');
bem.ReportView__headingMeta = makeBem(bem.ReportView, 'headingMeta');
bem.ReportView__itemContent = makeBem(bem.ReportView, 'itemContent');
bem.ReportView__headingButton = makeBem(bem.ReportView, 'headingButton', 'button');
bem.ReportView__chart = makeBem(bem.ReportView, 'chart');

bem.GraphSettings = makeBem(null, 'graph-settings');
bem.GraphSettings__buttons = makeBem(bem.GraphSettings, 'buttons');
bem.GraphSettings__charttype = makeBem(bem.GraphSettings, 'charttype');
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

bem.Header = makeBem(null, 'header');
bem.Header__logo = makeBem(bem.Header, 'logo', 'span');

bem.LoginBox = makeBem(null, 'login-box');

bem.AccountBox = makeBem(null, 'account-box');
bem.AccountBox__name = makeBem(bem.AccountBox, 'name', 'div');
bem.AccountBox__initials = makeBem(bem.AccountBox, 'initials', 'span');
bem.AccountBox__menu = makeBem(bem.AccountBox, 'menu', 'ul');
bem.AccountBox__menuLI = makeBem(bem.AccountBox, 'menu-li', 'li');
bem.AccountBox__menuItem = makeBem(bem.AccountBox, 'menu-item', 'div');
bem.AccountBox__menuLink = makeBem(bem.AccountBox, 'menu-link', 'a');

bem.AccountSettings = makeBem(null, 'account-settings');
bem.AccountSettings__left = makeBem(bem.AccountSettings, 'left');
bem.AccountSettings__right = makeBem(bem.AccountSettings, 'right');
bem.AccountSettings__item = makeBem(bem.FormModal, 'item');
bem.AccountSettings__actions = makeBem(bem.AccountSettings, 'actions');

bem.UserRow = makeBem(null, 'user-row');
bem.UserRow__info = makeBem(bem.UserRow, 'info');
bem.UserRow__avatar = makeBem(bem.UserRow, 'avatar');
bem.UserRow__name = makeBem(bem.UserRow, 'name');
bem.UserRow__email = makeBem(bem.UserRow, 'email');
bem.UserRow__perms = makeBem(bem.UserRow, 'perms');
bem.UserRow__perm = makeBem(bem.UserRow, 'perm');
bem.UserRow__editor = makeBem(bem.UserRow, 'editor');

bem.uiPanel = makeBem(null, 'ui-panel');
bem.uiPanel__body = makeBem(bem.uiPanel, 'body');

bem.FormSidebarWrapper = makeBem(null, 'form-sidebar-wrapper');
bem.FormSidebar = makeBem(null, 'form-sidebar');
bem.FormSidebar__item = makeBem(bem.FormSidebar, 'item', 'a');
bem.FormSidebar__itemText = makeBem(bem.FormSidebar, 'item-text');
bem.FormSidebar__label = makeBem(bem.FormSidebar, 'label', 'a');
bem.FormSidebar__labelText = makeBem(bem.FormSidebar, 'label-text');
bem.FormSidebar__labelCount = makeBem(bem.FormSidebar, 'label-count');
bem.FormSidebar__grouping = makeBem(bem.FormSidebar, 'grouping');

bem.KDrawer = makeBem(null, 'k-drawer');
bem.KDrawer__primaryIcons = makeBem(bem.KDrawer, 'primary-icons', 'nav');
bem.KDrawer__secondaryIcons = makeBem(bem.KDrawer, 'secondary-icons', 'nav');
bem.KDrawer__sidebar = makeBem(bem.KDrawer, 'sidebar', 'aside');

bem.HelpBubble = makeBem(null, 'help-bubble');
bem.HelpBubble__close = makeBem(bem.HelpBubble, 'close', 'button');
bem.HelpBubble__back = makeBem(bem.HelpBubble, 'back', 'button');
bem.HelpBubble__trigger = makeBem(bem.HelpBubble, 'trigger', 'button');
bem.HelpBubble__triggerCounter = makeBem(bem.HelpBubble, 'trigger-counter', 'span');
bem.HelpBubble__popup = makeBem(bem.HelpBubble, 'popup');
bem.HelpBubble__popupContent = makeBem(bem.HelpBubble, 'popup-content');
bem.HelpBubble__row = makeBem(bem.HelpBubble, 'row');
bem.HelpBubble__rowAnchor = makeBem(bem.HelpBubble, 'row', 'a');
bem.HelpBubble__rowWrapper = makeBem(bem.HelpBubble, 'row-wrapper');

bem.SimpleTable = makeBem(null, 'simple-table', 'table');
bem.SimpleTable__header = makeBem(bem.SimpleTable, 'header', 'thead');
bem.SimpleTable__body = makeBem(bem.SimpleTable, 'body', 'tbody');
bem.SimpleTable__footer = makeBem(bem.SimpleTable, 'footer', 'tfoot');
bem.SimpleTable__row = makeBem(bem.SimpleTable, 'row', 'tr');
// NOTE: messageRow needs a __cell with colspan set
bem.SimpleTable__messageRow = makeBem(bem.SimpleTable, 'message-row', 'tr');
bem.SimpleTable__cell = makeBem(bem.SimpleTable, 'cell', 'td');

bem.AssetsTable = makeBem(null, 'assets-table');
bem.AssetsTable__header = makeBem(bem.AssetsTable, 'header');
bem.AssetsTable__body = makeBem(bem.AssetsTable, 'body');
bem.AssetsTable__footer = makeBem(bem.AssetsTable, 'footer');
bem.AssetsTableRow = makeBem(null, 'assets-table-row');
bem.AssetsTableRow__link = makeBem(bem.AssetsTableRow, 'link', 'a');
bem.AssetsTableRow__buttons = makeBem(bem.AssetsTableRow, 'buttons');
bem.AssetsTableRow__column = makeBem(bem.AssetsTableRow, 'column');
bem.AssetsTableRow__headerLabel = makeBem(bem.AssetsTableRow, 'header-label', 'span');
bem.AssetsTableRow__tags = makeBem(bem.AssetsTableRow, 'tags', 'div');
bem.AssetsTableRow__tag = makeBem(bem.AssetsTableRow, 'tag', 'span');
bem.AssetsTablePagination = makeBem(null, 'assets-table-pagination');
bem.AssetsTablePagination__button = makeBem(bem.AssetsTablePagination, 'button', 'button');
bem.AssetsTablePagination__index = makeBem(bem.AssetsTablePagination, 'index');

bem.AssetActionButtons = makeBem(null, 'asset-action-buttons', 'menu');
bem.AssetActionButtons__button = makeBem(bem.AssetActionButtons, 'button', 'a');
bem.AssetActionButtons__iconButton = makeBem(bem.AssetActionButtons, 'icon-button', 'a');

bem.tagSelect = makeBem(null, 'tag-select');
bem.collectionFilter = makeBem(null, 'collection-filter');

bem.TextBox = makeBem(null, 'text-box', 'label');
bem.TextBox__label = makeBem(bem.TextBox, 'label');
bem.TextBox__labelLink = makeBem(bem.TextBox, 'label-link', 'a');
bem.TextBox__input = makeBem(bem.TextBox, 'input', 'input');
bem.TextBox__description = makeBem(bem.TextBox, 'description');
bem.TextBox__error = makeBem(bem.TextBox, 'error');

bem.Checkbox = makeBem(null, 'checkbox');
bem.Checkbox__wrapper = makeBem(bem.Checkbox, 'wrapper', 'label');
bem.Checkbox__input = makeBem(bem.Checkbox, 'input', 'input');
bem.Checkbox__label = makeBem(bem.Checkbox, 'label', 'span');

bem.MultiCheckbox = makeBem(null, 'multi-checkbox', 'ul');
bem.MultiCheckbox__item = makeBem(bem.MultiCheckbox, 'item', 'li');

bem.ToggleSwitch = makeBem(null, 'toggle-switch');
bem.ToggleSwitch__wrapper = makeBem(bem.ToggleSwitch, 'wrapper', 'label');
bem.ToggleSwitch__input = makeBem(bem.ToggleSwitch, 'input', 'input');
bem.ToggleSwitch__slider = makeBem(bem.ToggleSwitch, 'slider', 'span');
bem.ToggleSwitch__label = makeBem(bem.ToggleSwitch, 'label', 'span');

bem.Radio = makeBem(null, 'radio');
bem.Radio__row = makeBem(bem.Radio, 'row', 'label');
bem.Radio__input = makeBem(bem.Radio, 'input', 'input');
bem.Radio__label = makeBem(bem.Radio, 'label', 'span');

bem.PasswordStrength = makeBem(null, 'password-strength');
bem.PasswordStrength__title = makeBem(bem.PasswordStrength, 'title');
bem.PasswordStrength__bar = makeBem(bem.PasswordStrength, 'bar');
bem.PasswordStrength__indicator = makeBem(bem.PasswordStrength, 'indicator');
bem.PasswordStrength__messages = makeBem(bem.PasswordStrength, 'messages', 'ul');
bem.PasswordStrength__message = makeBem(bem.PasswordStrength, 'message', 'li');

bem.Breadcrumbs = makeBem(null, 'breadcrumbs');
bem.Breadcrumbs__crumb = makeBem(bem.Breadcrumbs, 'crumb', 'a');
bem.Breadcrumbs__divider = makeBem(bem.Breadcrumbs, 'divider', 'i');

bem.AssetInfoBox = makeBem(null, 'asset-info-box');
bem.AssetInfoBox__column = makeBem(bem.AssetInfoBox, 'column');
bem.AssetInfoBox__cell = makeBem(bem.AssetInfoBox, 'cell');
bem.AssetInfoBox__toggle = makeBem(bem.AssetInfoBox, 'toggle', 'button');

bem.PrintOnly = makeBem(null, 'print-only');

bem.GitRev = makeBem(null, 'git-rev');
bem.GitRev__item = makeBem(bem.GitRev, 'item', 'div');

bem.ProjectDownloads = makeBem(null, 'project-downloads');
bem.ProjectDownloads__advancedView = makeBem(bem.ProjectDownloads, 'advanced-view', 'section');
bem.ProjectDownloads__column = makeBem(bem.ProjectDownloads, 'column');
bem.ProjectDownloads__columnRow = makeBem(bem.ProjectDownloads, 'column-row');
bem.ProjectDownloads__title = makeBem(bem.ProjectDownloads, 'title', 'span');
bem.ProjectDownloads__textButton = makeBem(bem.ProjectDownloads, 'text-button', 'button');
bem.ProjectDownloads__selectorRow = makeBem(bem.ProjectDownloads, 'selector-row');
bem.ProjectDownloads__anonymousRow = makeBem(bem.ProjectDownloads, 'anonymous-row');
bem.ProjectDownloads__legacyIframeWrapper = makeBem(bem.ProjectDownloads, 'legacy-iframe-wrapper');
bem.ProjectDownloads__submitRow = makeBem(bem.ProjectDownloads, 'submit-row', 'footer');
bem.ProjectDownloads__exportsSelector = makeBem(bem.ProjectDownloads, 'exports-selector');
bem.ProjectDownloads__deleteSettingsButton = makeBem(bem.ProjectDownloads, 'delete-settings-button', 'button');
bem.ProjectDownloads__exportsCreator = makeBem(bem.ProjectDownloads, 'exports-creator');

bem.BackgroundAudioPlayer = makeBem(null, 'background-audio-player');
bem.BackgroundAudioPlayer__label = makeBem(bem.BackgroundAudioPlayer, 'label', 'label');
bem.BackgroundAudioPlayer__audio = makeBem(bem.BackgroundAudioPlayer, 'audio', 'audio');
