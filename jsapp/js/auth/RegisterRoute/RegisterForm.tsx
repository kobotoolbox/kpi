import { Anchor, Checkbox, Stack, Text, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import type { MetadataField } from '#/api/models/metadataField'
import type { SignupBody } from '#/api/models/signupBody'
import type { SocialApp } from '#/api/models/socialApp'
import { useAllauthBrowserV1AuthSignupPost } from '#/api/react-query/authentication-allauth-headless'
import { withAuthFieldError } from '#/auth/AuthFieldError'
import { getGenericAllauthErrorMessage, isPendingEmailVerification, splitAllauthErrors } from '#/auth/allauthErrors'
import ButtonNew from '#/components/common/ButtonNew'
import PasswordInput from '#/components/common/PasswordInput'
import Select from '#/components/common/Select'
import TextInput from '#/components/common/TextInput'
import Alert from '#/components/common/alert'
import { PATHS } from '#/router/routerConstants'
import {
  EMPTY_SIGNUP_METADATA_VALUES,
  SIGNUP_METADATA_FIELD_NAMES,
  type SignupMetadataFieldName,
  type SignupMetadataValues,
  getMetadataFieldOptions,
  getSignupMetadataFields,
  isMetadataFieldRequired,
  isMetadataFieldShown,
} from './registerMetadataFields'
import {
  getMetadataValidators,
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
  validateTermsOfService,
  validateUsername,
} from './registerValidation'

interface RegisterFormValues {
  email: string
  username: string
  password: string
  passwordConfirm: string
  termsOfService: boolean
  /** Instance configuration from `USER_METADATA_FIELDS`, so both the payload and a field error map correctly */
  metadata: SignupMetadataValues
}

/**
 * The form field names allauth may name in an error's `param`. The rest of our fields have no
 * counterpart on the endpoint, so an error can never point at them.
 */
const SERVER_KNOWN_FIELDS: ReadonlyArray<keyof RegisterFormValues> = ['email', 'username', 'password']

/**
 * The configured fields that get their own block, below the credentials. `name` sits with the identity
 * fields at the top and `newsletter_subscription` with the legal checkbox, so those two are placed by hand.
 */
const EXTRA_METADATA_FIELD_NAMES: SignupMetadataFieldName[] = SIGNUP_METADATA_FIELD_NAMES.filter(
  (name) => name !== 'name' && name !== 'newsletter_subscription',
)

/** Only for the fields that render as text inputs */
const METADATA_AUTOCOMPLETE: Partial<Record<SignupMetadataFieldName, string>> = {
  organization: 'organization',
  organization_website: 'url',
}

/** Turns every `[...]` marker into a link, taking the URLs in the order they are given. */
function withLegalLinks(sentence: string, urls: string[]) {
  // Splitting on a capturing group alternates plain text and bracketed label, so the labels are the odd
  // entries and take one URL each.
  return sentence.split(/\[([^\]]+)\]/).map((part, index) =>
    index % 2 ? (
      <Anchor key={part} href={urls[Math.floor(index / 2)]} target='_blank' rel='noopener noreferrer' inherit>
        {part}
      </Anchor>
    ) : (
      part
    ),
  )
}

/**
 * The label for the Terms of Service checkbox, or `null` when the server configures neither - if nothing to agree
 * we don't display the checkbox.
 */
function legalSentence(termsOfServiceUrl: string | null | undefined, privacyPolicyUrl: string | null | undefined) {
  if (termsOfServiceUrl && privacyPolicyUrl) {
    return withLegalLinks(t('I agree with the [Terms of Service] and [Privacy Policy]'), [
      termsOfServiceUrl,
      privacyPolicyUrl,
    ])
  }
  if (termsOfServiceUrl) {
    return withLegalLinks(t('I agree with the [Terms of Service]'), [termsOfServiceUrl])
  }
  if (privacyPolicyUrl) {
    return withLegalLinks(t('I agree with the [Privacy Policy]'), [privacyPolicyUrl])
  }
  return null
}

