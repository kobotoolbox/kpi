import sessionStore from './session';
import {useEffect, useState} from 'react';
import {reaction} from 'mobx';
import type {AccountResponse} from '../dataInterface';

/**
 * Hook to use the session store in functional components.
 * This hook provides a way to access teh current logged account, information
 * regarding the anonymous state of the login and session methods.
 *
 * This hook uses MobX reactions to track the current account and update the
 * state accordingly.
 * In the future we should update this hook to use react-query and drop the usage of mob-x
 */
export const useSession = () => {
  const [currentLoggedAccount, setCurrentLoggedAccount] =
    useState<AccountResponse>();
  const [isAnonymous, setIsAnonymous] = useState<boolean>(true);
  const [isPending, setIsPending] = useState<boolean>(false);

  useEffect(() => {
    // We need to setup a reaction for every observable we want to track
    // Generic reaction to sessionStore won't fire the re-rendering of the hook
    const currentAccountReactionDisposer = reaction(
      () => sessionStore.currentAccount,
      (currentAccount) => {
        if (sessionStore.isLoggedIn) {
          setCurrentLoggedAccount(currentAccount as AccountResponse);
          setIsAnonymous(false);
          setIsPending(sessionStore.isPending);
        }
      },
      {fireImmediately: true}
    );

    const isPendingReactionDisposer = reaction(
      () => sessionStore.isPending,
      () => {
          setIsPending(sessionStore.isPending);
      },
      {fireImmediately: true}
    );

    return () => {
      currentAccountReactionDisposer();
      isPendingReactionDisposer();
    };
  }, []);

  return {
    currentLoggedAccount,
    isAnonymous,
    isPending,
    logOut: sessionStore.logOut.bind(sessionStore),
    logOutAll: sessionStore.logOutAll.bind(sessionStore),
    refreshAccount: sessionStore.refreshAccount.bind(sessionStore),
  };
};
