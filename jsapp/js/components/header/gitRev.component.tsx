import React from 'react';
import sessionStore from 'js/stores/session';
import bem, {makeBem} from 'js/bem';

bem.GitRev = makeBem(null, 'git-rev');
bem.GitRev__item = makeBem(bem.GitRev, 'item', 'div');

/**
 * Displays some git related information in the UI corner, useful for debugging
 * things.
 */
export default function GitRev() {
  if (
    'git_rev' in sessionStore.currentAccount &&
    sessionStore.currentAccount.git_rev.branch &&
    sessionStore.currentAccount.git_rev.short
  ) {
    return (
      <bem.GitRev>
        <bem.GitRev__item>
          branch: {sessionStore.currentAccount.git_rev.branch}
        </bem.GitRev__item>
        <bem.GitRev__item>
          commit: {sessionStore.currentAccount.git_rev.short}
        </bem.GitRev__item>
      </bem.GitRev>
    );
  }

  return null;
}
