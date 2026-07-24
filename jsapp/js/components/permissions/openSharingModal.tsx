import { modals } from '@mantine/modals'
import { getAssetDisplayName } from '#/assetUtils'
import SharingForm from '#/components/permissions/sharingForm.component'
import type { AssetResponse, ProjectViewAsset } from '#/dataInterface'

interface OpenSharingModalOptions {
  asset: AssetResponse | ProjectViewAsset
}

/** Opens sharing permissions in a Mantine modal. */
export function openSharingModal(options: OpenSharingModalOptions) {
  const assetName = getAssetDisplayName(options.asset).final

  const modalId = modals.open({
    title: t('Sharing Permissions: ##project name##').replace('##project name##', assetName),
    size: 'lg',
    children: <SharingForm assetUid={options.asset.uid} />,
  })

  return {
    modalId,
    close: () => modals.close(modalId),
  }
}
