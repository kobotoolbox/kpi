import { Group, Modal, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { fetchDelete } from '#/api'
import { dataInterface } from '#/dataInterface'
import ButtonNew from '#/components/common/ButtonNew'
import { notify } from '#/utils'

interface RegenerateApiKeyModalProps {
  opened: boolean
  onClose: () => void
  onSuccess: (newToken: string) => void
}

export default function RegenerateApiKeyModal({
  opened,
  onClose,
  onSuccess,
}: RegenerateApiKeyModalProps) {
  const [isRegenerating, setIsRegenerating] = useState(false)

  const handleRegenerate = async () => {
    setIsRegenerating(true)
    try {
      await fetchDelete('/token/')
      const result = await dataInterface.apiToken()
      onSuccess(result.token)
      onClose()
    } catch {
      notify.error(t('Failed to regenerate API key'))
    } finally {
      setIsRegenerating(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={t('Regenerate API Key')} size='md'>
      <Stack>
        <Text>
          {t('Are you sure you want to regenerate your API key?')}{' '}
          <strong>{t('Your existing key will be immediately invalidated.')}</strong>
        </Text>

        <Group justify='flex-end'>
          <ButtonNew size='md' onClick={onClose} variant='light' disabled={isRegenerating}>
            {t('Cancel')}
          </ButtonNew>

          <ButtonNew
            size='md'
            onClick={handleRegenerate}
            variant='danger'
            loading={isRegenerating}
          >
            {t('Regenerate')}
          </ButtonNew>
        </Group>
      </Stack>
    </Modal>
  )
}
