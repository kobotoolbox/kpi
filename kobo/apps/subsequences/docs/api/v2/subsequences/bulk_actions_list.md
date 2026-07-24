## List bulk processing jobs on an asset

Returns paginated bulk processing jobs associated with the specified asset. Each
job is organized around one action, one question, and many submissions.

Use this endpoint to monitor recently-created bulk transcription and translation
jobs. Each result includes the parent job status, per-submission statuses, the
original deterministic params, the user who created the job, cancellation
metadata, and integer `progress` from `0` to `100`.

Optional query params:

* `status`: Filter by parent job status. Accepts a comma-separated list,
  for example `status=pending,in_progress`.
* `submission_uuid`: Return only jobs that include this submission.
* `question_xpath`: Return only jobs for this question xpath.

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
