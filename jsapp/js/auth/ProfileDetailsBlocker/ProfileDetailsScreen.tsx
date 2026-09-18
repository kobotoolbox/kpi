import DocumentTitle from 'react-document-title'
import AuthAside, { shouldRenderAuthAside } from '#/auth/AuthContainer/AuthAside'
import AuthCard from '#/auth/AuthContainer/AuthCard'
import AuthPageFrame from '#/auth/AuthContainer/AuthPageFrame'
import { useAuthConfiguration } from '#/auth/AuthContainer/useAuthConfiguration'
import ProfileDetailsForm from './ProfileDetailsForm'
import type { ProfileDetailsFormProps } from './ProfileDetailsForm'

/**
 * The "Complete your profile details" screen, in the same frame and card as the rest of the
 * authentication screens - it is the last step of getting in, even though it happens after the login.
 *
 * The card stays one column wide unless the server has configured supporting content, which gives the
 * fields the same width the registration form gets. They wrap to a single column at either width.
 *
 * Exported on its own so Storybook can mount it without the store reading that {@link
 * ProfileDetailsBlocker} does.
 */
export default function ProfileDetailsScreen(props: ProfileDetailsFormProps) {
  const { data } = useAuthConfiguration()

  return (
    <DocumentTitle title={`${t('Complete your profile details')} | KoboToolbox`}>
      <AuthPageFrame>
        <AuthCard
          aside={
            shouldRenderAuthAside(data?.authConfiguration) && (
              <AuthAside
                imageUrl={data?.authConfiguration.supporting_image_url}
                text={data?.authConfiguration.supporting_text}
              />
            )
          }
        >
          <ProfileDetailsForm {...props} />
        </AuthCard>
      </AuthPageFrame>
    </DocumentTitle>
  )
}
