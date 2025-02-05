import {useLocation} from 'react-router-dom';
import OrgInviteModal from './OrgInviteModal';

/**
 * This is a wrapper for conditionally rendering the OrgInviteModal component. It simply looks for particular pair of
 * search parameters.
 */
export default function OrgInviteModalWrapper() {
  // Get values from URL params
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const inviteId = searchParams.get('organization_invite');
  const orgId = searchParams.get('organization_id');

  // Avoid rendering anything if there is no invite in the URL
  if (!inviteId || !orgId) {
    return null;
  }

  return <OrgInviteModal orgId={orgId} inviteId={inviteId}/>;
};
