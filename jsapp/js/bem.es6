/*eslint new-cap: 0*/
/*eslint no-multi-spaces: 0*/

var BEM = require('./libs/react-create-bem-element');
var bem = BEM.init();

bem.PageWrapper = BEM('page-wrapper');
bem.PageWrapper__content = bem.PageWrapper.__('content');

bem.Loading = BEM('loading');
bem.Loading__inner = bem.Loading.__('inner');

bem.AssetRow = BEM('asset-row', '<li>');
bem.AssetRow__cell        = bem.AssetRow.__('cell');

bem.AssetRow__celllink    = bem.AssetRow.__('celllink', '<a>');
bem.AssetRow__cellmeta    = bem.AssetRow.__('cellmeta');
bem.AssetRow__name        = bem.AssetRow.__('name', '<span>');
bem.AssetRow__description = bem.AssetRow.__('description', '<span>');
bem.AssetRow__tags        = bem.AssetRow.__('tags');
bem.AssetRow__tags__tag   = bem.AssetRow.__('tags__tag', '<span>');
bem.AssetRow__tags__notags = bem.AssetRow.__('tags__notags', '<span>');
bem.AssetRow__actionIcon  = bem.AssetRow.__('action-icon', '<a>');
bem.AssetRow__buttons        = bem.AssetRow.__('buttons');

bem.FormBuilder = bem('formBuilder');
bem.FormBuilder__row = bem.FormBuilder.__('row');
bem.FormBuilder__contents = bem.FormBuilder.__('contents');

bem.FormBuilderHeader = bem('formBuilder-header');
bem.FormBuilderHeader__row = bem.FormBuilderHeader.__('row');
bem.FormBuilderHeader__cell = bem.FormBuilderHeader.__('cell');
bem.FormBuilderHeader__item = bem.FormBuilderHeader.__('item', '<span>');
bem.FormBuilderHeader__button = bem.FormBuilderHeader.__('button', '<button>');
bem.FormBuilderHeader__close = bem.FormBuilderHeader.__('close', '<button>');

bem.FormMeta = bem('form-meta');
bem.FormMeta__preview = bem.FormMeta.__('preview');
bem.FormMeta__content = bem.FormMeta.__('content');
bem.FormMeta__button = bem.FormMeta.__('button');

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
bem.LibNav__logo = bem.LibNav.__('logo');

bem.LibList = BEM('lib-list', '<ul>');
bem.LibList__item = bem.LibList.__('item', '<li>');
bem.LibList__tags = bem.LibList.__('tags');
bem.LibList__tag = bem.LibList.__('tag', '<span>');
bem.LibList__label = bem.LibList.__('label');
bem.LibList__dragbox = bem.LibList.__('dragbox');
bem.LibList__qtype = bem.LibList.__('qtype');

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

bem.Library = bem('library');
bem.Library_breadcrumb = bem.Library.__('breadcrumb');

bem.List = bem('list');
bem.AssetList = bem('asset-list');
bem.AssetList__heading = bem.AssetList.__('heading');
bem.AssetItems = bem('asset-items', '<ul>');

bem.CollectionSidebar = bem('collection-sidebar');
bem.CollectionSidebar__item = bem.CollectionSidebar.__('item');
bem.CollectionSidebar__itembyline = bem('collection-sidebar__itembyline', '<span>');
bem.CollectionSidebar__itemCog = bem.CollectionSidebar.__('itemCog', '<button>');
bem.CollectionSidebar__itemactions = bem('collection-sidebar__itemactions', '<div>');
bem.CollectionSidebar__itemlink = bem.CollectionSidebar.__('itemlink', '<a>');

bem.FormSidebar = bem('form-sidebar');
bem.FormSidebar__wrapper = bem.FormSidebar.__('wrapper');
bem.FormSidebar__item = bem.FormSidebar.__('item');
bem.FormSidebar__label = bem.FormSidebar.__('label');
bem.FormSidebar__grouping = bem.FormSidebar.__('grouping');
bem.FormSidebar__itemlink = bem.FormSidebar.__('itemlink', '<a>');

bem.AssetListSorts = bem('asset-list-sorts', '<div>');
bem.AssetListSorts__item = bem.AssetListSorts.__('item');

