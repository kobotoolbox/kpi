import { Stack, Text, Title } from '@mantine/core'
import AuthCard from '#/auth/AuthContainer/AuthCard'

/**
 * TEMPORARY. Exists only so `#/auth/test` renders something and proves the container, its two themes
 * and the routing work. Delete it as soon as a real authentication screen lands (DEV-1848…1857).
 */
export default function AuthTestRoute() {
  return (
    <AuthCard>
      <Stack gap='md'>
        <Title order={1} size='h3'>
          {t('Authentication container')}
        </Title>
        <Text>{t('This placeholder screen exists to check the page frame. A real sign-in form will replace it.')}</Text>
      </Stack>
    </AuthCard>
  )
}
