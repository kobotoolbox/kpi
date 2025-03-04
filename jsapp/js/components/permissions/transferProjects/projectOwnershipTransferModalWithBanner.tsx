import React, { useState, useEffect } from 'react'

import { useSearchParams } from 'react-router-dom'
import ProjectTransferInviteBanner from './projectTransferInviteBanner'
import type { TransferInviteState } from './projectTransferInviteBanner'
import { type TransferStatuses, isInviteForLoggedInUser } from './transferProjects.api'
import TransferProjectsInvite from './transferProjectsInvite.component'

/**
 * This is a glue component that displays a modal from `TransferProjectsInvite`
 * and a banner from `ProjectTransferInviteBanner` as an outcome of the modal
 * action.
 */
export default function ProjectOwnershipTransferModalWithBanner() {
  const [invite, setInvite] = useState<TransferInviteState>({
    valid: false,
    uid: '',
    status: null,
    name: '',
    currentOwner: '',
  })
  const [isBannerVisible, setIsBannerVisible] = useState(true)
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const inviteParams = searchParams.get('invite')
    if (inviteParams) {
      isInviteForLoggedInUser(inviteParams).then((data) => {
        setInvite({ ...invite, valid: data, uid: inviteParams })
      })
    } else {
      setInvite({ ...invite, valid: false, uid: '' })
    }
  }, [searchParams])

  const setInviteDetail = (
    newStatus: TransferStatuses.Accepted | TransferStatuses.Declined,
    name: string,
    currentOwner: string,
  ) => {
    setInvite({
      ...invite,
      status: newStatus,
      name: name,
      currentOwner: currentOwner,
    })
  }

  return (
    <>
      {isBannerVisible && (
        <ProjectTransferInviteBanner
          invite={invite}
          onRequestClose={() => {
            setIsBannerVisible(false)
          }}
        />
      )}

      {invite.valid && invite.uid !== '' && (
        <TransferProjectsInvite setInvite={setInviteDetail} inviteUid={invite.uid} />
      )}
    </>
  )
}
