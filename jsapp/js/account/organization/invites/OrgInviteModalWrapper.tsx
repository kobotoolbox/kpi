import {useLocation} from 'react-router-dom';
import OrgInviteModal from './OrgInviteModal';

/**
 * This is a wrapper for conditionally rendering the OrgInviteModal component.
 */
export default function OrgInviteModalWrapper() {
  // Get invite id from URL params
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const inviteId = searchParams.get('organization-invite');
  const orgId = searchParams.get('organization-id');

  // Avoid rendering anything if there is no invite in the URL
  if (!inviteId || !orgId) {
    return null;
  }

  return (
    <OrgInviteModal orgId={orgId} inviteId={inviteId}/>
  );
};
