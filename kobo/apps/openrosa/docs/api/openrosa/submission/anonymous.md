## Implement part of the OpenRosa Form Submission API

⚠️This endpoint is **only available** from the Kobocat domains (ex: kc.kobotoolbox.org or kc-eu.kobotoolbox.org)⚠️

This endpoint is used for adding submissions as an anonymous user.

### XML Submission

You can submit an XML XForm submission using a `POST` request with `multipart/form-data`.

**Example:**

```shell
curl -X POST -F xml_submission_file=@/path/to/submission.xml \
https://kc.kobotoolbox.org/{username}/submission
```

### JSON Submission

You can also submit a JSON XForm submission.

**Example:**

```shell
curl -X POST -d '{"id": "{id_string}", "submission": {submission_json}}' \
https://kc.kobotoolbox.org/{username}/submission -H "Content-Type: application/json"
```

The `{id_string}` is the `id_string` of your form, and `{submission_json}` is the submission data in JSON format.
