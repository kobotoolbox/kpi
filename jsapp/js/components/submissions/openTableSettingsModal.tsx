import { modals } from '@mantine/modals'
import type { AssetResponse } from '#/dataInterface'
import TableSettings from './TableSettings'

interface OpenTableSettingsModalArgs {
  asset: AssetResponse
}

export function openTableSettingsModal({ asset }: OpenTableSettingsModalArgs) {
  const modalId = modals.open({
    title: t('Table display options'),
    children: <TableSettings asset={asset} />,
  })

  return {
    modalId,
    close: () => modals.close(modalId),
  }
}
