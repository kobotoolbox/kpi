import DocumentTitle from 'react-document-title'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import AuthPageFrame from '#/auth/AuthContainer/AuthPageFrame'
import ProfileDetailsForm from './ProfileDetailsForm'
import type { ProfileDetailsFormProps } from './ProfileDetailsForm'

/**
 * The "Complete your profile details" screen: {@link ProfileDetailsForm} in the frame the authentication
 * screens share.
 *
 * Exported on its own so Storybook can mount it without the store reading that {@link
 * ProfileDetailsBlocker} does.
 */
export default function ProfileDetailsScreen(props: ProfileDetailsFormProps) {
  return (
    <DocumentTitle title={`${t('Complete your profile details')} | KoboToolbox`}>
      <AuthPageFrame>
        <AuthCard>
          <ProfileDetailsForm {...props} />
        </AuthCard>
      </AuthPageFrame>
    </DocumentTitle>
  )
}
