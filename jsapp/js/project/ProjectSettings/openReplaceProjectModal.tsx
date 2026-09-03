import { modals } from '@mantine/modals'
import ClampedTitle from '#/components/common/ClampedTitle'
import { PROJECT_SETTINGS_CONTEXTS } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import ProjectSettings from './ProjectSettings'

interface OpenReplaceProjectModalOptions {
  asset: AssetResponse
}

/** Opens sharing permissions in a Mantine modal. */
export function openReplaceProjectModal(options: OpenReplaceProjectModalOptions) {
  const setModalTitle = (title: string) => modals.updateModal({ modalId, title: <ClampedTitle>{title}</ClampedTitle> })

  const modalId = modals.open({
    title: <ClampedTitle>{t('Replace form: Choose a source')}</ClampedTitle>,
    size: 'xl',
    children: (
      <ProjectSettings
        context={PROJECT_SETTINGS_CONTEXTS.REPLACE}
        onSetModalTitle={setModalTitle}
        formAsset={options.asset}
      />
    ),
  })

  return {
    modalId,
    close: () => modals.close(modalId),
  }
}
