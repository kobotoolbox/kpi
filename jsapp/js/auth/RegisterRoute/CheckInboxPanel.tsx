import { Image, Stack, Text, Title } from '@mantine/core'
import ResendVerificationLink from '#/auth/ResendVerificationLink'
import { replaceSupportEmail } from '#/textUtils'
import emailEnvelopeIllustration from '../../../img/email-envelope-illustration.svg'
import { maskEmail } from './maskEmail'

export interface CheckInboxPanelProps {
  /** The address the verification link went to. Masked before it is shown */
  email: string
}

/**
 * What the registration card shows once the account exists: which address to look in, and one button to
 * send the link again.
 */
export default function CheckInboxPanel({ email }: CheckInboxPanelProps) {
  return (
    <Stack gap='md' ta='center'>
      <Image src={emailEnvelopeIllustration} alt='' maw={190} mx='auto' />

      <Title order={1} size='h3'>
        {t('Confirm your email address')}
      </Title>

      <Stack gap='xxs'>
        <Text>{t('We sent you a verification link to the email on record for this account:')}</Text>
        <Text fw={500}>{maskEmail(email)}</Text>
      </Stack>

      <Text>
        {replaceSupportEmail(
          t(
            "Be sure to check your spam folder if you don't see it within a few minutes. If you have any issues, reach out to us at help@kobotoolbox.org",
          ),
        )}
      </Text>

      <ResendVerificationLink label={t('Request new link')} email={email} />
    </Stack>
  )
}
