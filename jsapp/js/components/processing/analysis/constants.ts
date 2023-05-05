import type {IconName} from 'jsapp/fonts/k-icons';
import type {LanguageCode} from 'js/components/languages/languagesStore';

export const AUTO_SAVE_TYPING_DELAY = 3000;

/**
 * To differentiate these question types from the ones we use in Form Builder,
 * let's prefix them with `aq_` (abbreviation for "analysis question").
 */
export type AnalysisQuestionType =
  | 'aq_keyword_search'
  | 'aq_note'
  | 'aq_number'
  | 'aq_select_multiple'
  | 'aq_select_one'
  | 'aq_tags'
  | 'aq_text';

/**
 * This is a sum of all different possible fields for multiple question types.
 *
 * TODO: find a TypeScript way to make make this better.
 */
export interface AdditionalFields {
  /** A list of keywords to search for. */
  keywords?: string[];
  /** Used for `aq_keyword_search` question to indicate search in progress. */
  isSearching?: boolean;
  /** The transcript or translation source for the search. */
  source?: LanguageCode;
  /** For the `aq_seleect_one` and `aq_select_multiple` question types */
  choices?: Array<{
    label: string;
    uid: string;
  }>;
}

/**
 * An instance of analysis question. We use the same object for question
 * definition and response.
 */
export interface AnalysisQuestion {
  type: AnalysisQuestionType;
  label: string;
  uid: string;
  response: string;
  additionalFields?: AdditionalFields;
}

/**
 * The definition is the object that tells us what kind of questions are
 * available for being created.
 */
export interface AnalysisQuestionDefinition {
  type: AnalysisQuestionType;
  label: string;
  icon: IconName;
  /** Tells the UI to display it in separate section in dropdown. */
  isAutomated?: boolean;
  /** to see if all required data was provided. */
  additionalFieldNames?: Array<'keywords' | 'source' | 'choices'>;
}

/**
 * Note: the order here matters - it influnces the order of the dropdown for
 * adding questions and possibly other UI elements.
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
    type: 'aq_select_one',
    label: t('Single choice'),
    icon: 'qt-select-one',
    additionalFieldNames: ['choices'],
  },
  {
    type: 'aq_select_multiple',
    label: t('Multiple choice'),
    icon: 'qt-select-many',
    additionalFieldNames: ['choices'],
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
    additionalFieldNames: ['keywords', 'source'],
  },
];
