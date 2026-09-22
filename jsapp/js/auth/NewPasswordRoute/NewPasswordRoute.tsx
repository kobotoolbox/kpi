import { Image, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import DocumentTitle from 'react-document-title'
import { Link, useParams } from 'react-router-dom'
import {
  getAllauthBrowserV1AuthPasswordResetGetQueryKey,
  useAllauthBrowserV1AuthPasswordResetGet,
} from '#/api/react-query/authentication-allauth-headless'
import AuthAside, { shouldRenderAuthAside } from '#/auth/AuthContainer/AuthAside'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import { useAuthConfiguration } from '#/auth/AuthContainer/useAuthConfiguration'
import ButtonNew from '#/components/common/ButtonNew'
import { AUTH_ROUTES } from '#/router/routerConstants'
import emailEnvelopeIllustration from '../../../img/email-envelope-illustration.svg'
import NewPasswordForm, { type NewPasswordOutcome } from './NewPasswordForm'

/** The new password is in place */
function PasswordChangedPanel() {
  return (
    <Stack gap='md' ta='center'>
      <Image src={emailEnvelopeIllustration} alt='' maw={190} mx='auto' />

      <Title order={1} size='h3'>
        {t('Password has been successfully changed')}
      </Title>

      <ButtonNew component={Link} to={AUTH_ROUTES.LOGIN} size='lg' fullWidth>
        {t('Go back to Login')}
      </ButtonNew>
    </Stack>
  )
}

/** The same success on a server with `ACCOUNT_LOGIN_ON_PASSWORD_RESET` on: there is nothing left to log into */
function PasswordChangedAndSignedInPanel() {
  return (
    <Stack gap='md' ta='center'>
      <Image src={emailEnvelopeIllustration} alt='' maw={190} mx='auto' />

      <Title order={1} size='h3'>
        {t('Password has been successfully changed')}
      </Title>

      <Text>{t('You are signed in and ready to go')}</Text>

      {/* A plain link, not a router one: leaving `/auth` means loading the logged in app. */}
      <ButtonNew component='a' href='/' size='lg' fullWidth>
        {t('Continue to KoboToolbox')}
      </ButtonNew>
    </Stack>
  )
}

/** Missing, expired or already used key */
function ResetFailedPanel() {
  return (
    <Stack gap='md' ta='center'>
      <Title order={1} size='h3'>
        {t('Password reset failed')}
      </Title>

      <Text>{t('This password reset link is no longer valid. You can request a new one from the login screen.')}</Text>

      <ButtonNew component={Link} to={AUTH_ROUTES.LOGIN} size='lg' fullWidth>
        {t('Go back to Login')}
      </ButtonNew>
    </Stack>
  )
}

/** allauth refuses to reset a password from a link while a session is in place */
function AlreadyLoggedInPanel() {
  return (
    <Stack gap='md' ta='center'>
      <Title order={1} size='h3'>
        {t('You are already logged in')}
      </Title>
      <Text>{t('Log out first to reset your password from this link, or change it in your account settings.')}</Text>
      <ButtonNew component='a' href='/' size='lg' fullWidth>
        {t('Continue to KoboToolbox')}
      </ButtonNew>
    </Stack>
  )
}

interface LinkCheckErrorPanelProps {
  onRetry: () => void
  isRetrying: boolean
}

/** A 5xx or dead connection says nothing about the key, so this offers a retry rather than calling it dead */
function LinkCheckErrorPanel({ onRetry, isRetrying }: LinkCheckErrorPanelProps) {
  return (
    <Stack gap='md' ta='center'>
      <Title order={1} size='h3'>
        {t('Something went wrong')}
      </Title>
      <Text>{t('We could not check your password reset link. Please check your connection and try again.')}</Text>
      <ButtonNew size='lg' fullWidth loading={isRetrying} onClick={onRetry}>
        {t('Retry')}
      </ButtonNew>
    </Stack>
  )
}

/** Waiting on the key lookup, which is the first thing this screen does. */
function CheckingLinkPanel() {
  return (
    <Stack gap='md'>
      <Title order={1} size='h3'>
        {t('Create new password')}
      </Title>
      <Text>{t('Checking your password reset link…')}</Text>
    </Stack>
  )
}

/** Second half of password recovery: where the link in the reset email lands, to pick the new password */
export default function NewPasswordRoute() {
  const { key = '' } = useParams<{ key: string }>()
  // Remounting on the key keeps a second link from inheriting the first one's panel
  return <NewPasswordPanels key={key} resetKey={key} />
}

function NewPasswordPanels({ resetKey }: { resetKey: string }) {
  const { data } = useAuthConfiguration()
  const [outcome, setOutcome] = useState<NewPasswordOutcome | null>(null)

  const keyCheck = useAllauthBrowserV1AuthPasswordResetGet({
    // allauth takes the reset key in this header, not in the URL
    request: { headers: { 'X-Password-Reset-Key': resetKey } },
    query: {
      // The generated query key ignores the header, so without the key two links would share an entry
      queryKey: [...getAllauthBrowserV1AuthPasswordResetGetQueryKey(), resetKey],
      enabled: Boolean(resetKey),
      retry: false,
      // A rejected key arrives as data, not an error, so the verdict is reached here. 409 is about the session rather
      // than the key, and earns its own panel.
      select: (response) => (response.status === 409 ? 'conflict' : response.status === 200 ? 'valid' : 'invalid'),
    },
  })

  function renderCard() {
    if (outcome?.kind === 'changed') {
      return (
        <AuthCard>
          <PasswordChangedPanel />
        </AuthCard>
      )
    }
    if (outcome?.kind === 'changedAndSignedIn') {
      return (
        <AuthCard>
          <PasswordChangedAndSignedInPanel />
        </AuthCard>
      )
    }
    if (outcome?.kind === 'alreadyAuthenticated' || keyCheck.data === 'conflict') {
      return (
        <AuthCard>
          <AlreadyLoggedInPanel />
        </AuthCard>
      )
    }
    // A key that was refused up front, one that expired while the form sat open, or no key in the URL at all.
    if (!resetKey || keyCheck.data === 'invalid' || outcome?.kind === 'keyRejected') {
      return (
        <AuthCard>
          <ResetFailedPanel />
        </AuthCard>
      )
    }
    // The lookup failing is not the key failing, so this is a retry rather than the failure screen.
    if (keyCheck.isError && !keyCheck.data) {
      return (
        <AuthCard>
          <LinkCheckErrorPanel onRetry={() => keyCheck.refetch()} isRetrying={keyCheck.isFetching} />
        </AuthCard>
      )
    }
    // The supporting column goes on the states that still have the form ahead of them, so it does not
    // appear from nowhere once the key checks out. The endings above get the plain card.
    const aside = shouldRenderAuthAside(data?.authConfiguration) && (
      <AuthAside
        imageUrl={data?.authConfiguration.supporting_image_url}
        text={data?.authConfiguration.supporting_text}
      />
    )
    if (!keyCheck.data) {
      return (
        <AuthCard aside={aside}>
          <CheckingLinkPanel />
        </AuthCard>
      )
    }
    return (
      <AuthCard aside={aside}>
        <NewPasswordForm resetKey={resetKey} onOutcome={setOutcome} />
      </AuthCard>
    )
  }

  return <DocumentTitle title={`${t('Create new password')} | KoboToolbox`}>{renderCard()}</DocumentTitle>
}
