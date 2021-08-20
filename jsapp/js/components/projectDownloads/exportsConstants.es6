import {createEnum} from 'js/constants';

export const EXPORT_TYPES = Object.freeze({
  csv_legacy: {value: 'csv_legacy', label: t('CSV (legacy)'), isLegacy: true},
  csv: {value: 'csv', label: t('CSV'), isLegacy: false},
  geojson: {value: 'geojson', label: t('GeoJSON'), isLegacy: false},
  kml_legacy: {value: 'kml_legacy', label: t('GPS coordinates (KML)'), isLegacy: true},
  spss_labels: {value: 'spss_labels', label: t('SPSS Labels'), isLegacy: false},
  xls_legacy: {value: 'xls_legacy', label: t('XLS (legacy)'), isLegacy: true},
  xls: {value: 'xls', label: t('XLS'), isLegacy: false},
  zip_legacy: {value: 'zip_legacy', label: t('Media Attachments (ZIP)'), isLegacy: true},
});

export const EXPORT_FORMATS = Object.freeze({
  // Unchecked wisdom from old component:
  // > The value of `formpack.constants.UNTRANSLATED` is `null` which is the same as `_default`
  _default: {value: '_default', label: t('Labels')},
  // Unchecked wisdom from old component:
  // > The value of `formpack.constants.UNSPECIFIED_TRANSLATION` is `false` which is the same as `_xml`
  //
  // Unchecked wisdom from old component:
  // > Exports previously used `xml` (no underscore) for this, which works so
  // > long as the form has no language called `xml`. We shouldn't bank on that:
  // > https://en.wikipedia.org/wiki/Malaysian_Sign_Language
  _xml: {value: '_xml', label: t('XML values and headers')},
});

export const EXPORT_MULTIPLE_OPTIONS = Object.freeze({
  details: {
    value: 'details',
    label: t('Separate columns'),
  },
  summary: {
    value: 'summary',
    label: t('Single column'),
  },
  both: {
    value: 'both',
    label: t('Single and separate columns'),
  },
});

export const EXPORT_STATUSES = createEnum([
  'created',
  'processing',
  'complete',
  'error',
]);

export const DEFAULT_EXPORT_SETTINGS = Object.freeze({
  CUSTOM_EXPORT_NAME: '',
  CUSTOM_SELECTION: false,
  // Export format options are contextual - if asset has multiple languages,
  // then there is no `_default` option, but the list of languages. Only `_xml`
  // option is always here, so we treat it as a fallback default.
  EXPORT_FORMAT: EXPORT_FORMATS._xml,
  EXPORT_MULTIPLE: EXPORT_MULTIPLE_OPTIONS.both,
  // xls is the most popular choice and we respect that
  EXPORT_TYPE: EXPORT_TYPES.xls,
  FLATTEN_GEO_JSON: false,
  XLS_TYPES: false,
  GROUP_SEPARATOR: '/',
  INCLUDE_ALL_VERSIONS: true,
  INCLUDE_GROUPS: false,
  SAVE_CUSTOM_EXPORT: false,
  // by default all rows should be selected, but we can't know the asset rows
  // here, so the set will be empty, and the component using
  // DEFAULT_EXPORT_SETTINGS is responsible to fill it up
  SELECTED_ROWS: new Set(),
});

export const EXPORT_REFRESH_TIME = 4000;
