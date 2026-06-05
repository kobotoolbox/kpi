import React, { useState, useEffect } from 'react'

import { Group, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import cx from 'classnames'
import securityStyles from '#/account/security/securityRoute.module.scss'
import ButtonNew from '#/components/common/ButtonNew'
import ModalNew from '#/components/common/ModalNew'
import Button from '#/components/common/button'
import TextBox from '#/components/common/textBox'
import { dataInterface } from '#/dataInterface'
import { notify } from '#/utils'
import styles from './apiTokenSection.module.scss'

const HIDDEN_TOKEN_VALUE = '*'.repeat(40)

/**
 * Displays secret API token of a logged in user.
 * The token is obfuscated until a "show me" button is clicked.
 */
export default function ApiTokenDisplay() {
  const [token, setToken] = useState(null)
  const [isFetching, setIsFetching] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isRegenerateModalOpen, regenerateModal] = useDisclosure(false)
  const [isRegenerating, setIsRegenerating] = useState(false)

  const toggleTokenVisibility = () => {
    setIsVisible(!isVisible)
  }

  useEffect(() => {
    if (isVisible && token === null) {
      const fetchToken = async () => {
        setIsFetching(true)
        try {
          const result = await dataInterface.apiToken()
          setToken(result.token)
        } catch {
          notify.error(t('Failed to get API token'))
        } finally {
          setIsFetching(false)
        }
      }

      fetchToken()
    }
  }, [isVisible])

  const regenerateToken = async () => {
    setIsRegenerating(true)
    try {
      // Revoke the existing token first, and immediately clear it from local
      // state so a now-invalid token is never displayed.
      await dataInterface.deleteApiToken()
      setToken(null)
      // Fetching the token triggers the backend to generate a new one.
      const result = await dataInterface.apiToken()
      setToken(result.token)
      notify(t('API key regenerated successfully'))
      regenerateModal.close()
    } catch {
      notify.error(t('Failed to regenerate API key'))
    } finally {
      setIsRegenerating(false)
    }
  }

  return (
    <section className={securityStyles.securitySection}>
      <div className={securityStyles.securitySectionTitle}>
        <h2 className={securityStyles.securitySectionTitleText}>{t('API Key')}</h2>
      </div>

      <div className={cx(securityStyles.securitySectionBody, styles.body)}>
        <TextBox
          type={isVisible && !isFetching && token !== null ? 'text' : 'password'}
          value={token !== null ? token : HIDDEN_TOKEN_VALUE}
          readOnly
          className={styles.token}
        />
      </div>

      <div className={styles.options}>
        <Button label={t('Regenerate key')} size='m' type='text' onClick={regenerateModal.open} />

        <Button label={t('Display')} size='m' type='primary' onClick={toggleTokenVisibility} />
      </div>

      <ModalNew
        opened={isRegenerateModalOpen}
        onClose={regenerateModal.close}
        title={t('Regenerate API key')}
        size='md'
      >
        <Stack>
          <Text>
            {t('All access through your existing API key will be revoked, and a new one will be generated randomly.')}
          </Text>

          <Group justify='flex-end'>
            <ButtonNew size='md' onClick={regenerateModal.close} variant='light' disabled={isRegenerating}>
              {t('Cancel')}
            </ButtonNew>

            <ButtonNew size='md' onClick={regenerateToken} variant='danger' loading={isRegenerating}>
              {t('Regenerate')}
            </ButtonNew>
          </Group>
        </Stack>
      </ModalNew>
    </section>
  )
}
