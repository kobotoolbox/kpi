## Create Organization Invite

* Create organization invites for registered and unregistered users.
* Set the role for which the user is being invited -
(Choices: `member`, `admin`). Default is `member`.


    > Payload

    >     {
    >         "invitees": ["demo14", "demo13@demo13.com", "demo20@demo20.com"]
    >         "role": "member"
    >     }
