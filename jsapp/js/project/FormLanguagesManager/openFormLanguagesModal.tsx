import React from 'react'

import { Box, CloseButton, Group } from '@mantine/core'
import { modals } from '@mantine/modals'
import type { AssetResponse } from '#/dataInterface'
import { KOBO_MODAL_OVERLAY_PROPS } from '#/theme/kobo/Modal'
import FormLanguagesManager, { type FormLanguagesManagerView } from './FormLanguagesManager'

export function openFormLanguagesModal(asset: AssetResponse) {
  let requestModalClose = () => {}
  const modalSizeByView: Record<FormLanguagesManagerView, string> = {
    languages: 'lg',
    translations: '80%',
  }

  const modalId = modals.open({
    title: (
      <Group justify='space-between' wrap='nowrap'>
        <Box>{t('Manage Languages')}</Box>
        <CloseButton aria-label={t('Close')} onClick={() => requestModalClose()} />
      </Group>
    ),
    size: modalSizeByView.languages,
    // Keep default close button disabled and render a controlled one in title,
    // so close requests always go through FormLanguagesManager.requestClose.
    withCloseButton: false,
    // closeOnEscape and closeOnClickOutside are kept disabled because the
    // modals manager calls closeModal() directly, bypassing any guard logic.
    // Instead we intercept both events manually and route them through
    // FormLanguagesManager.requestClose (unsaved-changes confirmation):
    //   - Escape key: handled via onKeyDown on the content root Box
    //   - Overlay click: handled via overlayProps.onClick below
    closeOnEscape: false,
    closeOnClickOutside: false,
    overlayProps: {
      ...KOBO_MODAL_OVERLAY_PROPS,
      onClick: () => requestModalClose(),
    },
    children: (
      <FormLanguagesManager
        asset={asset}
        registerOnRequestClose={(closeHandler) => {
          requestModalClose = closeHandler
        }}
        onActiveViewChange={(view) => {
          modals.updateModal({
            modalId,
            size: modalSizeByView[view],
          })
        }}
        onRequestClose={() => {
          modals.close(modalId)
        }}
      />
    ),
  })

  requestModalClose = () => {
    modals.close(modalId)
  }
}
