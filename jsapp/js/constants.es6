import {
  t,
} from './utils';

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

export default {
  AVAILABLE_FORM_STYLES: AVAILABLE_FORM_STYLES,
  update_states: update_states,
  VALIDATION_STATUSES: VALIDATION_STATUSES
};
