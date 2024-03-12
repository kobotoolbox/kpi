import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import type {AssetContent, SubmissionAttachment} from 'js/dataInterface';
import {
  getQuestionXPath,
  getRowData,
  getMediaAttachment,
} from 'js/components/submissions/submissionUtils';

/**
 * Returns an error string or the attachment. It's basically a wrapper function
 * over `getMediaAttachment` for DRY purposes in `singleProcessingStore` context.
 */
export function getAttachmentForProcessing(
  assetContent: AssetContent
): string | SubmissionAttachment {
  const errorMessage = 'Insufficient data';

  const submissionData = singleProcessingStore.getSubmissionData();
  const currentQuestionName = singleProcessingStore.currentQuestionName;
  // We need `assetContent` with survey, submission data, and question name to
  // go further.
  if (!assetContent.survey || !submissionData || !currentQuestionName) {
    return errorMessage;
  }

  const rowData = getRowData(
    currentQuestionName,
    assetContent.survey,
    submissionData
  );
  // We need row data to go further.
  if (!rowData) {
    return errorMessage;
  }

  const questionXPath = getQuestionXPath(
    assetContent.survey,
    currentQuestionName
  );

  return getMediaAttachment(submissionData, rowData, questionXPath);
}

/**
 * For given length of an audio file (in seconds) returns a human-friendly
 * rough estimate.
 */
export function secondsToTranscriptionEstimate(sourceSeconds: number): string {
  const estimateSeconds = Math.round(sourceSeconds * 0.5 + 10);
  if (estimateSeconds < 45) {
    return t('less than a minute');
  } else if (estimateSeconds >= 45 && estimateSeconds < 75) {
    return t('about 1 minute');
  } else if (estimateSeconds >= 75 && estimateSeconds < 150) {
    return t('about 2 minutes');
  } else {
    return t('about 3 minutes');
  }
}
