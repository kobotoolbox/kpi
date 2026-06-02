// eslint-disable-next-line no-restricted-imports -- Theme extensions must import Mantine components directly.
import { Modal } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import KoboIcon from '#/components/common/KoboIcon'
import classes from './Modal.module.css'
import { KOBO_Z_INDEX } from './zIndex'

export const KOBO_MODAL_OVERLAY_PROPS = {
  backgroundOpacity: 0.2,
  color: 'var(--mantine-color-black)',
  zIndex: KOBO_Z_INDEX.modalOverlay,
} as const

export const KOBO_MODAL_SHARED_PROPS = {
  zIndex: KOBO_Z_INDEX.modal,
  overlayProps: KOBO_MODAL_OVERLAY_PROPS,
  closeButtonProps: {
    icon: <KoboIcon icon={IconX} />,
  },
  padding: 'lg',
} as const

export const ModalThemeKobo = Modal.extend({
  defaultProps: KOBO_MODAL_SHARED_PROPS,
  classNames: classes,
})
