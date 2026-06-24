import React, { useEffect, useState } from 'react'

import { Group, Stack } from '@mantine/core'
import { when } from 'mobx'
import { useAssetsPartialUpdate } from '#/api/react-query/manage-projects-and-library-content'
import { cleanupAndUniqueTags } from '#/assetUtils'
import ButtonNew from '#/components/common/ButtonNew'
import TagsInput from '#/components/common/TagsInput'
import LoadingSpinner from '#/components/common/loadingSpinner'
import type { AssetResponse } from '#/dataInterface'
import sessionStore from '#/stores/session'
import { notify } from '#/utils'

export type AssetTagsModalAsset = Pick<AssetResponse, 'uid'> & Partial<Pick<AssetResponse, 'tag_string'>>

export interface AssetTagsModalProps {
  asset: AssetTagsModalAsset
  onRequestClose: () => void
}

/**
 * Lets a user edit an asset's comma-separated tags and save them through Orval/react-query.
 */
export function AssetTagsModal({ asset, onRequestClose }: AssetTagsModalProps) {
  const [isSessionLoaded, setIsSessionLoaded] = useState(!!sessionStore.isLoggedIn)
  const [tags, setTags] = useState<string[]>(() => (asset.tag_string ? asset.tag_string.split(',') : []))

  useEffect(() => {
    // Some modal entrypoints can run before the session store finishes hydrating.
    // Waiting here keeps the form from rendering against incomplete auth state.
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

    // The backend still stores tags as one comma-delimited string, so we join
    // the cleaned list right before sending the PATCH request.
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
