import type {IconName} from 'jsapp/fonts/k-icons';

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
export type AnalysisQuestionType = 'aq_text';

export interface AnalysisQuestionDefinition {
  type: AnalysisQuestionType;
  label: string;
  icon: IconName;
}

type AnalysisQuestionDefinitions = {
  [P in AnalysisQuestionType]: AnalysisQuestionDefinition;
};

export const ANALYSIS_QUESTION_DEFINITIONS: AnalysisQuestionDefinitions = {
  aq_text: {
    type: 'aq_text',
    label: t('Text'),
    icon: 'qt-text',
  },
};
