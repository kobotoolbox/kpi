## Update an invite status

Update the status of an invite.
Status accepted:
- `cancelled`
- `accepted`
- `declined`

_**Notes**: When submitting `accepted` the invite status becomes automatically `in_progress`_
<span class='label label-warning'>Only the sender can cancel an invite, and **if only if** the invite is still pending.</span>
<span class='label label-warning'>Only the recipient can accept or decline, **if and only if** the invite is still pending.</span>


    > Payload to cancel an invite
    >
    >       {
    >            "status": "cancelled"
    >       }

    ## Accept or decline an invite

    <span class='label label-warning'>Only the recipient can accept or decline, **if and only if** the invite is still pending.</span>

    > Payload to accept (or decline) an invite
    >
    >       {
    >            "status": "accepted|declined"
    >       }

