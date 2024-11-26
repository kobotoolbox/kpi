import sessionStore from './session';
import {useEffect, useState} from 'react';
import {reaction} from 'mobx';
import type {AccountResponse} from '../dataInterface';


export const useSession = () => {

  const [currentLoggedAccount, setCurrentLoggedAccount] = useState<AccountResponse>();
  const [isAnonymous, setIsAnonymous] = useState<boolean>(true);
  const [isPending, setIsPending] = useState<boolean>(false);

  useEffect(() => {
    // using mobx reaction in the hook (the reaction can be used anywhere)

    const reactionDisposer = reaction(
      // should pass the required store.
      // Could be done by DI, direct instance injection
      // or passing into hook from the parent component etc.
      () => sessionStore,
      (session) => {
        setIsPending(session.isPending);
        if (session.isLoggedIn) {
          setCurrentLoggedAccount(session.currentAccount as AccountResponse);
          setIsAnonymous(false);
        }
      }, {fireImmediately: true}
    );

    return () => {
      reactionDisposer();
    };
  }, []);

  return {
    currentLoggedAccount,
    isAnonymous,
    isPending,
    logOut: sessionStore.logOut,
    logOutAll: sessionStore.logOutAll,
    refreshAccount: sessionStore.refreshAccount,
  };

};
