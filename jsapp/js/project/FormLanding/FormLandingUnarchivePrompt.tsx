import KoboPrompt from '#/components/modals/koboPrompt'

interface FormLandingUnarchivePromptProps {
  onClose: () => void
  onConfirm: () => void
  isPending: boolean
}

export default function FormLandingUnarchivePrompt({ onClose, onConfirm, isPending }: FormLandingUnarchivePromptProps) {
  return (
    <KoboPrompt
      isOpen
      title={t('Unarchive Project')}
      onRequestClose={onClose}
      buttons={[
        { label: t('Cancel'), type: 'secondary', onClick: onClose },
        { label: t('Unarchive'), isPending, onClick: onConfirm },
      ]}
    >
      {t('Are you sure you want to unarchive this project?')}
    </KoboPrompt>
  )
}
