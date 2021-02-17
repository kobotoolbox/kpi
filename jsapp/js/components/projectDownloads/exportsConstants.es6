export const EXPORT_TYPES = Object.freeze({
  analyser_legacy: {value: 'analyser_legacy', label: t('Excel Analyser'), isLegacy: true},
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
  _default: {value: '_default', label: t('Labels')},
  // Exports previously used `xml` (no underscore) for this, which works so long
  // as the form has no language called `xml`. We shouldn't bank on that:
  // https://en.wikipedia.org/wiki/Malaysian_Sign_Language
  _xml: {value: '_xml', label: t('XML values and headers')},
});

export const EXPORT_MULTIPLE_OPTIONS = Object.freeze({
  both: {
    value: 'both',
    label: t('Both'),
  },
  details: {
    value: 'details',
    label: t('Only the details column'),
  },
  summary: {
    value: 'summary',
    label: t('Only the summary column'),
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
