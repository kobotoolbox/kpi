import { Stack, Text, Title } from '@mantine/core'
import DocumentTitle from 'react-document-title'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import AuthPageFrame from '#/auth/AuthContainer/AuthPageFrame'
import { useLogoutAndReload } from '#/auth/useLogout'
import ButtonNew from '#/components/common/ButtonNew'
import Alert from '#/components/common/alert'

export interface ProfileDetailsErrorScreenProps {
  /** Starts the whole check over. Reloading the page is what the app does, since nothing here is worth keeping. */
  onRetry: () => void
}

/**
 * What goes up when we cannot tell whether the profile details have to be filled in, because `/environment` or the
 * organization request failed - see {@link useProfileDetailsBlockerState}.
 */
export default function ProfileDetailsErrorScreen({ onRetry }: ProfileDetailsErrorScreenProps) {
  const logout = useLogoutAndReload()

  return (
    <DocumentTitle title={`${t('Complete your profile details')} | KoboToolbox`}>
      <AuthPageFrame>
        <AuthCard>
          <Stack gap='xl'>
            <Stack gap='xs'>
              <Title order={1} size='h3' ta='center'>
                {t('Something went wrong')}
              </Title>
              <Text>
                {t('We could not check which details your profile still needs. Please try again in a moment.')}
              </Text>
            </Stack>

            {logout.error && (
              <Alert type='error' iconName='alert'>
                <Text inherit>{logout.error}</Text>
              </Alert>
            )}

            <Stack gap='xs'>
              <ButtonNew size='lg' fullWidth disabled={logout.isPending} onClick={onRetry}>
                {t('Try again')}
              </ButtonNew>
              <ButtonNew variant='transparent' size='lg' fullWidth loading={logout.isPending} onClick={logout.logOut}>
                {t('Logout')}
              </ButtonNew>
            </Stack>
          </Stack>
        </AuthCard>
      </AuthPageFrame>
    </DocumentTitle>
  )
}
