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
  {value: 'theme-grid', label: t('Grid theme')},
  {value: 'pages', label: t('Multiple pages')},
  {value: 'theme-grid pages', label: t('Grid theme + Multiple pages')},
];

export default {
  AVAILABLE_FORM_STYLES: AVAILABLE_FORM_STYLES,
  update_states: update_states,
};
