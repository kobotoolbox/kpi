## Retrieve organization asset usage tracker

Tracks the total usage of each asset for the user in the given organization

Use the `q` query parameter to filter by project name (e.g. `?q=household survey`). Bare search terms must be at least 3 characters long and match anywhere in the name, case-insensitively. The standard query syntax is also supported: `?q=name__icontains:household` for a contains match, while `?q=name:Household survey` is an exact name match.
