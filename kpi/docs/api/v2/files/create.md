## Create a new file on current asset

Fields:

- `asset` (required)
- `user` (required)
- `description` (required)
- `file_type` (required)
- `content` (as binary) (optional)
- `metadata` JSON (optional)

_Notes:_

1. Files can have different types:
    - `map_layer`
    - `form_media`
2. Files can be created with three different ways
    - `POST` a file with `content` parameter
    - `POST` a base64 encoded string with `base64Encoded` parameter<sup>1</sup>
    - `POST` an URL with `metadata` parameter<sup>2</sup>

<sup>1)</sup> `metadata` becomes mandatory and must contain `filename` property<br>
<sup>2)</sup> `metadata` becomes mandatory and must contain `redirect_url` property

**Files with `form_media` type must have unique `filename` per asset**
