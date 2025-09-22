## List all access logs for all users

<sup>Note</sup> _Only available to superusers_

Submissions will be grouped together by user by hour

**Filterable fields:**

1. date_created
2. user_uid
3. user__username
4. metadata__source
5. metadata__auth_type
6. metadata__ip_address

**Some examples:**

1. All logs from a specific IP address
    `api/v2/access-logs/?q=metadata__ip_address:"127.0.0.1"`

2. All logs created after Jan 1, 2025
    `api/v2/access-logs/?q=date_created__gte:"2025-01-01"`

*Notes: Do not forget to wrap search terms in double-quotes if they contain spaces
(e.g. date and time "2022-11-15 20:34")*
