## Update an invite status

Update the status of an invite.
Status accepted:
- `cancelled`
- `accepted`
- `declined`

**Notes**:
- _When submitting `accepted` the invite status becomes automatically `in_progress`_
- _Only the sender can cancel an invite, and **if only if** the invite is still pending._
- _Only the recipient can accept or decline, **if and only if** the invite is still pending._

