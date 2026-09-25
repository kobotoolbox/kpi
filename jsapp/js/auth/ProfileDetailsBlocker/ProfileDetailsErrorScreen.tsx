import { Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import DocumentTitle from 'react-document-title'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import AuthPageFrame from '#/auth/AuthContainer/AuthPageFrame'
import { useLogout } from '#/auth/useLogout'
import ButtonNew from '#/components/common/ButtonNew'
import Alert from '#/components/common/alert'

export interface ProfileDetailsErrorScreenProps {
  /** Starts the whole check over. Reloading the page is what the app does, since nothing here is worth keeping. */
  onRetry: () => void
}

/**
 * What goes up when we cannot tell whether the profile details have to be filled in, because the organization request
 * failed - see {@link useProfileDetailsBlockerState}.
 */
export default function ProfileDetailsErrorScreen({ onRetry }: ProfileDetailsErrorScreenProps) {
  const logout = useLogout()
  const [logoutError, setLogoutError] = useState<string>()

  async function handleLogout() {
    setLogoutError(undefined)
    try {
      await logout.mutateAsync()
      window.location.replace('')
    } catch {
      // Only a 5xx or a dead connection gets here - `fetchAllauth` treats the 401 as the success it is.
      setLogoutError(t('Could not log you out. Please try again later.'))
    }
  }

  return (
    <DocumentTitle title={`${t('Complete your profile details')} | KoboToolbox`}>
      <AuthPageFrame>
        <AuthCard>
          <Stack gap='xl'>
            <Stack gap='xs'>
              <Title order={1} size='h3'>
                {t('Something went wrong')}
              </Title>
              <Text>
                {t('We could not check which details your profile still needs. Please try again in a moment.')}
              </Text>
            </Stack>

            {logoutError && (
              <Alert type='error' iconName='alert'>
                <Text inherit>{logoutError}</Text>
              </Alert>
            )}

            <Stack gap='xs'>
              <ButtonNew size='lg' fullWidth disabled={logout.isPending} onClick={onRetry}>
                {t('Try again')}
              </ButtonNew>
              <ButtonNew variant='transparent' size='lg' fullWidth loading={logout.isPending} onClick={handleLogout}>
                {t('Logout')}
              </ButtonNew>
            </Stack>
          </Stack>
        </AuthCard>
      </AuthPageFrame>
    </DocumentTitle>
  )
}
