import { type default as React, Suspense, useEffect } from 'react'

import { useNavigate } from 'react-router-dom'
import type { MemberRoleEnum } from '#/api/models/memberRoleEnum'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import LoadingSpinner from '#/components/common/loadingSpinner'

interface Props {
  children: React.ReactNode
  redirectRoute: string
  validRoles?: MemberRoleEnum[]
  mmoOnly?: boolean
}

/**
 * Use to handle display of pages that should only be accessible to certain user roles
 * or members of MMOs. Defaults to allowing access for all users, so you must supply
 * any restrictions.
 */
export const RequireOrgPermissions = ({ children, redirectRoute, validRoles = undefined, mmoOnly = false }: Props) => {
  const navigate = useNavigate()
  const [organization] = useOrganizationAssumed()
  const hasValidRole = validRoles ? validRoles.includes(organization.request_user_role) : true
  const hasValidOrg = mmoOnly ? organization.is_mmo : true

  useEffect(() => {
    if (!hasValidRole || !hasValidOrg) {
      navigate(redirectRoute)
    }
  }, [redirectRoute, navigate])

  return hasValidRole && hasValidOrg ? <Suspense fallback={null}>{children}</Suspense> : <LoadingSpinner />
}
