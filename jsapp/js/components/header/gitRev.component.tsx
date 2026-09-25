import React from 'react'

import bem, { makeBem } from '#/bem'
import profileStore from '#/stores/profile'

bem.GitRev = makeBem(null, 'git-rev')
bem.GitRev__item = makeBem(bem.GitRev, 'item', 'div')

/**
 * Displays some git related information in the UI corner, useful for debugging
 * things.
 */
export default function GitRev() {
  if (
    'git_rev' in profileStore.currentAccount &&
    profileStore.currentAccount.git_rev !== false &&
    profileStore.currentAccount.git_rev.branch &&
    profileStore.currentAccount.git_rev.short
  ) {
    return (
      <bem.GitRev>
        <bem.GitRev__item>branch: {profileStore.currentAccount.git_rev.branch}</bem.GitRev__item>
        <bem.GitRev__item>commit: {profileStore.currentAccount.git_rev.short}</bem.GitRev__item>
      </bem.GitRev>
    )
  }

  return null
}
