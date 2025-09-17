## Get submission url of enketo in edit mode

Note: Some variation of this url exists:

`/api/v2/assets/{parent_lookup_asset}/data/{id}/edit/`: deprecated, use the next one.

`/api/v2/assets/{parent_lookup_asset}/data/{id}/enketo/edit/`: return the url of the enketo submission (as seen in the response example).

`/api/v2/assets/{parent_lookup_asset}/data/{id}/enketo/redirect/edit/`: redirect to the enketo url submission with a 302 HTTP code.
