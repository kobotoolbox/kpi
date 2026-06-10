import React from 'react'

import { modals } from '@mantine/modals'
import { AssetTagsModal, type AssetTagsModalAsset } from './AssetTagsModal'

/**
 * Opens the Mantine-based asset tags editor and returns imperative close helpers.
 */
export function openAssetTagsModal(asset: AssetTagsModalAsset) {
  let modalId = ''

  modalId = modals.open({
    title: t('Edit tags'),
    size: 'lg',
    children: <AssetTagsModal asset={asset} onRequestClose={() => modals.close(modalId)} />,
  })

  return {
    modalId,
    close: () => modals.close(modalId),
  }
}
