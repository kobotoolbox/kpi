import DocumentTitle from 'react-document-title'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import AuthPageFrame from '#/auth/AuthContainer/AuthPageFrame'
import TOSForm from '#/tos/tosForm.component'

/**
 * This is a route blocker component to be used for accounts that have not
 * accepted the latest TOS. It is meant to be displayed for every possible
 * route - to block users from using the app befor taking action.
 */
export default function TOSAgreement() {
  return (
    <DocumentTitle title={`${t('Terms of Service')} | KoboToolbox`}>
      <AuthPageFrame>
        <AuthCard>
          <TOSForm />
        </AuthCard>
      </AuthPageFrame>
    </DocumentTitle>
  )
}
