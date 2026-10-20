import { modals } from '@mantine/modals'
import { EnketoPreviewModal } from './EnketoPreviewModal'

interface EnketoPreviewModalParams {
  assetUrl: string
}

export function openEnketoPreviewModal(props: EnketoPreviewModalParams) {
  const modalId = modals.open({
    title: t('Form Preview'),
    size: 'xl',
    children: <EnketoPreviewModal assetUrl={props.assetUrl} onRequestClose={() => modals.close(modalId)} />,
  })

  return {
    modalId,
    close: () => modals.close(modalId),
  }
}
