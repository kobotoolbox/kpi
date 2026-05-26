## List bulk processing jobs on an asset

Returns paginated bulk processing jobs associated with the specified asset. Each
job is organized around one action, one question, and many submissions.

Use this endpoint to monitor recently-created bulk transcription and translation
jobs. Each result includes the parent job status, per-submission statuses, the
original deterministic params, the user who created the job, cancellation
metadata, and integer `progress` from `0` to `100`.

Job statuses:

* `pending`: the job exists but has not started.
* `in_progress`: one or more child submissions are still active.
* `complete`: every child submission has reached a terminal state.
* `cancelled`: the job was cancelled.

Child submission statuses:

* `pending`
* `in_progress`
* `complete`
* `failed`
* `cancelled`
