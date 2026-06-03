import type { LanguageCode } from '#/components/languages/languagesStore'
import { SUPPLEMENTAL_DETAILS_PROP } from '#/constants'

type SupplementalPathPartsType = 'transcript' | 'translation' | 'qual' | 'qualVerification'

export interface SupplementalPathParts {
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
  // last element can be either single word or transcript/translation word plus underscore and two letter language code
  const lastEl = pathArr[pathArr.length - 1]

  // Handles path that is not a supplemental path (i.e. doesn't start on `SUPPLEMENTAL_DETAILS_PROP`)
  if (pathArr[0] !== SUPPLEMENTAL_DETAILS_PROP) {
    return {
      sourceRowName: path,
      sourceRowPath: path,
      type: null,
    }
  }

  let pathType: SupplementalPathPartsType
  if (lastEl.startsWith('transcript')) {
    pathType = 'transcript'
  } else if (lastEl.startsWith('translation')) {
    pathType = 'translation'
  } else if (lastEl === 'verified') {
    pathType = 'qualVerification'
  } else {
    // For now the only other type of data here is the qualitative analysis
    // question
    pathType = 'qual'
  }

  const output: SupplementalPathParts = {
    // This is the name of the source row, without any groups.
    sourceRowName: pathArr[pathArr.length - 2],
    // We start from second element, because first one is `SUPPLEMENTAL_DETAILS_PROP`
    sourceRowPath: pathArr.slice(1, pathArr.length - 1).join('/'),
    type: pathType,
  }

  // For verification we need to override things, because path is built differently (has a suffix)
  if (pathType === 'qualVerification') {
    output.sourceRowName = pathArr[pathArr.length - 3]
    output.sourceRowPath = pathArr.slice(1, pathArr.length - 2).join('/')
    output.analysisQuestionUuid = pathArr[pathArr.length - 2]
  }

  // For transx we add the language code
  if (pathType === 'transcript' || pathType === 'translation') {
    const lastElArr = lastEl?.split('_') || []
    output.languageCode = lastElArr[1]
  }

  // For qualitative analysis questions, we store the uuid of the question
  if (pathType === 'qual') {
    output.analysisQuestionUuid = lastEl
  }

  return output
}

/**
 * Builds a supplemental details path string from its components.
 * Accepts a SupplementalPathParts object (as returned by getSupplementalPathParts).
 * Only relevant fields for each type are required.
 */
export function buildSupplementalPath(args: Partial<SupplementalPathParts>): string {
  if (!args.type) throw new Error('type is required')
  switch (args.type) {
    case 'transcript': {
      if (!args.sourceRowPath) throw new Error('sourceRowPath is required for transcript')
      if (!args.languageCode) throw new Error('languageCode is required for transcript')
      return `${SUPPLEMENTAL_DETAILS_PROP}/${args.sourceRowPath}/transcript_${args.languageCode}`
    }
    case 'translation': {
      if (!args.sourceRowPath) throw new Error('sourceRowPath is required for translation')
      if (!args.languageCode) throw new Error('languageCode is required for translation')
      return `${SUPPLEMENTAL_DETAILS_PROP}/${args.sourceRowPath}/translation_${args.languageCode}`
    }
    case 'qual': {
      if (!args.sourceRowPath) throw new Error('sourceRowPath is required for qual')
      if (!args.analysisQuestionUuid) throw new Error('analysisQuestionUuid is required for qual')
      return `${SUPPLEMENTAL_DETAILS_PROP}/${args.sourceRowPath}/${args.analysisQuestionUuid}`
    }
    case 'qualVerification': {
      if (!args.sourceRowPath) throw new Error('sourceRowPath is required for qualVerification')
      if (!args.analysisQuestionUuid) throw new Error('analysisQuestionUuid is required for qualVerification')
      return `${SUPPLEMENTAL_DETAILS_PROP}/${args.sourceRowPath}/${args.analysisQuestionUuid}/verified`
    }
    default:
      throw new Error('Unsupported supplemental path type')
  }
}
