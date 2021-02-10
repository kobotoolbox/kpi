export const EXPORT_TYPES = Object.freeze({
  xls: {value: 'xls', label: t('XLS')},
  xls_legacy: {value: 'xls_legacy', label: t('XLS (legacy)')},
  csv: {value: 'csv', label: t('CSV')},
  csv_legacy: {value: 'csv_legacy', label: t('CSV (legacy)')},
  zip_legacy: {value: 'zip_legacy', label: t('Media Attachments (ZIP)')},
  kml_legacy: {value: 'kml_legacy', label: t('GPS coordinates (KML)')},
  analyser_legacy: {value: 'analyser_legacy', label: t('Excel Analyser')},
  spss_labels: {value: 'spss_labels', label: t('SPSS Labels')},
});

export const EXPORT_FORMATS = Object.freeze({
  xml: {value: 'xml', label: t('XML values and headers')},
  labels: {value: 'labels', label: t('Labels')},
});

export const EXPORT_MULTIPLE_OPTIONS = Object.freeze({
  separate_columns: {
    value: 'separate_columns',
    label: t('Split into separate columns'),
  },
  TODO: {value: 'TODO', label: t('TODO')},
});
