import React, { useEffect, useState } from 'react'

import { when } from 'mobx'
import { actions } from '#/actions'
import { cleanupTags } from '#/assetUtils'
import bem from '#/bem'
import TagsInput from '#/components/common/TagsInput'
import Button from '#/components/common/button'
import LoadingSpinner from '#/components/common/loadingSpinner'
import type { AssetResponse } from '#/dataInterface'
import pageState from '#/pageState.store'
import sessionStore from '#/stores/session'
import { notify } from '#/utils'

interface AssetTagsFormProps {
  asset: AssetResponse
}

export const AssetTagsForm = ({ asset }: AssetTagsFormProps) => {
  const [isSessionLoaded, setIsSessionLoaded] = useState(!!sessionStore.isLoggedIn)
  const [isPending, setIsPending] = useState(false)
  const [tags, setTags] = useState<string[]>(() => (asset.tag_string ? asset.tag_string.split(',') : []))

  useEffect(() => {
    const disposeSessionWhen = when(
      () => sessionStore.isInitialLoadComplete,
      () => setIsSessionLoaded(true),
    )

    const unlisteners = [
      actions.resources.updateAsset.completed.listen(() => {
        setIsPending(false)
        pageState.hideModal()
      }),
      actions.resources.updateAsset.failed.listen(() => {
        setIsPending(false)
        notify(t('Failed to update tags'), 'error')
      }),
    ]

    return () => {
      disposeSessionWhen()
      unlisteners.forEach((clb) => clb())
    }
  }, [])

  const onSubmit = (evt: React.MouseEvent | React.FormEvent) => {
    evt.preventDefault()
    setIsPending(true)
    actions.resources.updateAsset(asset.uid, { tag_string: tags.join(',') })
  }

  const onTagsChange = (newValue: string[]) => {
    setTags(cleanupTags(newValue))
  }

  if (!isSessionLoaded) {
    return <LoadingSpinner />
  }

  return (
    <bem.FormModal__form className='project-settings'>
      <bem.FormModal__item m='wrapper' disabled={isPending}>
        <bem.FormModal__item>
          <TagsInput value={tags} onChange={onTagsChange} />
        </bem.FormModal__item>
      </bem.FormModal__item>

      <bem.Modal__footer>
        <Button type='primary' size='l' isSubmit onClick={onSubmit} isPending={isPending} label={t('Update')} />
      </bem.Modal__footer>
    </bem.FormModal__form>
  )
}
