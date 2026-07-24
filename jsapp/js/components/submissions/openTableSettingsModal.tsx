import { modals } from '@mantine/modals'
import type { AssetResponse } from '#/dataInterface'
import TableSettings from './TableSettings'

interface OpenTableSettingsModalArgs {
  asset: AssetResponse
}

export function openTableSettingsModal({ asset }: OpenTableSettingsModalArgs) {
  const modalId = modals.open({
    title: t('Table display options'),
    // We render the modal id into the form so it can close *itself* once its own
    // save resolves. Closing must be owned by this instance: the underlying
    // `actions.table.updateSettings.completed` broadcast carries no reference to
    // which modal triggered it, so a shared close handler in a parent would close
    // whatever modal happens to be open when an earlier, unrelated save resolves.
    children: <TableSettings asset={asset} onRequestClose={() => modals.close(modalId)} />,
  })

  return {
    modalId,
    close: () => modals.close(modalId),
  }
}
