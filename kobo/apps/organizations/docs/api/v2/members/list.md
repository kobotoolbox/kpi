## List Members

Retrieves all members and pending invitations in the specified organization.

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
