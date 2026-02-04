## Get submission url of enketo in preview mode

`{id}` can be:

- The primary key of the submission
- Its `_uuid` <sup>1</sup>
- Its `rootUuid` (without "uuid:" prefix)

<sup>1</sup> Please note that using the `_uuid` may match **several** submissions, only
the first match will be returned.

Note: Some variation of this url exists:

`/api/v2/assets/{uid_asset}/data/{id}/enketo/view/`: return the url of the enketo submission (as seen in the response example).

`/api/v2/assets/{uid_asset}/data/{id}/enketo/redirect/view/`: redirect to the enketo url submission with a 302 code.