bem.CollectionHeader = bem('collection-header');
bem.CollectionHeader__item = bem.CollectionHeader.__('item');
bem.CollectionHeader__input = bem.CollectionHeader.__('input', '<input>');
bem.CollectionHeader__buttonRow = bem('collection-header__button-row');
bem.CollectionHeader__iconwrap = bem.CollectionHeader.__('iconwrap');
bem.CollectionHeader__buttonGroup = bem('collection-header__button-group');

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
bem.AssetView__label = bem.AssetView.__('label', '<label>');
// bem.AssetView__message = bem.AssetView.__('message');
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
bem.AssetView__iconwrap = bem.AssetView.__('iconwrap');
bem.AssetView__col = bem.AssetView.__('col');
bem.AssetView__span = bem.AssetView.__('span', '<span>');
bem.AssetView__colsubtext = bem.AssetView.__('colsubtext');
bem.AssetView__tags = bem.AssetView.__('tags');
bem.AssetView__tags__tag = bem.AssetView__tags.__('tag', '<span>');
bem.AssetView__langs = bem.AssetView.__('langs');
bem.AssetView__buttons = bem.AssetView.__('buttons');
bem.AssetView__buttoncol = bem.AssetView.__('buttoncol');
bem.AssetView__button = bem.AssetView.__('button', '<button>');
bem.AssetView__link = bem.AssetView.__('link', '<a>');
bem.AssetView__plainlink = bem.AssetView.__('plainlink', '<a>'); // FIXME: feels wrong, but _kobo.asset-view.scss makes __link equivalent to __button
bem.AssetView__deployments = bem.AssetView.__('deployments', '<ul>');
bem.AssetView__deployment = bem.AssetView.__('deployment', '<li>');

bem.FormView = BEM('form-view');
bem.FormView__header = bem.FormView.__('header');
bem.FormView__tabbar = bem.FormView.__('tabbar');
bem.FormView__tabs = bem.FormView.__('tabs');
bem.FormView__tab = bem.FormView.__('tab', '<a>');
bem.FormView__button = bem.FormView.__('button', '<button>');
bem.FormView__status = bem.FormView.__('status');
bem.FormView__title = bem.FormView.__('title');
bem.FormView__name = bem.FormView.__('name');
bem.FormView__description = bem.FormView.__('description');

bem.FormView__wrapper = bem.FormView.__('wrapper');
bem.FormView__row = bem.FormView.__('row');
bem.FormView__cell = bem.FormView.__('cell');
bem.FormView__banner = bem.FormView.__('banner');
bem.FormView__label = bem.FormView.__('label');
bem.FormView__group = bem.FormView.__('group');
bem.FormView__item = bem.FormView.__('item', '<span>');
bem.FormView__link = bem.FormView.__('link', '<a>');
bem.FormView__secondaryButtons = bem.FormView.__('secondaryButtons');
bem.FormView__secondaryButton = bem.FormView.__('secondaryButton', '<button>');
bem.FormView__reportButtons = bem.FormView.__('reportButtons');
bem.FormView__form = bem.FormView.__('form', '<form>');

bem.ReportView = BEM('report-view');
bem.ReportView__wrap = bem.ReportView.__('wrap');
bem.ReportView__warning = bem.ReportView.__('warning');
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

bem.FormModal = bem('form-modal');
bem.FormModal__form = bem.FormModal.__('form', '<form>');
bem.FormModal__item = bem.FormModal.__('item');

bem.PopoverMenu = bem('popover-menu');
bem.PopoverMenu__item = bem.PopoverMenu.__('item');
bem.PopoverMenu__heading = bem.PopoverMenu.__('heading');
bem.PopoverMenu__moveTo = bem.PopoverMenu.__('moveTo');
bem.PopoverMenu__link = bem.PopoverMenu.__('link', '<a>');

bem.AccountBox = BEM('account-box');
bem.AccountBox__notifications = bem.AccountBox.__('notifications');
bem.AccountBox__notifications__count = bem.AccountBox.__('notifications__count', '<span>');
bem.AccountBox__name = bem.AccountBox.__('name', '<div>');
bem.AccountBox__username = bem.AccountBox.__('username', '<span>');
bem.AccountBox__image = bem.AccountBox.__('image', '<span>');
bem.AccountBox__logo = bem.AccountBox.__('logo', '<span>');

bem.AccountSettings = BEM('account-settings');
bem.AccountSettings__left = bem.AccountSettings.__('left');
bem.AccountSettings__right = bem.AccountSettings.__('right');
bem.AccountSettings__item = bem.FormModal.__('item');
bem.AccountSettings__desc = bem.AccountSettings.__('desc');

bem.ChangePassword = BEM('change-password');
bem.ChangePassword__item = bem.FormModal.__('item');

bem.UserRow = BEM('user-row');
bem.UserRow__avatar = bem.UserRow.__('avatar');
bem.UserRow__name = bem.UserRow.__('name');
bem.UserRow__email = bem.UserRow.__('email');
bem.UserRow__role = bem.UserRow.__('role');

bem.ToggleSwitch = BEM('toggle-switch', '<label>');

bem.uiPanel = BEM('ui-panel');
bem.uiPanel__body = bem.uiPanel.__('body');

bem.Drawer = bem('drawer');

bem.tagSelect = BEM('tag-select');
bem.collectionFilter = BEM('collection-filter');

bem.PrintOnly = BEM('print-only');

bem.GitRev = BEM('git-rev');
bem.GitRev__item = bem.GitRev.__('item', '<div>');

bem.create = BEM;

export default bem;
