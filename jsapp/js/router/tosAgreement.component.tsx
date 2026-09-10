import React from 'react'

import { RequireOrg } from '#/router/RequireOrg'
import TOSForm from '#/tos/tosForm.component'
import BasicLayout from './basicLayout.component'
import styles from './tosAgreement.module.scss'

/**
 * This is a route blocker component to be used for accounts that have not
 * accepted the latest TOS. It is meant to be displayed for every possible
 * route - to block users from using the app befor taking action.
 */
export default function TOSAgreement() {
  return (
    <BasicLayout>
      <div className={styles.root}>
        {/* `TOSForm` reads the organization (to hide org fields from MMO
            members), so it must be a descendant of `RequireOrg`. */}
        <RequireOrg>
          <TOSForm />
        </RequireOrg>
      </div>
    </BasicLayout>
  )
}
