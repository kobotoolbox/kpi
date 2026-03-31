import React, { useState } from 'react'

import { fetchPost, handleApiFail } from '#/api'
import KoboPrompt from '#/components/modals/koboPrompt'
import customViewStore from '#/projects/customViewStore'
import { notify } from '#/utils'

interface BulkArchivePromptProps {
  assetUids: string[]
  action: 'archive' | 'unarchive'
  onRequestClose: () => void
}

export default function BulkArchivePrompt(props: BulkArchivePromptProps) {
  const [isPending, setIsPending] = useState(false)
  const count = props.assetUids.length
  const isArchive = props.action === 'archive'

  function onConfirm() {
    setIsPending(true)
    fetchPost<{ detail: string }>('/api/v2/assets/bulk/', {
      payload: { asset_uids: props.assetUids, action: props.action },
    })
      .then((response) => {
        props.onRequestClose()
        customViewStore.fetchAssets()
        notify(response.detail)
      })
      .catch(handleApiFail)
  }

  return (
    <KoboPrompt
      isOpen
      onRequestClose={props.onRequestClose}
      title={
        isArchive
          ? t('Archive ##count## projects').replace('##count##', String(count))
          : t('Unarchive ##count## projects').replace('##count##', String(count))
      }
      buttons={[
        {
          type: 'secondary',
          label: t('Cancel'),
          onClick: props.onRequestClose,
          isDisabled: isPending,
        },
        {
          type: 'primary',
          label: isArchive ? t('Archive') : t('Unarchive'),
          onClick: onConfirm,
          isPending: isPending,
        },
      ]}
    >
      {isArchive ? (
        <>
          <p>{t('Are you sure you want to archive these projects?')}</p>
          <p>
            <strong>{t('Your forms will not accept submissions while they are archived.')}</strong>
          </p>
        </>
      ) : (
        t('Are you sure you want to unarchive these projects?')
      )}
    </KoboPrompt>
  )
}
