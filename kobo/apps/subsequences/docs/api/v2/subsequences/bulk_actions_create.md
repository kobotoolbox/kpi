## Create a bulk processing job

Creates and starts a bulk processing job for one question across multiple
submissions.

Supported actions:

* `automatic_google_transcription`
* `automatic_google_translation`

The request must include the target `question_xpath`, the submission root UUIDs
to process, and deterministic `params`. `params.language` is required. For
transcription, `params.locale` may also be supplied when a more specific Google
Speech locale is needed.

Creation is atomic. If any selected submission is unknown, already has matching
results, or already has an active matching bulk action, no job or child items are
created.

The response is the created job. Its initial status is `in_progress` because
creation immediately starts background processing.
