import { Box } from '@mantine/core'
import { useEffect } from 'react'
import { useAssetSnapshotsCreate } from '#/api/react-query/form-content'

export interface EnketoPreviewModalProps {
  assetUrl: string
  onRequestClose: () => void
}

export function EnketoPreviewModal(props: EnketoPreviewModalProps) {
  const snapshotMutation = useAssetSnapshotsCreate()

  useEffect(() => {
    snapshotMutation.mutate({ data: { asset: props.assetUrl, details: {} } })
  })

  return <Box>Stuff {props.assetUrl}</Box>
}
