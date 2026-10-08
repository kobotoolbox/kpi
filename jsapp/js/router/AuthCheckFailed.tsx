import { MantineProvider, Stack, Text, Title } from '@mantine/core'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '#/api/queryClient'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import AuthPageFrame from '#/auth/AuthContainer/AuthPageFrame'
import ButtonNew from '#/components/common/ButtonNew'
import { cssVariablesResolverKobo, themeKobo } from '#/theme'
import ToasterConfig from '#/toasterConfig'

/**
 * What the app puts up when `/me/` could not be read, so it cannot tell whether anybody is signed in. Both other
 * answers would be wrong here: a spinner never ends, and the login page throws out an account that is most likely
 * signed in just fine.
 *
 * It brings its own providers, because it renders above the router.
 */
export default function AuthCheckFailed() {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={themeKobo} cssVariablesResolver={cssVariablesResolverKobo}>
        <ToasterConfig />
        <AuthPageFrame>
          <AuthCard>
            <Stack gap='xl'>
              <Stack gap='xs'>
                <Title order={1} size='h3'>
                  {t('Could not check whether you are signed in')}
                </Title>
                <Text>
                  {t(
                    'Something went wrong while loading your account. Please try again, and let support know if this keeps happening.',
                  )}
                </Text>
              </Stack>

              <ButtonNew size='lg' fullWidth onClick={() => window.location.reload()}>
                {t('Try again')}
              </ButtonNew>
            </Stack>
          </AuthCard>
        </AuthPageFrame>
      </MantineProvider>
    </QueryClientProvider>
  )
}
