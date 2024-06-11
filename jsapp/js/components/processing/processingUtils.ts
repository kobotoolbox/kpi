import type {LanguageCode} from 'js/components/languages/languagesStore';
import {QuestionTypeName} from 'js/constants';

/** Single Processing is capable of handling these question types. */
export const PROCESSING_QUESTION_TYPES = [
  QuestionTypeName.audio,
  QuestionTypeName['background-audio']
];

type SupplementalPathPartsType = 'transcript' | 'translation' | 'qual';

interface SupplementalPathParts {
  sourceRowName: string;
  /**
   * What kind of data the path refers to. Can be of transcript, translation or
   * qualitative analysis question.
   */
  type: SupplementalPathPartsType;
  /**
   * Applicable only for transcripts and translations. This is the language code
   * of the text.
   */
  languageCode?: LanguageCode;
  /** Applicable only for qualitative analysis questions. This is a random uuid. */
  analysisQuestionUuid?: string;
}

/**
 * Receives one of paths leading to a supplemental detail and breaks it down to
 * a more meaningful data.
 */
export function getSupplementalPathParts(path: string): SupplementalPathParts {
  const pathArr = path.split('/');
  const path2Arr = pathArr[2].split('_');

  let pathType: SupplementalPathPartsType;
  if (path2Arr[0] === 'transcript') {
    pathType = 'transcript';
  } else if (path2Arr[0] === 'translation') {
    pathType = 'translation';
  } else {
    // For now the only other type of data here is the qualitative analysis
    // question
    pathType = 'qual';
  }

  const output: SupplementalPathParts = {
    sourceRowName: pathArr[1],
    type: pathType,
  };

  // For transx we add the language code
  if (pathType === 'transcript' || pathType === 'translation') {
    output.languageCode = path2Arr[1];
  }

  // For qualitative analysis questions, we store the uuid of the question
  if (pathType === 'qual') {
    output.analysisQuestionUuid = pathArr[2];
  }

  return output;
}
