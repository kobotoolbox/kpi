import {SUPPLEMENTAL_DETAILS_PROP} from 'js/constants';

/**
 * Returns a path that leads to transcription value in the submission response,
 * something like `_supplementalDetails/your_name/transcript/pl`.
 */
export function getSupplementalTranscriptPath(
  questionName: string,
  languageCode: string
) {
  return `${SUPPLEMENTAL_DETAILS_PROP}/${questionName}/transcript/${languageCode}`;
}

/**
 * Returns column name for internal and backend usage,
 * something like `your_name/transcript_pl`.
 */
export function getSupplementalTranscriptColumnName(
  questionName: string,
  languageCode: string
) {
  return `${questionName}/transcript_${languageCode}`;
}

/**
 * Returns a path that leads to translation value in the submission response,
 * something like `_supplementalDetails/your_name/translated/pl`.
 */
export function getSupplementalTranslationPath(
  questionName: string,
  languageCode: string
) {
  return `${SUPPLEMENTAL_DETAILS_PROP}/${questionName}/translated/${languageCode}`;
}

/**
 * Returns column name for internal and backend usage,
 * something like `your_name/translated_pl`.
 */
export function getSupplementalTranslationColumnName(
  questionName: string,
  languageCode: string
) {
  return `${questionName}/translated_${languageCode}`;
}
