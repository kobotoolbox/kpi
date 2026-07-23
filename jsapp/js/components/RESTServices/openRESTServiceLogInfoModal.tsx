import { Code } from '@mantine/core'
import { modals } from '@mantine/modals'
import { generateUuid } from '#/utils'

interface OpenRESTServiceLogInfoModalParams {
  submissionId: number
  message: string
}

export function openRESTServiceLogInfoModal({ submissionId, message }: OpenRESTServiceLogInfoModalParams) {
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
