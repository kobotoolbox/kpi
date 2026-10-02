import { Anchor, Box } from '@mantine/core'
import { getFormBuilderAssetType } from '#/components/formBuilder/formBuilderUtils'
import { hasAssetAnyLocking, isAssetAllLocked } from '#/components/locking/lockingUtils'
import type { AssetTypeName } from '#/constants'
import envStore from '#/envStore'
import type { AssetResponse } from '../dataInterface'

const LOCKING_SUPPORT_URL = 'library_locking.html'

interface FormbuilderAssetLabelProps {
  asset: AssetResponse | undefined
  desiredAssetType: AssetTypeName | undefined
}

export default function FormbuilderAssetLabel(props: FormbuilderAssetLabelProps) {
  if (!props.asset) {
    return null
  }

  const assetTypeLabel = getFormBuilderAssetType(props.asset.asset_type, props.desiredAssetType)?.label || 'asset'

  // Case 1: there is no asset yet (creating a new) or asset is not locked
  if (!props.asset.content || !hasAssetAnyLocking(props.asset.content)) {
    return <>{assetTypeLabel}</>
  }

  // Case 2: asset is locked fully or partially
  let lockedLabel = t('Partially locked ##type##').replace('##type##', assetTypeLabel)
  if (isAssetAllLocked(props.asset.content)) {
    lockedLabel = t('Fully locked ##type##').replace('##type##', assetTypeLabel)
  }

  return (
    <Box component='span' className='locked-asset-type-label'>
      <i className='k-icon k-icon-lock' />

      {lockedLabel}

      {envStore.isReady && envStore.data.support_url && (
        <Anchor
          href={envStore.data.support_url + LOCKING_SUPPORT_URL}
          target='_blank'
          data-tip={t('Read more about Locking')}
        >
          <i className='k-icon k-icon-help' />
        </Anchor>
      )}
    </Box>
  )
}
