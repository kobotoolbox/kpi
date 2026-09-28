import React, { useState, useEffect } from 'react'
import { Modal, Button, Checkbox, Text, Group, Stack, Anchor } from '@mantine/core'
import { observer } from 'mobx-react'
import sessionStore from '#/stores/session'

const WelcomeModal = observer(() => {
  const [opened, setOpened] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem('dataumsa_welcome_dismissed')
    if (sessionStore.isAuthStateKnown && sessionStore.isLoggedIn && !dismissed) {
      setOpened(true)
    }
  }, [sessionStore.isAuthStateKnown, sessionStore.isLoggedIn])

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('dataumsa_welcome_dismissed', 'true')
    }
    setOpened(false)
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={<Text size='lg' fw={700}>{t('Welcome to DATAUMSA!')}</Text>}
      centered
      size='md'
      overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
    >
      <Stack gap='md'>
        <Text size='sm'>
          {t('Discover all the tools and features we have prepared to help you manage your forms and collect data efficiently.')}
        </Text>
        
        <Text size='sm'>
          {t('To learn more about how the platform works and see step-by-step user guides, we recommend checking our official documentation:')}
        </Text>

        <Anchor href='https://data.umsa.bo/docs' target='_blank' rel='noopener noreferrer' underline='hover'>
          <Button fullWidth variant='light' color='blue' size='md'>
            {t('View Official Documentation')}
          </Button>
        </Anchor>

        <Group justify='space-between' mt='md'>
          <Checkbox
            label={t("Don't show this message again")}
            checked={dontShowAgain}
            onChange={(event) => setDontShowAgain(event.currentTarget.checked)}
          />
          <Button variant='filled' color='blue' onClick={handleClose}>
            {t('Start')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
})

export default WelcomeModal
