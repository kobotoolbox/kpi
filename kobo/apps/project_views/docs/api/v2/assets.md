## Retrieve assets available in project view

Superusers can add `?extra_fields=on` to get, for each project, its sharing `status`, its `summary`, the uid of its latest version (`version_id`), the uid of its deployed version (`deployed_version_id`) and its number of versions (`version_count`). Comparing `version_id` with a previous crawl tells which forms changed, so that only those need `/api/v2/assets/{uid_asset}/content/`. The parameter is ignored for other users.
