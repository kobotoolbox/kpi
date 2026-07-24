export function getSubmissionPositionLabel(submissionIndex: number, submissionTotal: number) {
  return t('Submission ##submissionIndex## of ##submissionTotal##')
    .replace('##submissionIndex##', String(submissionIndex))
    .replace('##submissionTotal##', String(submissionTotal))
}
