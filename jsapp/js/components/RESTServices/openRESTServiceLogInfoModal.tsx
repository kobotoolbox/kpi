import { Code } from '@mantine/core'
import { modals } from '@mantine/modals'
import { generateUuid } from '#/utils'

interface OpenRESTServiceLogInfoModalParams {
  submissionId: number
  message: string
}

/**
 * Opens a modal showing the failure detail for a single REST Service log entry.
 * The `message` is the raw text the backend returned (often a stack trace or
 * error body), so we show it inside a `<Code>` block to keep its formatting.
 *
 * Returns the modal's id plus a `close()` helper for programmatic closing.
 */
export function openRESTServiceLogInfoModal({ submissionId, message }: OpenRESTServiceLogInfoModalParams) {
  // Each modal needs its own id so opening a second one doesn't clobber the first.
  const modalId = `rest-service-log-info-${generateUuid()}`

  modals.open({
    modalId,
    title: t('Submission Failure Detail (##id##)').replace('##id##', String(submissionId)),
    size: 'lg',
    children: <Code block>{message}</Code>,
  })

  return {
    modalId,
    close: () => modals.close(modalId),
  }
}
