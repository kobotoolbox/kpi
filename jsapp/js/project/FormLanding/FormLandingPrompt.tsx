import { TextInput } from '@mantine/core'
import KoboPrompt from '#/components/modals/koboPrompt'
import { ASSET_TYPES } from '#/constants'
import type { FormLandingPromptState } from './index'

interface FormLandingPromptProps {
  prompt: FormLandingPromptState | null
  cloneName: string
  onCloneNameChange: (name: string) => void
  onClose: () => void
  onSubmitClone: () => void
  isClonePending: boolean
  onConfirmUnarchive: () => void
  isUnarchivePending: boolean
}

export default function FormLandingPrompt({
  prompt,
  cloneName,
  onCloneNameChange,
  onClose,
  onSubmitClone,
  isClonePending,
  onConfirmUnarchive,
  isUnarchivePending,
}: FormLandingPromptProps) {
  if (prompt?.type === 'unarchive') {
    return (
      <KoboPrompt
        isOpen
        title={t('Unarchive Project')}
        onRequestClose={onClose}
        buttons={[
          { label: t('Cancel'), type: 'secondary', onClick: onClose },
          {
            label: t('Unarchive'),
            isPending: isUnarchivePending,
            onClick: onConfirmUnarchive,
          },
        ]}
      >
        {t('Are you sure you want to unarchive this project?')}
      </KoboPrompt>
    )
  }
  if (prompt?.type === 'clone') {
    return (
      <KoboPrompt
        isOpen
        title={
          prompt.assetType === ASSET_TYPES.template.id ? t('Create new template from this project') : t('Clone Project')
        }
        onRequestClose={onClose}
        buttons={[
          { label: t('Cancel'), type: 'secondary', onClick: onClose },
          {
            label: prompt.assetType === ASSET_TYPES.template.id ? t('Create') : t('Clone'),
            isPending: isClonePending,
            onClick: onSubmitClone,
          },
        ]}
      >
        <TextInput
          label={
            prompt.assetType === ASSET_TYPES.template.id
              ? t('Enter the name of the new template.')
              : t('Enter the name of the cloned project. Leave empty to keep the original name.')
          }
          value={cloneName}
          onChange={(event) => onCloneNameChange(event.currentTarget.value)}
        />
      </KoboPrompt>
    )
  }
  return null
}
