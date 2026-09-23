import { Box } from '@mantine/core'
import { useEffect } from 'react'
import { useAssetSnapshotsCreate } from '#/api/react-query/form-content'
import LoadingSpinner from '../common/loadingSpinner'

export interface EnketoPreviewModalProps {
  assetUrl: string
  onRequestClose: () => void
}

export function EnketoPreviewModal(props: EnketoPreviewModalProps) {
  const snapshotMutation = useAssetSnapshotsCreate()

  useEffect(() => {
    snapshotMutation.mutate({ data: { asset: props.assetUrl, details: {} } })
  }, [props.assetUrl])

  const previewUrl = snapshotMutation.data?.status === 201 ? snapshotMutation.data.data.enketopreviewlink : undefined

  if (snapshotMutation.isIdle || snapshotMutation.isPending) {
    return <LoadingSpinner />
  }

  if (snapshotMutation.isError || !previewUrl) {
    return t('Unable to load form preview')
  }

  return (
    <Box display={'flex'} w={'100%'} h='70vh' style={{ flexDirection: 'column' }}>
      <iframe
        src={previewUrl}
        title={t('Form Preview')}
        allow='camera *; microphone *; geolocation *'
        style={{ display: 'block', width: '100%', height: '100%', flex: 1, border: 0 }}
      />
    </Box>
  )
}
