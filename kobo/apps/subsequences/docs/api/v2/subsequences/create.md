## Add an advanced action to an asset

Enables a new type of advanced action on a question in the asset.
* `action`, `params`, and `question_xpath` are required
* `params` must match the expected param_schema of the `action`

Accepted `action`s include:
* `manual_transcription`
* `automatic_google_transcription`
* `manual_translation`
* `automatic_google_translation`
* `qual`

