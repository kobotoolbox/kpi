import {t} from './utils';

const MODAL_TYPES = {
  SHARING: 'sharing',
  UPLOADING_XLS: 'uploading-xls',
  NEW_FORM: 'new-form',
  ENKETO_PREVIEW: 'enketo-preview',
  SUBMISSION: 'submission',
  REPLACE_PROJECT: 'replace-project',
  TABLE_COLUMNS: 'table-columns'
}

const PROJECT_SETTINGS_CONTEXTS = {
  NEW: 'newForm',
  EXISTING: 'existingForm',
  REPLACE: 'replaceProject',
  BUILDER: 'formBuilderAside'
};

const update_states = {
  UNSAVED_CHANGES: -1,
  UP_TO_DATE: true,
  PENDING_UPDATE: false,
  SAVE_FAILED: 'SAVE_FAILED',
};

const AVAILABLE_FORM_STYLES = [
  {value: '', label: t('Default - single page')},
  {value: 'theme-grid no-text-transform', label: t('Grid theme')},
  {value: 'theme-grid', label: t('Grid theme with headings in ALL CAPS')},
  {value: 'pages', label: t('Multiple pages')},
  {value: 'theme-grid pages no-text-transform', label: t('Grid theme + Multiple pages')},
  {value: 'theme-grid pages', label: t('Grid theme + Multiple pages + headings in ALL CAPS')},
];

const VALIDATION_STATUSES = [
  {
    value: 'validation_status_not_approved',
    label: t('Not Approved')
  },
  {
    value: 'validation_status_approved',
    label: t('Approved')
  },
  {
    value: 'validation_status_on_hold',
    label: t('On Hold')
  },
];

const ASSET_TYPES = {
  question: {
    id: 'question',
    label: t('question')
  },
  block: {
    id: 'block',
    label: t('block')
  },
  template: {
    id: 'template',
    label: t('template')
  },
  survey: {
    id: 'survey',
    label: t('project')
  }
}

export default {
  AVAILABLE_FORM_STYLES: AVAILABLE_FORM_STYLES,
  update_states: update_states,
  VALIDATION_STATUSES: VALIDATION_STATUSES,
  PROJECT_SETTINGS_CONTEXTS: PROJECT_SETTINGS_CONTEXTS,
  MODAL_TYPES: MODAL_TYPES,
  ASSET_TYPES: ASSET_TYPES
};
