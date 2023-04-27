import type {IconName} from 'jsapp/fonts/k-icons';

export const AUTO_SAVE_TYPING_DELAY = 3000;

/** An instance of analysis question. */
export interface AnalysisQuestion {
  type: AnalysisQuestionType;
  label: string;
  uid: string;
  response: string;
}

/**
 * To differentiate these question types from the ones we use in Form Builder,
 * let's prefix them with `aq_` (abbreviation for "analysis question").
 */
export type AnalysisQuestionType =
  | 'aq_keyword_search'
  | 'aq_note'
  | 'aq_number'
  | 'aq_tags'
  | 'aq_text';

export interface AnalysisQuestionDefinition {
  type: AnalysisQuestionType;
  label: string;
  icon: IconName;
  isAutomated?: boolean;
}

/**
 * Note: the order here matters - it influnces the order of the dropdown for
 * adding questions and possibly other UI elements
 */
export const ANALYSIS_QUESTION_DEFINITIONS: AnalysisQuestionDefinition[] = [
  {
    type: 'aq_tags',
    label: t('Tags'),
    icon: 'tag',
  },
  {
    type: 'aq_text',
    label: t('Text'),
    icon: 'qt-text',
  },
  {
    type: 'aq_number',
    label: t('Number'),
    icon: 'qt-number',
  },
  {
    type: 'aq_note',
    label: t('Note'),
    icon: 'qt-note',
  },
  {
    type: 'aq_keyword_search',
    label: t('Keyword search'),
    icon: 'tag',
    isAutomated: true,
  },
];
