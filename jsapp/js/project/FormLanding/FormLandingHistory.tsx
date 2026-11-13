import { Box, Group } from '@mantine/core'
import { useState } from 'react'
import ButtonNew from '#/components/common/ButtonNew'
import type { AssetResponse } from '#/dataInterface'
import FormHistory from './FormHistory'

interface FormLandingHistoryProps {
  asset: AssetResponse
  onClone: (versionUid: string) => void
}

export default function FormLandingHistory({ asset, onClone }: FormLandingHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <Box className={`form-view__row ${isExpanded ? 'historyExpanded' : 'historyHidden'}`}>
      <Box className='form-view__cell form-view__cell--columns form-view__cell--label form-view__cell--first form-view__cell--history-label'>
        <Box className='form-view__cell form-view__cell--label'>{t('Form history')}</Box>
      </Box>

      <Box className='form-view__cell form-view__cell--history-table'>
        <FormHistory
          isEnabled={isExpanded}
          assetUid={asset.uid}
          deployedVersionId={asset.deployed_version_id ?? undefined}
          deployedVersionsCount={asset.deployed_versions.count}
          deploymentActive={asset.deployment__active}
          deploymentStatus={asset.deployment_status}
          onClone={onClone}
        />
      </Box>
      {asset.deployed_versions.count > 1 && (
        <Group justify='center' gap='md' pt={isExpanded ? 'md' : 0}>
          <ButtonNew
            size='md'
            onClick={() => setIsExpanded((expanded) => !expanded)}
            leftIcon={isExpanded ? 'angle-up' : 'angle-down'}
            variant='transparent'
          >
            {isExpanded ? t('Hide full history') : t('Show full history')}
          </ButtonNew>
        </Group>
      )}
    </Box>
  )
}
