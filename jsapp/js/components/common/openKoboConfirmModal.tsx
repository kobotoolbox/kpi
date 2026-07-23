import { modals } from '@mantine/modals'

type OpenConfirmModalParams = Parameters<typeof modals.openConfirmModal>[0]

/**
 * Thin wrapper around `modals.openConfirmModal` that applies Kobo defaults:
 * danger confirm button, light cancel button, and translated labels. Every
 * default can still be overridden per call. `ModalsProvider` doesn't accept
 * `confirmProps`/`cancelProps` defaults, so we set them here instead.
 */
export function openKoboConfirmModal({ confirmProps, cancelProps, labels, ...props }: OpenConfirmModalParams) {
  return modals.openConfirmModal({
    labels: { confirm: t('Confirm'), cancel: t('Cancel'), ...labels },
    confirmProps: { variant: 'danger', ...confirmProps },
    cancelProps: { variant: 'light', ...cancelProps },
    ...props,
  })
}
