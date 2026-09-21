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

  if (snapshotMutation.isPending) {
    return <LoadingSpinner />
  }

  if (snapshotMutation.isError || !previewUrl) {
    return t('Unable to load form preview')
  }

  return (
    <Box>
      <iframe src={previewUrl} title={t('Form Preview')} />
    </Box>
  )
}
