import { useState } from 'react'
import ClampedTitle from '#/components/common/ClampedTitle'
import Modal from '#/components/common/ModalNew'
import ProjectSettings from './ProjectSettings'
import styles from './ProjectSettings.module.scss'
import type { ProjectSettingsProps } from './types'

interface ProjectSettingsModalProps extends Omit<ProjectSettingsProps, 'onSetModalTitle' | 'onRequestClose'> {
  opened: boolean
  onClose: () => void
}

/** The NEW and REPLACE wizards in a modal. The wizard sets the title on every step. */
export default function ProjectSettingsModal({ opened, onClose, ...props }: ProjectSettingsModalProps) {
  const [title, setTitle] = useState('')

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<ClampedTitle>{title}</ClampedTitle>}
      size='xl'
      closeOnClickOutside={false}
      classNames={{ content: styles.modalContent, body: styles.modalBody }}
    >
      <ProjectSettings {...props} onSetModalTitle={setTitle} onRequestClose={onClose} />
    </Modal>
  )
}
