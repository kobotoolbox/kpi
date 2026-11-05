import { Stack, Text, Title } from '@mantine/core'
import DocumentTitle from 'react-document-title'
import UpdatePasswordForm from '#/account/security/password/updatePasswordForm.component'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import AuthPageFrame from '#/auth/AuthContainer/AuthPageFrame'
import { useLogoutAndReload } from '#/auth/useLogout'
import ButtonNew from '#/components/common/ButtonNew'
import Alert from '#/components/common/alert'

/**
 * This is a route blocker component to be used for accounts marked by admin
 * as having insecure passwords. It is meant to be displayed for every possible
 * route - to block users from using the app befor taking action.
 */
export default function InvalidatedPassword() {
  const logout = useLogoutAndReload()

  return (
    <DocumentTitle title={`${t('Update password')} | KoboToolbox`}>
      <AuthPageFrame>
        <AuthCard>
          <Stack gap='xl'>
            <Stack gap='xs'>
              <Title order={1} size='h3' ta='center'>
                {t('Temporary Access Restriction: Password Update Required')}
              </Title>
              <Text>
                {t(
                  'You must update your password before proceeding. Please do so promptly to ensure the security of your data.',
                )}
              </Text>
            </Stack>

            {logout.error && (
              <Alert type='error' iconName='alert'>
                <Text inherit>{logout.error}</Text>
              </Alert>
            )}

            <UpdatePasswordForm onSuccess={() => window.location.reload()} />

            {/* The frame has no account menu, so this is the only way out. */}
            <ButtonNew variant='light' size='lg' fullWidth loading={logout.isPending} onClick={logout.logOut}>
              {t('Logout')}
            </ButtonNew>
          </Stack>
        </AuthCard>
      </AuthPageFrame>
    </DocumentTitle>
  )
}
