import { TextInput } from '@mantine/core'
import KoboPrompt from '#/components/modals/koboPrompt'
import { ASSET_TYPES } from '#/constants'
import type { FormLandingCloneAssetType } from './index'

interface FormLandingClonePromptProps {
  assetType: FormLandingCloneAssetType
  cloneName: string
  onCloneNameChange: (name: string) => void
  onClose: () => void
  onSubmit: () => void
  isPending: boolean
}

export default function FormLandingClonePrompt({
  assetType,
  cloneName,
  onCloneNameChange,
  onClose,
  onSubmit,
  isPending,
}: FormLandingClonePromptProps) {
  const isTemplate = assetType === ASSET_TYPES.template.id
  return (
    <KoboPrompt
      isOpen
      title={isTemplate ? t('Create new template from this project') : t('Clone Project')}
      onRequestClose={onClose}
      buttons={[
        { label: t('Cancel'), type: 'secondary', onClick: onClose },
        { label: isTemplate ? t('Create') : t('Clone'), isPending, onClick: onSubmit },
      ]}
    >
      <TextInput
        label={
          isTemplate
            ? t('Enter the name of the new template.')
            : t('Enter the name of the cloned project. Leave empty to keep the original name.')
        }
        value={cloneName}
        onChange={(event) => onCloneNameChange(event.currentTarget.value)}
      />
    </KoboPrompt>
  )
}
