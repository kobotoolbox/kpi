// Partial components
import LoadingSpinner from 'jsapp/js/components/common/loadingSpinner';
import OrganizationSettingsForm from './OrganizationSettingsForm';

// Stores, hooks and utilities
import {useSession} from 'jsapp/js/stores/useSession';
import {useOrganizationQuery} from 'js/account/organization/organizationQuery';

/**
 * Renders Organization Settings form and handles loading requirements.
 * Note: we keep this separate from OrganizationSettingsForm to ensure that
 * required `organizationUrl` is present.
 */
export default function OrganizationSettingsRoute() {
  const orgQuery = useOrganizationQuery();
  const session = useSession();
  const organizationUrl = session.currentLoggedAccount?.organization?.url;

  if (orgQuery.isLoading || !organizationUrl) {
    return <LoadingSpinner />;
  }
  return <OrganizationSettingsForm orgUrl={organizationUrl} />;
}
