import { modals } from '@mantine/modals'
import type { AssetResponse } from '#/dataInterface'
import TableSettings from './TableSettings'

interface OpenTableSettingsModalArgs {
  asset: AssetResponse
}

const TABLE_SETTINGS_MODAL_ID = 'table-settings-modal'

// Guard so the modal can only appear once at a time. Mantine doesn't dedupe by
// `modalId` on its own, so we track open state here and no-op on a second open.
let isOpen = false

export function openTableSettingsModal({ asset }: OpenTableSettingsModalArgs) {
  const close = () => modals.close(TABLE_SETTINGS_MODAL_ID)

  if (isOpen) {
    return { modalId: TABLE_SETTINGS_MODAL_ID, close }
  }
  isOpen = true

  modals.open({
    modalId: TABLE_SETTINGS_MODAL_ID,
    title: t('Table display options'),
    onClose: () => {
      isOpen = false
    },
    // The form closes itself once its own save resolves.
    children: <TableSettings asset={asset} onRequestClose={close} />,
  })

  return { modalId: TABLE_SETTINGS_MODAL_ID, close }
}
