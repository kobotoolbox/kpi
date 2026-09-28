import { Stack, Text, Title } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { AccountFieldsErrors, AccountFieldsValues, UserFieldName } from '#/account/account.constants'
import { getEditableProfileFieldNames } from '#/account/account.utils'
import AccountFieldsEditor from '#/account/accountFieldsEditor.component'
import { ServerError } from '#/api/ServerError'
import type { PatchedCurrentUser } from '#/api/models/patchedCurrentUser'
import type { OrvalFetchError } from '#/api/onErrorDefaultHandler'
import { getMeRetrieveQueryKey, useMePartialUpdate } from '#/api/react-query/user-team-organization-usage'
import { useLogout } from '#/auth/useLogout'
import ButtonNew from '#/components/common/ButtonNew'
import Alert from '#/components/common/alert'
import envStore from '#/envStore'
import type { ProfileFieldsContext } from './profileDetails.utils'
import {
  getBlankRequiredProfileFieldNames,
  getRequiredProfileFieldErrors,
  splitProfileUpdateErrors,
} from './profileDetails.utils'

type UserFieldValue = string | boolean

export interface ProfileDetailsFormProps {
  /** Values as `/me/` has them. Seeds the inputs, and tells us what actually changed. */
  initialValues: AccountFieldsValues
  /** What the instance asks for, and who is being asked. */
  fieldsContext: ProfileFieldsContext
  /**
   * Called once the details are saved. This form does not decide how the app gets un-blocked, which is
   * also what keeps it testable - the real caller reloads the page.
   */
  onSaved: () => void
}

/**
 * The form behind the profile details blocker: every field the instance configures, with the required
 * ones as the price of getting into the app.
 *
 * Field errors and general ones are both possible from the same response, so both are catered for - see
 * {@link splitProfileUpdateErrors}.
 */
export default function ProfileDetailsForm({ initialValues, fieldsContext, onSaved }: ProfileDetailsFormProps) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<AccountFieldsValues>(initialValues)
  // Only what was touched gets sent. A PATCH retains the keys it does not carry, so this both keeps the
  // request small and makes it impossible to overwrite a stored value the form could not represent (a
  // country code that is no longer in `country_choices`, say, which would render as an empty select).
  const [editedFields, setEditedFields] = useState<Partial<AccountFieldsValues>>({})
  const [fieldErrors, setFieldErrors] = useState<AccountFieldsErrors>({})
  /** Errors that belong to no single input, shown in a banner above the fields. */
  const [formErrors, setFormErrors] = useState<string[]>([])

  const logout = useLogout()

  const displayedFieldNames = getEditableProfileFieldNames(fieldsContext)

  /** The instance's own label for a field, for a message that cannot sit under the input. */
  const labelFor = (fieldName: UserFieldName) => envStore.data.getUserMetadataFieldLabel(fieldName)

  const save = useMePartialUpdate<OrvalFetchError>({
    mutation: {
      onSuccess: () => {
        // Anything already holding `/me/` in cache is now out of date, and the app is about to mount and
        // read it.
        queryClient.invalidateQueries({ queryKey: getMeRetrieveQueryKey() })
        onSaved()
      },
      // The default handler raises a toast saying `An error occurred`, which is no use next to a form
      // whose fields the server just complained about. Handled inline instead, as the policy asks.
      onError: (error) => {
        if (error instanceof ServerError) {
          const split = splitProfileUpdateErrors(error.parsedResponse, { displayedFieldNames, labelFor })
          setFieldErrors(split.fieldErrors)
          // A rejection we could not read a word out of (a 500 with an empty body) still needs saying.
          setFormErrors(
            split.formErrors.length > 0 || Object.keys(split.fieldErrors).length > 0
              ? split.formErrors
              : [t('Something went wrong. Please try again later.')],
          )
          return
        }
        // A dead connection or an aborted request: nothing about the form is wrong, so no field errors.
        setFieldErrors({})
        setFormErrors([t('Something went wrong. Please try again later.')])
      },
    },
  })

  const onFieldChange = (fieldName: UserFieldName, value: UserFieldValue) => {
    setValues((previous) => ({ ...previous, [fieldName]: value }))
    setEditedFields((previous) => ({ ...previous, [fieldName]: value }))
    // Typing is an answer to whatever the message said, so it stops applying.
    setFieldErrors((previous) => {
      if (!(fieldName in previous)) {
        return previous
      }
      const { [fieldName]: _cleared, ...rest } = previous
      return rest
    })
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    // Caught here rather than left to the server, because a PATCH that omits a blank required field is
    // accepted (an absent key keeps its old value and skips validation) - so submitting would look like
    // success and put this very screen straight back up.
    const blankFieldNames = getBlankRequiredProfileFieldNames(values, fieldsContext)
    if (blankFieldNames.length > 0) {
      const required = getRequiredProfileFieldErrors(blankFieldNames, { displayedFieldNames, labelFor })
      setFieldErrors(required.fieldErrors)
      setFormErrors(required.formErrors)
      return
    }

    setFieldErrors({})
    setFormErrors([])

    // TODO: the generated `PatchedCurrentUserExtraDetails` is wrong - `ExtraDetailField` in
    // `kpi/schema_extensions/v2/me/extensions.py` leaves `gender` out and types
    // `newsletter_subscription` as a string. The cast goes when DEV-2903 is fixed.
    const extraDetails = editedFields as PatchedCurrentUser['extra_details']
    save.mutate({ data: { extra_details: extraDetails } })
  }

  async function handleLogout() {
    try {
      await logout.mutateAsync()
      // Straight to the login screen, and no `next` to bring anyone back to a screen they just left.
      window.location.replace('')
    } catch {
      // Only a 5xx or a dead connection gets here - `fetchAllauth` treats the 401 as the success it is.
      // Said in the banner rather than left to the default toast, because being stuck on this screen with
      // no way out is the worst outcome it has.
      setFormErrors([t('Could not log you out. Please try again later.')])
    }
  }

  return (
    <Stack gap='xl'>
      <Stack gap='xs'>
        <Title order={1} size='h3'>
          {t('Complete your profile details')}
        </Title>
        <Text>
          {t(
            'Some details are missing from your profile. The fields marked as required have to be filled in before you can continue.',
          )}
        </Text>
      </Stack>

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

      {/* `noValidate` because the required-ness is the server's configuration, and the messages for it
          are ours - a native bubble would say something else, in a different language. */}
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap='xl'>
          <AccountFieldsEditor
            displayedFields={displayedFieldNames}
            errors={fieldErrors}
            values={values}
            onFieldChange={onFieldChange}
          />

          <Stack gap='xs'>
            {/* Each one waits for the other: a save landing mid-logout would reload the page and abandon the
                logout request, leaving the user signed in despite asking not to be. */}
            <ButtonNew
              type='submit'
              size='lg'
              fullWidth
              rightIcon='arrow-right'
              loading={save.isPending}
              disabled={logout.isPending}
            >
              {t('Continue')}
            </ButtonNew>
            <ButtonNew
              type='button'
              variant='transparent'
              size='lg'
              fullWidth
              onClick={handleLogout}
              loading={logout.isPending}
              disabled={save.isPending}
            >
              {t('Logout')}
            </ButtonNew>
          </Stack>
        </Stack>
      </form>
    </Stack>
  )
}
