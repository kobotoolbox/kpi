## List the translation services accessible to requesting (authenticated) user.

Search can be made with `q` parameter to search for the term in names and codes.

Results are ordered by priority (lower values first), then by name.

Each service exposes `action_id`: the ID of the action to call to use it, or `null` when no action handles it.
