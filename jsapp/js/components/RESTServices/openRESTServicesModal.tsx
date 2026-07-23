import { modals } from '@mantine/modals'
import { generateUuid } from '#/utils'
import RESTServicesForm from './RESTServicesForm'

interface OpenRESTServicesModalParams {
  assetUid: string
  hookUid?: string
}

export function openRESTServicesModal({ assetUid, hookUid }: OpenRESTServicesModalParams) {
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
