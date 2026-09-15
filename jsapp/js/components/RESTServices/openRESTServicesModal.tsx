import { modals } from '@mantine/modals'
import { generateUuid } from '#/utils'
import RESTServicesForm from './RESTServicesForm'

interface OpenRESTServicesModalParams {
  assetUid: string
  hookUid?: string
}

/**
 * Opens the "New / Edit REST Service" form in a Mantine modal. Pass a `hookUid`
 * to edit an existing service; leave it out to create a new one.
 *
 * Returns the modal's id plus a `close()` helper, so the caller can close it
 * programmatically if needed. The form itself also closes the modal after a
 * successful save via the `onRequestClose` callback we pass below.
 */
export function openRESTServicesModal({ assetUid, hookUid }: OpenRESTServicesModalParams) {
  // Each modal needs its own id so opening a second one doesn't clobber the first.
  const modalId = `rest-services-${generateUuid()}`

  modals.open({
    modalId,
    title: hookUid ? t('Edit REST Service') : t('New REST Service'),
    size: 'lg',
    children: <RESTServicesForm assetUid={assetUid} hookUid={hookUid} onRequestClose={() => modals.close(modalId)} />,
  })

  return {
    modalId,
    close: () => modals.close(modalId),
  }
}
