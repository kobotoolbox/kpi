import type {LanguageCode} from 'js/components/languages/languagesStore';
import type {ProcessingTabName} from 'js/components/processing/singleProcessingStore';

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

/**
 * Checks if two processing paths differ only with the tab part and are
 * identical
 */
export function isSamePathExceptTab(firstPath: string, secondPath: string) {
  const firstPathArray = firstPath.split('/');
  const secondPathArray = secondPath.split('/');
  // Remove the tab part from both paths and compare
  return (
    firstPathArray.splice(7, 1).join('/') ===
    secondPathArray.splice(7, 1).join('/')
  );
}

interface ProcessingPathParts {
  assetUid: string;
  qpath: string;
  submissionEditId: string;
  tab: ProcessingTabName;
}

/**
 * For given processing path, returns all params
 */
export function getProcessingPathParts(path: string): ProcessingPathParts {
  const pathArray = path.split('/');

  // We assume this will always be correct :fingers_crossed:
  const pathTabPart = pathArray[7] as ProcessingTabName;

  return {
    assetUid: pathArray[2],
    qpath: pathArray[5],
    submissionEditId: pathArray[6],
    tab: pathTabPart,
  };
}
