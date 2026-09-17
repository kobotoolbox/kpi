import { observer } from 'mobx-react-lite'
import { getProfileFieldsValues } from '#/account/account.utils'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import envStore from '#/envStore'
import sessionStore from '#/stores/session'
import ProfileDetailsScreen from './ProfileDetailsScreen'

/**
 * Route blocker for the required profile details this instance asks for and the account has left blank. See
 * {@link useIsProfileDetailsBlockerActive}, which decides who gets it.
 *
 * `useOrganizationAssumed` usually wants `RequireOrg` above it. Here the same guarantee comes from that hook
 * instead: it only ever says yes once the organization request has come back.
 */
function ProfileDetailsBlocker() {
  const [organization] = useOrganizationAssumed()
  const account = sessionStore.currentAccount

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
        isMmoMember: Boolean(organization.is_mmo),
      }}
      // The same forced reload the other two route blockers do. `sessionStore.refreshAccount()` would
      // flip this screen without one, but it reports neither success nor failure, so a refresh that
      // quietly failed would leave this screen up with nothing to explain it.
      onSaved={() => window.location.reload()}
    />
  )
}

// The fields to fill in come from `/environment` and the values from the session, and both can land after
// the first render.
export default observer(ProfileDetailsBlocker)
