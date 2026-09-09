import { Box, Image, Stack, Text, Title } from '@mantine/core'
import DocumentTitle from 'react-document-title'
import { useParams } from 'react-router-dom'
import {
  getAllauthBrowserV1AuthEmailVerifyGetQueryKey,
  useAllauthBrowserV1AuthEmailVerifyGet,
  useAllauthBrowserV1AuthEmailVerifyPost,
} from '#/api/react-query/authentication-allauth-headless'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import ButtonNew from '#/components/common/ButtonNew'
import { PATHS } from '#/router/routerConstants'
import emailEnvelopeIllustration from '../../../img/email-envelope-illustration.svg'

/**
 * The address is confirmed. Whether that also signed the account in is up to
 * `ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION`, and it decides where we send people next.
 */
function ConfirmedPanel({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <Stack gap='lg'>
      <Image src={emailEnvelopeIllustration} alt='' maw={190} mx='auto' />

      <Title order={1} size='h3'>
        {t('Email address confirmed')}
      </Title>
      {isSignedIn ? (
        <>
          <Text>{t('Your account is active. You are signed in and ready to go.')}</Text>
          {/* A plain link, not a router one: leaving `/auth` means loading the logged in app. */}
          <ButtonNew component='a' href='/' size='lg' fullWidth>
            {t('Continue to KoboToolbox')}
          </ButtonNew>
        </>
      ) : (
        <>
          <Text>{t('Your account is active. Please log in to get started.')}</Text>
          <ButtonNew component='a' href={PATHS.LOGIN} size='lg' fullWidth>
            {t('Log in')}
          </ButtonNew>
        </>
      )}
    </Stack>
  )
}

/** Missing, expired or already used key - the server does not tell us which, so neither do we. */
function ActivationFailedPanel() {
  return (
    <Stack gap='lg' ta='center'>
      <Title order={1} size='h3'>
        {t('Activation Failed')}
      </Title>
      {/* TODO: a dead end for now - offer a new confirmation email here DEV-2295 */}
      <Text>{t('This activation link is no longer valid.')}</Text>
    </Stack>
  )
}

interface LinkCheckErrorPanelProps {
  onRetry: () => void
  isRetrying: boolean
}

/**
 * The lookup failed on a 5xx or a dead connection, which says nothing about the key itself - so this offers another
 * attempt rather than saying the link is invalid (which might be invalid in itself).
 */
function LinkCheckErrorPanel({ onRetry, isRetrying }: LinkCheckErrorPanelProps) {
  return (
    <Stack gap='lg' ta='center'>
      <Title order={1} size='h3'>
        {t('Something went wrong')}
      </Title>
      {/* Deliberately generic, as there will probably be a toast with better server message */}
      <Text>{t('We could not check your activation link. Please check your connection and try again.')}</Text>
      <ButtonNew size='lg' fullWidth loading={isRetrying} onClick={onRetry}>
        {t('Retry')}
      </ButtonNew>
    </Stack>
  )
}

/** Waiting on the key lookup, which is the first thing this screen does. */
function CheckingLinkPanel() {
  return (
    <Stack gap='lg'>
      <Title order={1} size='h3'>
        {t('Confirm E-mail Address')}
      </Title>
      <Text>{t('Checking your activation link…')}</Text>
    </Stack>
  )
}

interface ConfirmPromptPanelProps {
  email: string
  /** allauth's `user_display()` value, the same one its Django template shows. */
  displayName: string
  isConfirming: boolean
  onConfirm: () => void
}

/** A key that checks out. Nothing is activated until the button is clicked. */
function ConfirmPromptPanel({ email, displayName, isConfirming, onConfirm }: ConfirmPromptPanelProps) {
  // Split rather than replaced, because the username is emphasised: a `<strong>` substituted into the
  // string would show up as literal tags. The default covers a translation that drops the placeholder.
  const [beforeUsername, afterUsername = ''] = t(
    'Please confirm that ##email## is an e-mail address for user ##username##',
  )
    .replace('##email##', () => email)
    .split('##username##')

  return (
    <Stack gap='lg'>
      <Title order={1} size='h3'>
        {t('Confirm E-mail Address')}
      </Title>
      <Text>
        {beforeUsername}
        <Text span fw={700} inherit>
          {displayName}
        </Text>
        {afterUsername}
      </Text>
      <ButtonNew size='lg' fullWidth loading={isConfirming} onClick={onConfirm}>
        {t('Confirm')}
      </ButtonNew>
    </Stack>
  )
}

/**
 * Where the activation link in the sign up email lands: confirms the address, or explains that the link
 * is no good.
 */
export default function ActivateAccountRoute() {
  const { key = '' } = useParams<{ key: string }>()

  // Using key ensures this is all remounted and starting fresh. Avoids problem of seeing previous changes if user revisits with different activation key without page load.
  return <ActivateAccountPanels key={key} activationKey={key} />
}

function ActivateAccountPanels({ activationKey }: { activationKey: string }) {
  const verification = useAllauthBrowserV1AuthEmailVerifyGet({
    // allauth takes the verification key in this header, not in the URL.
    request: { headers: { 'X-Email-Verification-Key': activationKey } },
    query: {
      // The generated query key ignores the header, so without the key two links would share an entry.
      queryKey: [...getAllauthBrowserV1AuthEmailVerifyGetQueryKey(), activationKey],
      enabled: Boolean(activationKey),
      retry: false,
      // A rejected key arrives as data, not as an error, so this is where "the key is no good" is decided:
      // `null` for anything but a 200.
      select: (response) => (response.status === 200 ? response.data.data : null),
    },
  })

  const confirm = useAllauthBrowserV1AuthEmailVerifyPost()

  // From allauth's docs: "a status code of 401 does not imply failure. It indicates that the email
  // verification was successful, yet, the user is still not signed in" - which is
  // `ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION` turned off. Either way the address is now confirmed.
  const confirmStatus = confirm.data?.status

  function renderPanel() {
    if (confirmStatus === 200 || confirmStatus === 401) {
      return <ConfirmedPanel isSignedIn={confirmStatus === 200} />
    }
    // `confirm.data` left over here is a rejection - a key that expired between the lookup and the click. A
    // confirm that hit a 5xx or a dead connection has no `data` at all, so the prompt stays up to try again.
    if (!activationKey || verification.data === null || confirm.data) {
      return <ActivationFailedPanel />
    }
    // The lookup failing is not the key failing, so this is a retry rather than the failure screen
    if (verification.isError && !verification.data) {
      return <LinkCheckErrorPanel onRetry={() => verification.refetch()} isRetrying={verification.isFetching} />
    }
    // `null` is handled above, so the only falsy value left is the one that means "still in flight".
    if (!verification.data) {
      return <CheckingLinkPanel />
    }
    return (
      <ConfirmPromptPanel
        email={verification.data.email}
        displayName={verification.data.user.display}
        isConfirming={confirm.isPending}
        onConfirm={() => confirm.mutate({ data: { key: activationKey } })}
      />
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
