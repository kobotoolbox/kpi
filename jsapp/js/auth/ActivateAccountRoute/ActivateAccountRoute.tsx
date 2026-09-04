import { Box, Image, Stack, Text, Title } from '@mantine/core'
import DocumentTitle from 'react-document-title'
import { useParams } from 'react-router-dom'
import {
  getAllauthBrowserV1AuthEmailVerifyGetQueryKey,
  useAllauthBrowserV1AuthEmailVerifyGet,
  useAllauthBrowserV1AuthEmailVerifyPost,
} from '#/api/react-query/authentication-allauth-headless'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import ResendVerificationLink from '#/auth/ResendVerificationLink'
import { isVerifiedWithoutSession } from '#/auth/allauthErrors'
import ButtonNew from '#/components/common/ButtonNew'
import { PATHS } from '#/router/routerConstants'
import emailEnvelopeIllustration from '../../../img/email-envelope-illustration.svg'

/**
 * Where the activation link in the sign up email lands: confirms the address, or explains that the link
 * is no good.
 */
export default function ActivateAccountRoute() {
  const { key = '' } = useParams<{ key: string }>()

  const verification = useAllauthBrowserV1AuthEmailVerifyGet({
    // allauth takes the verification key in this header, not in the URL.
    request: { headers: { 'X-Email-Verification-Key': key } },
    query: {
      // The generated query key ignores the header, so without the key two links would share an entry.
      queryKey: [...getAllauthBrowserV1AuthEmailVerifyGetQueryKey(), key],
      enabled: Boolean(key),
      retry: false,
      select: (response) => (response.status === 200 ? response.data.data : null),
    },
  })

  const confirm = useAllauthBrowserV1AuthEmailVerifyPost({
    // Both outcomes are rendered right here, so keep the global error toast out of it.
    mutation: { onError: () => {} },
  })

  // A 401 on the confirmation is a success that leaves nobody signed in, so it gets its own ending.
  const isConfirmedWithoutSession = confirm.isError && isVerifiedWithoutSession(confirm.error)

  function renderPanel() {
    if (confirm.isSuccess || isConfirmedWithoutSession) {
      return (
        <Stack gap='lg'>
          <Image src={emailEnvelopeIllustration} alt='' maw={190} mx='auto' />

          <Title order={1} size='h3'>
            {t('Email address confirmed')}
          </Title>
          {isConfirmedWithoutSession ? (
            <>
              <Text>{t('Your account is active. Please log in to get started.')}</Text>
              <ButtonNew component='a' href={PATHS.LOGIN} size='lg' fullWidth>
                {t('Log in')}
              </ButtonNew>
            </>
          ) : (
            <>
              <Text>{t('Your account is active. You are signed in and ready to go.')}</Text>
              {/* A plain link, not a router one: leaving `/auth` means loading the logged in app. */}
              <ButtonNew component='a' href='/' size='lg' fullWidth>
                {t('Continue to KoboToolbox')}
              </ButtonNew>
            </>
          )}
        </Stack>
      )
    }

    // Must stay below the confirmed branch: a 401 confirmation is a success that is also `isError`.
    if (!key || verification.isError || confirm.isError) {
      return (
        <Stack gap='lg' ta='center'>
          <Title order={1} size='h3'>
            {t('Activation Failed')}
          </Title>
          <Text>
            {t(
              'This activation link is no longer valid. You can resend the activation link, or request a new one by entering your email address again.',
            )}
          </Text>
          <ResendVerificationLink label={t('Resend activation link')} />
        </Stack>
      )
    }

    if (!verification.data) {
      return (
        <Stack gap='lg'>
          <Title order={1} size='h3'>
            {t('Confirm E-mail Address')}
          </Title>
          <Text>{t('Checking your activation link…')}</Text>
        </Stack>
      )
    }

    // Split rather than replaced, because the username is emphasised: a `<strong>` substituted into the
    // string would show up as literal tags. The default covers a translation that drops the placeholder.
    const [beforeUsername, afterUsername = ''] = t(
      'Please confirm that ##email## is an e-mail address for user ##username##',
    )
      .replace('##email##', verification.data.email)
      .split('##username##')

    return (
      <Stack gap='lg'>
        <Title order={1} size='h3'>
          {t('Confirm E-mail Address')}
        </Title>
        <Text>
          {beforeUsername}
          {/* `display` comes from allauth's `user_display()`, same as the Django template. */}
          <Text span fw={700} inherit>
            {verification.data.user.display}
          </Text>
          {afterUsername}
        </Text>
        <ButtonNew size='lg' fullWidth loading={confirm.isPending} onClick={() => confirm.mutate({ data: { key } })}>
          {t('Confirm')}
        </ButtonNew>
      </Stack>
    )
  }

  return (
    <DocumentTitle title={`${t('Confirm E-mail Address')} | KoboToolbox`}>
      <AuthCard>
        <Box ta='center'>{renderPanel()}</Box>
      </AuthCard>
    </DocumentTitle>
  )
}
