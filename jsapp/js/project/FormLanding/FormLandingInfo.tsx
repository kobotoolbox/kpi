import { Box, Text } from '@mantine/core'
import ButtonNew from '#/components/common/ButtonNew'
import type { AssetResponse } from '#/dataInterface'
import { formatTime } from '#/utils'

interface FormLandingInfoProps {
  asset: AssetResponse
  canEdit: boolean
  isCurrentVersionDeployed: boolean
  onDeploy: () => void
  onUnarchive: () => void
}

export default function FormLandingInfo({
  asset,
  canEdit,
  isCurrentVersionDeployed,
  onDeploy,
  onUnarchive,
}: FormLandingInfoProps) {
  let deployedVersionCount = asset.deployed_versions.count
  let undeployedVersion: string | undefined

  // Undeployed changes count as a version of their own, so the number shown is one ahead of the deployed count.
  if (!isCurrentVersionDeployed) {
    undeployedVersion = `(${t('undeployed')})`
    deployedVersionCount += 1
  }

  return (
    <Box className='form-view__cell form-view__cell--columns form-view__cell--padding'>
      <Box className='form-view__cell'>
        <Box className='form-view__cell form-view__cell--version'>
          {deployedVersionCount > 0 ? `v${deployedVersionCount}` : ''}
        </Box>
        {undeployedVersion && canEdit && (
          <Box className='form-view__cell form-view__cell--undeployed'>&nbsp;{undeployedVersion}</Box>
        )}
        <Box className='form-view__cell form-view__cell--date'>
          {t('Last Modified')}&nbsp;:&nbsp;
          {asset.date_modified && formatTime(asset.date_modified)}&nbsp;-&nbsp;
          <Text component='span' className='question-count'>
            {asset.summary.row_count || '0'}&nbsp;
            {t('questions')}
          </Text>
        </Box>
      </Box>
      <Box className='form-view__cell form-view__cell--buttons'>
        {canEdit && asset.deployment_status === 'deployed' && (
          <ButtonNew variant='filled' size='lg' tt='uppercase' onClick={onDeploy}>
            {t('redeploy')}
          </ButtonNew>
        )}
        {canEdit && asset.deployment_status === 'draft' && (
          <ButtonNew variant='filled' size='lg' tt='uppercase' onClick={onDeploy}>
            {t('deploy')}
          </ButtonNew>
        )}
        {canEdit && asset.deployment_status === 'archived' && (
          <ButtonNew variant='filled' size='lg' tt='uppercase' onClick={onUnarchive}>
            {t('unarchive')}
          </ButtonNew>
        )}
      </Box>
    </Box>
  )
}
