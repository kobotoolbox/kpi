import { observer } from 'mobx-react-lite'
import type React from 'react'
import type { AccountFieldsValues } from '#/account/account.constants'
import { getProfileFieldsValues } from '#/account/account.utils'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import LoadingSpinner from '#/components/common/loadingSpinner'
import envStore from '#/envStore'
import { RequireOrg } from '#/router/RequireOrg'
import sessionStore from '#/stores/session'
import ProfileDetailsScreen from './ProfileDetailsScreen'
import type { ProfileFieldsContext } from './profileDetails.utils'
import { getBlankRequiredProfileFieldNames } from './profileDetails.utils'

interface ProfileDetailsInnerWithOrgProps {
  values: AccountFieldsValues
  /** As {@link ProfileDetailsBlocker} worked it out, with `isMmoMember` still to be filled in. */
  fieldsContext: ProfileFieldsContext
  children: React.ReactNode
}

/**
 * The half of the decision that needs the organization, so it has to sit below `RequireOrg`.
 *
 * The organization matters because its members are not allowed to write the organization fields (see
 * `MMO_MANAGED_FIELD_NAMES`), which means a blank required one is not theirs to fix and must not hold
 * them back.
 */
function ProfileDetailsInnerWithOrg({ values, fieldsContext, children }: ProfileDetailsInnerWithOrgProps) {
  const [organization] = useOrganizationAssumed()

  const contextWithOrganization: ProfileFieldsContext = {
    ...fieldsContext,
    isMmoMember: Boolean(organization.is_mmo),
  }

  if (getBlankRequiredProfileFieldNames(values, contextWithOrganization).length === 0) {
    return children
  }

  return (
    <ProfileDetailsScreen
      initialValues={values}
      fieldsContext={contextWithOrganization}
      // The same forced reload the other two route blockers do. `sessionStore.refreshAccount()` would
      // flip this screen without one, but it reports neither success nor failure, so a refresh that
      // quietly failed would leave this screen up with nothing to explain it.
      onSaved={() => window.location.reload()}
    />
  )
}

interface ProfileDetailsBlockerProps {
  /** The app. Rendered only once the profile has everything the instance requires. */
  children: React.ReactNode
}

/**
 * Route blocker for the missing required profile details. If any is missing, we block whole app (all routes).
 *
 * Where the other blockers short-circuit `App.render()` above the provider tree, this one wraps the app from the inside,
 * because it needs organization (`RequireOrg`) and user data. `TOSAgreement` therefore still wins when both apply,
 * which is the right order anyway: agree to the terms first, hand over the details second.
 */
function ProfileDetailsBlocker({ children }: ProfileDetailsBlockerProps) {
  const account = sessionStore.currentAccount

  // Which fields this instance wants is the whole input to the decision below, and nothing in the app works
  // without them anyway - so hold it back rather than render it and take it away a moment later. The session
  // needs no check of its own: `AllRoutes` already keeps the entire router behind `isAuthStateKnown`.
  if (!envStore.isReady) {
    return <LoadingSpinner />
  }

  // Nothing to complete for somebody who is not logged in. `email` rather than `isLoggedIn` alone, because
  // `currentAccount` is either an account or a `{message}` placeholder.
  if (!sessionStore.isLoggedIn || !('email' in account)) {
    return children
  }

  const values = getProfileFieldsValues(account.extra_details)
  const fieldsContext: ProfileFieldsContext = {
    configuredFieldNames: envStore.data.getUserMetadataFieldNames(),
    requiredFieldNames: envStore.data.getUserMetadataRequiredFieldNames(),
    // Not known yet - the organization is a request away, and this first pass exists to avoid making it.
    isMmoMember: false,
  }

  // Treating everyone as a lone user makes this the widest possible reading of "something is missing",
  // so an empty answer here is final and the app can start without waiting on the organization. Which is
  // the overwhelmingly common case: most people have their details filled in already.
  if (getBlankRequiredProfileFieldNames(values, fieldsContext).length === 0) {
    return children
  }

  return (
    <RequireOrg>
      <ProfileDetailsInnerWithOrg values={values} fieldsContext={fieldsContext}>
        {children}
      </ProfileDetailsInnerWithOrg>
    </RequireOrg>
  )
}

// `observer` is what gets us past the spinner: the first render happens before the session and
// `/environment` have landed, and this is what brings us back once they do.
export default observer(ProfileDetailsBlocker)
