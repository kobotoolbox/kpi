import React, { useEffect, useState } from 'react'

import { Group, Stack } from '@mantine/core'
import { modals } from '@mantine/modals'
import { when } from 'mobx'
import { useAssetsPartialUpdate } from '#/api/react-query/manage-projects-and-library-content'
import { cleanupAndUniqueTags } from '#/assetUtils'
import ButtonNew from '#/components/common/ButtonNew'
import TagsInput from '#/components/common/TagsInput'
import LoadingSpinner from '#/components/common/loadingSpinner'
import type { AssetResponse } from '#/dataInterface'
import sessionStore from '#/stores/session'
import { notify } from '#/utils'

type AssetTagsModalAsset = Pick<AssetResponse, 'uid'> & Partial<Pick<AssetResponse, 'tag_string'>>

interface AssetTagsModalProps {
  asset: AssetTagsModalAsset
  onRequestClose: () => void
}

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

export default function AssetTagsModal({ asset, onRequestClose }: AssetTagsModalProps) {
  const [isSessionLoaded, setIsSessionLoaded] = useState(!!sessionStore.isLoggedIn)
  const [tags, setTags] = useState<string[]>(() => (asset.tag_string ? asset.tag_string.split(',') : []))

  useEffect(() => {
    const disposeSessionWhen = when(
      () => sessionStore.isInitialLoadComplete,
      () => setIsSessionLoaded(true),
    )

    return () => {
      disposeSessionWhen()
    }
  }, [])

  const updateAssetMutation = useAssetsPartialUpdate({
    mutation: {
      onSuccess: () => {
        onRequestClose()
      },
      onError: () => {
        notify.error(t('Failed to update tags'))
      },
    },
  })

  function onTagsChange(nextValue: string[]) {
    setTags(cleanupAndUniqueTags(nextValue))
  }

  function onSubmit(evt: React.MouseEvent<HTMLButtonElement> | React.FormEvent<HTMLFormElement>) {
    evt.preventDefault()

    updateAssetMutation.mutate({
      uidAsset: asset.uid,
      data: {
        tag_string: tags.join(','),
      },
    })
  }

  if (!isSessionLoaded) {
    return <LoadingSpinner />
  }

  return (
    <form onSubmit={onSubmit}>
      <Stack gap='lg'>
        <TagsInput value={tags} onChange={onTagsChange} disabled={updateAssetMutation.isPending} data-autofocus />

        <Group justify='flex-end'>
          <ButtonNew type='submit' size='lg' loading={updateAssetMutation.isPending}>
            {t('Update')}
          </ButtonNew>
        </Group>
      </Stack>
    </form>
  )
}
