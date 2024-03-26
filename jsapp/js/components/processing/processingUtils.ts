import {ROUTES} from 'js/router/routerConstants';
import type {LanguageCode} from 'js/components/languages/languagesStore';
import {router} from 'js/router/legacy';

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

/** Opens processing view for given response to question in a project. */
export function openProcessing(
  assetUid: string,
  qpath: string,
  submissionEditId: string,
  filters: string | undefined,
  sort: string | Array<{desc: boolean; id: string}> | undefined,
  pageSize: number | string,
  startIndex: number | string
) {
  let route = ROUTES.FORM_PROCESSING.replace(':uid', assetUid)
    .replace(':qpath', qpath)
    .replace(':submissionEditId', submissionEditId)
    // filters are optional, and empty strings are a no-no for react-router
    .replace(':filters', filters || 'none')
    .replace(':pageSize', pageSize.toString())
    .replace(':startIndex', startIndex.toString());
  if (typeof sort === 'string') {
    route = route.replace(':sort', sort);
  } else if (sort) {
    route = route.replace(':sort', JSON.stringify(sort));
  } else {
    route = route.replace(':sort', '[]');
  }
  router!.navigate(route);
}
