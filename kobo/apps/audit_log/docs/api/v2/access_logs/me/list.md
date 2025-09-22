## List all access logs for the authenticated user

Submissions will be grouped together by hour

Results from this endpoint can be filtered by a boolean query specified in the `q` parameter.

**Filterable fields:**

1. date_created
2. metadata__source
3. metadata__auth_type
4. metadata__ip_address

**Some examples:**

1. All logs from a specific IP address
    `api/v2/access-logs/?q=metadata__ip_address:"127.0.0.1"`

2. All logs created after Jan, 1 2025
    `api/v2/access-logs/?q=date_created__date__gte:"2025-01-01"`

*Notes: Do not forget to wrap search terms in double-quotes if they contain spaces
(e.g. date and time "2022-11-15 20:34")*
