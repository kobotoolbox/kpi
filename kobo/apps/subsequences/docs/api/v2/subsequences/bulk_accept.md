## Bulk accept NLP results

Accepts transcription or translation results for multiple submissions in a
single request. This is the bulk counterpart of the per-submission acceptance
flow: instead of visiting each submission individually, users can select
multiple submissions and approve all of them at once.

The `operation` field declares the operation to perform. Currently only `"accept"`
is supported.

### Transcription example

```json
{
    "submission_uids": ["<uuid-1>", "<uuid-2>"],
    "question_xpath": "group_name/audio_question",
    "action_id": "automatic_google_transcription",
    "operation": "accept"
}
```

### Translation example

For translation actions the `language` field is **required**:

```json
{
    "submission_uids": ["<uuid-1>", "<uuid-2>"],
    "question_xpath": "group_name/audio_question",
    "action_id": "automatic_google_translation",
    "language": "fr",
    "operation": "accept"
}
```

### Response

Returns the number of submission records that were successfully accepted.
Submissions without a completed NLP result for the given question/action are
silently skipped and excluded from the count.

```json
{
    "accepted_count": 472
}
```
