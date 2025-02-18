import { useSearchParams } from 'react-router-dom'
import OrgInviteModal from './OrgInviteModal'

/**
 * This is a wrapper for conditionally rendering the OrgInviteModal component. It looks for a particular pair of
 * search parameters to pass to the modal. Also, if an invitation is deleted or accepted, it removes those params.
 */
export default function OrgInviteModalWrapper() {
  const [searchParams, setSearchParams] = useSearchParams()
  const inviteId = searchParams.get('organization_invite')
  const orgId = searchParams.get('organization_id')

  function handleUserResponse() {
    searchParams.delete('organization_invite')
    searchParams.delete('organization_id')
    setSearchParams(searchParams)
  }

  // Avoid rendering anything if there is no invite in the URL
  if (!inviteId || !orgId) {
    return null
  }

  return <OrgInviteModal orgId={orgId} inviteId={inviteId} onUserResponse={handleUserResponse} />
}
