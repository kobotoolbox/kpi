## List Members

Retrieves all members and pending invitations in the specified organization.

### Searching

Search can be made with the `q` parameter. It will implicitly match against the username, email, first name, last name, and profile name (`extra_details__data__name`) of the members or pending invitations.

```shell
curl -X GET https://kf.kobotoolbox.org/api/v2/organizations/{uid_organization}/members/?q=luis
```

> [!WARNING]
> **Explicit Field Searching:** Because this endpoint combines active members (`OrganizationUser`) and pending invitations (`OrganizationInvitation`), you cannot use an explicit boolean `OR` across different model fields in the same query (e.g., `q=user__email:luis@example.com OR invitee__email:luis@example.com`). Doing so will cause both query parsers to reject the invalid field, resulting in a 400 Bad Request error.
> 
> To search across both groups simultaneously, simply rely on the generic query (e.g., `q=luis@example.com`) without specifying prefixes. Use explicit field prefixes ONLY when you want to narrow the results to a specific group (e.g., `q=user__email:luis@example.com` to target only active members).

### Sorting

Results can be sorted with the `ordering` parameter, e.g.:

```shell
curl -X GET https://kf.kobotoolbox.org/api/v2/organizations/{uid_organization}/members/?ordering=-user__username
```

Allowed ordering fields:

- `user__username`
- `status`
- `date_joined` (or `date_added`, `created`)
- `role` (sorted by privilege rank: `member` → `admin` → `owner`)
- `user__has_sso_enabled`

Prefix field names with `-` for descending sort.
