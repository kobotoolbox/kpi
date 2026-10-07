import type { AccountFieldsConfig } from '#/account/account.constants'
import { getProfileFieldsValues } from '#/account/account.utils'
import { useProfile } from '#/stores/useProfile'
import ProfileDetailsScreen from './ProfileDetailsScreen'

export interface ProfileDetailsBlockerProps {
  isMmoMember: boolean
  fieldsConfig: AccountFieldsConfig
}

/**
 * Route blocker for the required profile details this instance asks for and the account has left blank. See
 * {@link useProfileDetailsBlockerState}, which decides who gets it.
 */
export default function ProfileDetailsBlocker({ isMmoMember, fieldsConfig }: ProfileDetailsBlockerProps) {
  const { currentLoggedAccount } = useProfile()

  // Cannot happen - being blocked means being signed in - but it is what narrows the anonymous placeholder
  // `useProfile` starts with, and types as an account, from an actual account.
  if (!currentLoggedAccount || !('email' in currentLoggedAccount)) {
    return null
  }

  return (
    <ProfileDetailsScreen
      initialValues={getProfileFieldsValues(currentLoggedAccount.extra_details)}
      fieldsConfig={fieldsConfig}
      isMmoMember={isMmoMember}
      // The same forced reload the other two route blockers do. `profileStore.refreshAccount()` would
      // flip this screen without one, but it reports neither success nor failure, so a refresh that
      // quietly failed would leave this screen up with nothing to explain it.
      onSaved={() => window.location.reload()}
    />
  )
}
