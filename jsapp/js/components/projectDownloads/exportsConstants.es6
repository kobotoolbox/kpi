export const EXPORT_TYPES = Object.freeze({
  analyser_legacy: {value: 'analyser_legacy', label: t('Excel Analyser')},
  csv_legacy: {value: 'csv_legacy', label: t('CSV (legacy)')},
  csv: {value: 'csv', label: t('CSV')},
  geojson: {value: 'geojson', label: t('GeoJSON')},
  kml_legacy: {value: 'kml_legacy', label: t('GPS coordinates (KML)')},
  kml: {value: 'kml', label: t('GPS coordinates (KML)')},
  spss_labels: {value: 'spss_labels', label: t('SPSS Labels')},
  spss: {value: 'spss', label: t('SPSS Labels')},
  xls_legacy: {value: 'xls_legacy', label: t('XLS (legacy)')},
  xls: {value: 'xls', label: t('XLS')},
  xlsx: {value: 'xlsx', label: t('XLSX')},
  zip_legacy: {value: 'zip_legacy', label: t('Media Attachments (ZIP)')},
  zip: {value: 'zip', label: t('Media Attachments (ZIP)')},
});

export const EXPORT_FORMATS = Object.freeze({
  labels: {value: '_default', label: t('Labels')},
  xml: {value: '_xml', label: t('XML values and headers')},
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
