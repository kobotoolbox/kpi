import React, { useState, useEffect, useRef } from 'react'

import { Group, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import cx from 'classnames'
import securityStyles from '#/account/security/securityRoute.module.scss'
import ButtonNew from '#/components/common/ButtonNew'
import ModalNew from '#/components/common/ModalNew'
import PasswordInput from '#/components/common/PasswordInput'
import { dataInterface } from '#/dataInterface'
import { notify } from '#/utils'
import styles from './apiTokenSection.module.scss'

const HIDDEN_TOKEN_VALUE = '*'.repeat(40)

/**
 * Displays secret API token of a logged in user.
 * The token is obfuscated until the input's visibility toggle is clicked.
 */
export default function ApiTokenDisplay() {
  const [token, setToken] = useState(null)
  const [isFetching, setIsFetching] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isRegenerateModalOpen, regenerateModal] = useDisclosure(false)
  const [isRegenerating, setIsRegenerating] = useState(false)

  // The token is fetched lazily, so stay masked until it has actually arrived —
  // otherwise revealing it would just show the placeholder asterisks.
  const isTokenVisible = isVisible && !isFetching && token !== null

  // Regenerating bumps this. A fetch that started before the bump is holding a
  // revoked token, so it must not report it — or report its failure, which by
  // then says nothing about the key on screen.
  const tokenGeneration = useRef(0)

  useEffect(() => {
    if (isVisible && token === null) {
      const fetchToken = async () => {
        const generation = tokenGeneration.current
        setIsFetching(true)
        try {
          const result = await dataInterface.apiToken()
          if (tokenGeneration.current !== generation) return
          setToken(result.token)
        } catch {
          if (tokenGeneration.current !== generation) return
          notify.error(t('Failed to get API token'))
          // Reset, so that toggling visibility again retries the fetch
          setIsVisible(false)
        } finally {
          setIsFetching(false)
        }
      }

      fetchToken()
    }
  }, [isVisible])

  const regenerateToken = async () => {
    setIsRegenerating(true)
    tokenGeneration.current += 1
    // Clear any displayed token up front so a now-stale value is never shown
    setToken(null)
    try {
      // The true test of success is whether a new (i.e. different) token was
      // generated and returned by the API
      const before = await dataInterface.apiToken()
      await dataInterface.deleteApiToken()
      const after = await dataInterface.apiToken()
      if (after.token === before.token) {
        throw new Error('API key was not rotated')
      }
      setToken(after.token)
      notify(t('API key regenerated successfully'))
      regenerateModal.close()
    } catch {
      notify.error(t('Failed to regenerate API key'))
      // Handle the case where the token had already been revealed before
      // attempting (and failing) to regenerate it
      setIsVisible(false)
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
        <PasswordInput
          value={token !== null ? token : HIDDEN_TOKEN_VALUE}
          visible={isTokenVisible}
          onVisibilityChange={setIsVisible}
          // Mantine hides the visibility toggle from assistive tech and from
          // the tab order, assuming a password is typed rather than read. Here
          // it is the only way to reveal the key, so it has to be reachable.
          visibilityToggleButtonProps={{
            'aria-label': isTokenVisible ? t('Hide API key') : t('Display API key'),
            tabIndex: 0,
            // Nothing to reveal mid-rotation, and it keeps a second fetch from
            // racing the one the rotation itself is doing.
            disabled: isRegenerating,
          }}
          readOnly
          w='100%'
          className={styles.token}
        />
      </div>

      <div className={styles.options}>
        <ButtonNew onClick={regenerateModal.open} variant='transparent'>
          {t('Regenerate key')}
        </ButtonNew>
      </div>

      <ModalNew
        opened={isRegenerateModalOpen}
        onClose={regenerateModal.close}
        title={t('Regenerate API key')}
        size='md'
      >
        <Stack>
          <Text>
            {t('All access through your existing API key will be revoked, and a new key will be generated randomly.')}
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
