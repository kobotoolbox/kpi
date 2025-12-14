## Update submission supplementary data

This endpoint allows you to add, update, or delete supplementary data for a submission.

It supports the same action types as the GET endpoint:

* NLP actions (manual and automatic transcription / translation)
* Qualitative analysis

The PATCH payload follows the same per-question structure as the GET response.

⚠️ In this documentation, request and response examples present each action in
isolation for clarity. In practice, multiple actions may be combined within the same
payload or response, including for the same question, and a single submission may
contain multiple questions.