export interface RegisterFormProps {
  /** From `/api/v2/environment/`. Used to spot an email domain that has to sign in through SSO. */
  socialApps: SocialApp[] | undefined
  userMetadataFields: MetadataField[] | undefined
  sectorChoices: string[][] | undefined
  countryChoices: string[][] | undefined
  termsOfServiceUrl: string | null | undefined
  privacyPolicyUrl: string | null | undefined
  /** Blocks submitting until `/environment` loads */
  isConfigurationPending: boolean
  /** Called with the submitted address once the account exists and the activation email is on its way. */
  onVerificationPending: (email: string) => void
  /** Called instead when the account came back signed in, so there is no address to confirm. */
  onSignedIn: () => void
}

export default function RegisterForm({
  socialApps,
  userMetadataFields,
  sectorChoices,
  countryChoices,
  termsOfServiceUrl,
  privacyPolicyUrl,
  isConfigurationPending,
  onVerificationPending,
  onSignedIn,
}: RegisterFormProps) {
  const legalLabel = legalSentence(termsOfServiceUrl, privacyPolicyUrl)
  const metadataFields = getSignupMetadataFields(userMetadataFields)

  const form = useForm<RegisterFormValues>({
    // Controlled, not Mantine's recommended uncontrolled mode: the organization dropdown decides whether
    // two other inputs are on screen, and an uncontrolled form does not re-render as values change.
    mode: 'controlled',
    initialValues: {
      email: '',
      username: '',
      password: '',
      passwordConfirm: '',
      termsOfService: false,
      metadata: { ...EMPTY_SIGNUP_METADATA_VALUES },
    },
    validate: {
      email: (value) => validateEmail(value, socialApps),
      username: validateUsername,
      password: validatePassword,
      passwordConfirm: (value, values) => validatePasswordConfirm(value, values.password),
      // No checkbox to tick when there is no legal document, so nothing to require. Mantine reads these
      // rules fresh on every render, so this follows the label once `/environment` lands.
      termsOfService: legalLabel ? validateTermsOfService : undefined,
      metadata: getMetadataValidators(metadataFields),
    },
  })

  const metadataValues = form.getValues().metadata
  const isFieldShown = (name: SignupMetadataFieldName) => isMetadataFieldShown(name, metadataFields, metadataValues)
  const isFieldRequired = (name: SignupMetadataFieldName) =>
    isMetadataFieldRequired(name, metadataFields, metadataValues)

  // Errors that belong to no single input, shown in a banner above the form.
  const [formErrors, setFormErrors] = useState<string[]>([])

  const signup = useAllauthBrowserV1AuthSignupPost({
    mutation: {
      // Rejections land here too, not in `onError`: allauth signals with status codes, so `fetchAllauth`
      // hands back every answer below 500 as data for us to read.
      onSuccess: (response, variables) => {
        // A 200 only happens where a deployment sets `ACCOUNT_EMAIL_VERIFICATION` to `none` or
        // `optional`: allauth signs the new account in and answers with the session, so asking for a
        // confirmation nobody sent would strand someone who is already in.
        if (response.status === 200 && response.data.meta.is_authenticated) {
          onSignedIn()
          return
        }
        // With verification mandatory (the KPI default) the success is a 401 with a pending
        // `verify_email` flow.
        if (isPendingEmailVerification(response)) {
          onVerificationPending(variables.data.email)
          return
        }
        const { fieldErrors, formErrors: bannerErrors } = splitAllauthErrors(response, SERVER_KNOWN_FIELDS)
        form.setErrors(fieldErrors)
        setFormErrors(bannerErrors)
      },
      // Only a 5xx or a dead connection gets this far. Handling it here rather than leaving it to the
      // global toast keeps the message next to the button that just failed.
      onError: () => setFormErrors([getGenericAllauthErrorMessage()]),
    },
  })

  const handleSubmit = (values: RegisterFormValues) => {
    // The button below is disabled while we wait, but better be safe and check here too
    if (isConfigurationPending) {
      return
    }

    setFormErrors([])

    // Only what this instance asks for, so a skipped organization field is left out rather than sent blank.
    const metadata = Object.fromEntries(
      SIGNUP_METADATA_FIELD_NAMES.filter((name) => isFieldShown(name)).map((name) => {
        const value = values.metadata[name]
        return [name, typeof value === 'string' ? value.trim() : value]
      }),
    )

    // TODO: the headless signup endpoint only reads `{email, username, password}` - allauth's `SignupInput`
    // never runs our `SignupForm`, so everything below it is accepted and quietly dropped, and the
    // generated `SignupBody` has no room for it either. The cast goes with that fix, in DEV-2807.
    const body = {
      email: values.email.trim(),
      username: values.username.trim(),
      password: values.password,
      terms_of_service: values.termsOfService,
      ...metadata,
    } as SignupBody

    signup.mutate({ data: body })
  }

  /** A configured field, as a dropdown where the backend gives it choices and a text input otherwise. */
  function renderExtraField(name: SignupMetadataFieldName) {
    const field = metadataFields[name]
    if (!field || !isFieldShown(name)) {
      return null
    }

    const inputProps = withAuthFieldError(form.getInputProps(`metadata.${name}`))
    const options = getMetadataFieldOptions(name, { sectorChoices, countryChoices })

    if (options) {
      return (
        <Select
          key={name}
          label={field.label}
          data={options}
          searchable
          // Clearing a required field would only leave it invalid.
          clearable={!isFieldRequired(name)}
          {...inputProps}
          // After the spread, so it wins: clearing hands back `null`, and both the form values and the
          // payload want a blank string.
          onChange={(value) => form.setFieldValue(`metadata.${name}`, value ?? '')}
          required={isFieldRequired(name)}
        />
      )
    }

    return (
      <TextInput
        key={name}
        label={field.label}
        autoComplete={METADATA_AUTOCOMPLETE[name]}
        {...inputProps}
        required={isFieldRequired(name)}
      />
    )
  }

  return (
    <Stack gap='xl'>
      <Title order={1} size='h3'>
        {t('Create an account')}
      </Title>

      {formErrors.length > 0 && (
        <Alert type='error' iconName='alert'>
          <Stack gap='xxs'>
            {formErrors.map((message) => (
              <Text key={message} inherit>
                {message}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      {/* `noValidate` because we want to validate email ourselves */}
      <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
        <Stack gap='xl'>
          <Stack gap='sm'>
            {isFieldShown('name') && (
              <TextInput
                label={metadataFields.name?.label}
                autoComplete='name'
                {...withAuthFieldError(form.getInputProps('metadata.name'))}
                required={isFieldRequired('name')}
              />
            )}
            <TextInput
              label={t('Email')}
              type='email'
              autoComplete='email'
              {...withAuthFieldError(form.getInputProps('email'))}
              required
            />
            <TextInput
              label={t('Username')}
              autoComplete='username'
              {...withAuthFieldError(form.getInputProps('username'))}
              required
            />
            <PasswordInput
              label={t('Password')}
              autoComplete='new-password'
              {...withAuthFieldError(form.getInputProps('password'))}
              required
            />
            <PasswordInput
              label={t('Confirm password')}
              autoComplete='new-password'
              {...withAuthFieldError(form.getInputProps('passwordConfirm'))}
              required
            />
            {EXTRA_METADATA_FIELD_NAMES.map(renderExtraField)}
          </Stack>

          <Stack gap='sm'>
            {isFieldShown('newsletter_subscription') && (
              <Checkbox
                label={metadataFields.newsletter_subscription?.label}
                {...withAuthFieldError(form.getInputProps('metadata.newsletter_subscription', { type: 'checkbox' }))}
              />
            )}
            {legalLabel && (
              <Checkbox
                label={legalLabel}
                {...withAuthFieldError(form.getInputProps('termsOfService', { type: 'checkbox' }))}
              />
            )}
          </Stack>

          <ButtonNew type='submit' size='lg' fullWidth loading={isConfigurationPending || signup.isPending}>
            {t('Continue')}
          </ButtonNew>
        </Stack>
      </form>

      <Text size='sm' ta='center'>
        {t('Already have an account?')}&nbsp;
        <Anchor href={PATHS.LOGIN} inherit>
          {t('Log in')}
        </Anchor>
      </Text>
    </Stack>
  )
}
