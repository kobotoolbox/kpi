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

export const DEFAULT_EXPORT_TYPE = EXPORT_TYPES.xls;

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

export const EXPORT_STATUSES = {};
new Set([
  'created',
  'processing',
  'complete',
  'error',
]).forEach((kind) => {EXPORT_STATUSES[kind] = kind;});
Object.freeze(EXPORT_STATUSES);
