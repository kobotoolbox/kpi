import type { LanguageCode } from '#/components/languages/languagesStore'
import { SUPPLEMENTAL_DETAILS_PROP } from '#/constants'

type SupplementalPathPartsType = 'transcript' | 'translation' | 'qual' | 'qualVerification'

interface SupplementalPathParts {
  sourceRowName: string
  /**
   * Includes groups. Will be the same as `sourceRowName` if there are no groups.
   */
  sourceRowPath: string
  /**
   * What kind of data the path refers to. Can be of transcript, translation or
   * qualitative analysis question. `null` is being returned when path is not
   * recognized.
   */
  type: SupplementalPathPartsType | null
  /**
   * Applicable only for transcripts and translations. This is the language code
   * of the text.
   */
  languageCode?: LanguageCode
  /**
   * Applicable only for qualitative analysis questions and verification.
   * This is the random uuid of the analysis question.
   */
  analysisQuestionUuid?: string
}

/**
 * Receives one of paths leading to a supplemental detail and breaks it down to
 * a more meaningful data. e.g. `_supplementalDetails/Who_was_that/translation_pl` or
 * `_supplementalDetails/outer_group/middle_group/inner_group/What_did_you_hear/transcript_pl`
 *
 * Useful for building datatable columns.
 */
export function getSupplementalPathParts(path: string): SupplementalPathParts {
  const pathArr = path.split('/')
  const lastEl = pathArr.pop()
  const lastElArr = lastEl?.split('_') || []

  // Handles path that is not a supplemental path
  if (pathArr[0] !== SUPPLEMENTAL_DETAILS_PROP) {
    return {
      sourceRowName: path,
      sourceRowPath: path,
      type: null,
    }
  }

  let pathType: SupplementalPathPartsType
  if (lastElArr[0] === 'transcript') {
    pathType = 'transcript'
  } else if (lastElArr[0] === 'translation') {
    pathType = 'translation'
  } else if (lastElArr[0] === 'verified') {
    pathType = 'qualVerification'
  } else {
    // For now the only other type of data here is the qualitative analysis
    // question
    pathType = 'qual'
  }

  const output: SupplementalPathParts = {
    sourceRowName: pathArr[pathArr.length - 1],
    // We start from second element, because first one is `SUPPLEMENTAL_DETAILS_PROP`
    sourceRowPath: pathArr.slice(1, pathArr.length).join('/'),
    type: pathType,
  }

  // For verification we need to override things, because path is built differently (has a suffix)
  if (pathType === 'qualVerification') {
    output.sourceRowName = pathArr[pathArr.length - 2]
    output.sourceRowPath = pathArr.slice(1, pathArr.length - 1).join('/')
    output.analysisQuestionUuid = pathArr[pathArr.length - 1]
  }

  // For transx we add the language code
  if (pathType === 'transcript' || pathType === 'translation') {
    output.languageCode = lastElArr[1]
  }

  // For qualitative analysis questions, we store the uuid of the question
  if (pathType === 'qual') {
    output.analysisQuestionUuid = lastEl
  }

  return output
}
