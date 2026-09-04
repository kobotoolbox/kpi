import { useEffect, useState } from 'react'

import { reaction } from 'mobx'
import type { AccountResponse } from '../dataInterface'
import profileStore from './profile'

/**
 * Hook to use the profile store in functional components.
 * This hook provides a way to access the current logged account, information
 * regarding the pending state, and profile methods.
 *
 * This hook uses MobX reactions to track the current account and update the
 * state accordingly.
 * In the future we should update this hook to use react-query and drop the usage of mob-x
 */
export const useProfile = () => {
  const [currentLoggedAccount, setCurrentLoggedAccount] = useState<AccountResponse>(
    profileStore.currentAccount as AccountResponse,
  )
  const [isPending, setIsPending] = useState<boolean>(false)

  useEffect(() => {
    // We need to setup a reaction for every observable we want to track
    // Generic reaction to profileStore won't fire the re-rendering of the hook
    const currentAccountReactionDisposer = reaction(
      () => profileStore.currentAccount,
      (currentAccount) => {
        if (profileStore.isLoggedIn) {
          setCurrentLoggedAccount(currentAccount as AccountResponse)
          setIsPending(profileStore.isPending)
        }
      },
      { fireImmediately: true },
    )

    const isPendingReactionDisposer = reaction(
      () => profileStore.isPending,
      () => {
        setIsPending(profileStore.isPending)
      },
      { fireImmediately: true },
    )

    return () => {
      currentAccountReactionDisposer()
      isPendingReactionDisposer()
    }
  }, [])

  return {
    currentLoggedAccount,
    isPending,
    refreshAccount: profileStore.refreshAccount.bind(profileStore),
  }
}
