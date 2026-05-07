import { Modal } from '@mantine/core'
import { IconCancel } from '@tabler/icons-react'
import KoboIcon from '#/components/common/KoboIcon'
import classes from './Modal.module.css'
import { KOBO_Z_INDEX } from './zIndex'

export const KOBO_MODAL_SHARED_PROPS = {
  zIndex: KOBO_Z_INDEX.modal,
  overlayProps: {
    backgroundOpacity: 0.5,
    color: 'var(--mantine-color-blue-9)',
    zIndex: KOBO_Z_INDEX.modalOverlay,
  },
  closeButtonProps: {
    icon: <KoboIcon icon={IconCancel} />,
  },
  padding: 'lg',
} as const

export const ModalThemeKobo = Modal.extend({
  defaultProps: KOBO_MODAL_SHARED_PROPS,
  classNames: classes,
})
