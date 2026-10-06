import { observer } from 'mobx-react-lite'
import { getProfileFieldsValues } from '#/account/account.utils'
import envStore from '#/envStore'
import profileStore from '#/stores/profile'
import ProfileDetailsScreen from './ProfileDetailsScreen'

export interface ProfileDetailsBlockerProps {
  isMmoMember: boolean
}

/**
 * Route blocker for the required profile details this instance asks for and the account has left blank. See
 * {@link useProfileDetailsBlockerState}, which decides who gets it.
 */
function ProfileDetailsBlocker({ isMmoMember }: ProfileDetailsBlockerProps) {
  const account = profileStore.currentAccount

  // Cannot happen - being blocked means being logged in - but it is what narrows `currentAccount` from its
  // anonymous placeholder to an account.
  if (!('email' in account)) {
    return null
  }

  return (
    <ProfileDetailsScreen
      initialValues={getProfileFieldsValues(account.extra_details)}
      fieldsContext={{
        configuredFieldNames: envStore.data.getUserMetadataFieldNames(),
        requiredFieldNames: envStore.data.getUserMetadataRequiredFieldNames(),
        isMmoMember,
      }}
      // The same forced reload the other two route blockers do. `profileStore.refreshAccount()` would
      // flip this screen without one, but it reports neither success nor failure, so a refresh that
      // quietly failed would leave this screen up with nothing to explain it.
      onSaved={() => window.location.reload()}
    />
  )
}

// The fields to fill in come from `/environment` and the values from the session, and both can land after
// the first render.
export default observer(ProfileDetailsBlocker)
