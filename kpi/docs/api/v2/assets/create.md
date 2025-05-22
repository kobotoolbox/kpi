## Create or clone an asset

Where `asset_type` must be one of these values:

* block (can be cloned to `block`, `question`, `survey`, `template`)
* question (can be cloned to `question`, `survey`, `template`)
* survey (can be cloned to `block`, `question`, `survey`, `template`)
* template (can be cloned to `survey`, `template`)

Settings are cloned only when type of assets are `survey` or `template`.
In that case, `share-metadata` is not preserved.

When creating a new `block` or `question` asset, settings are not saved either.
