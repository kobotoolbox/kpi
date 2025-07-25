##  Migrate a user's project

A temporary endpoint that allows superusers to migrate other users'
projects, and users to migrate their own projects, from Kobocat to KPI.
This is required while users transition from the legacy interface to
the new.

1. Call this endpoint with `?username=<username>`
2. Fetch url provided to check the state of the Celery task.

  It can be:
    - 'PENDING'
    - 'FAILED'
    - 'SUCCESS'

Notes: Be aware that the Celery `res.state` isn't too reliable, it
returns 'PENDING' if task does not exist.
