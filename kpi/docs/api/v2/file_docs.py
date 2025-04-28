files_content_method = """
### Return content of a file

<pre class="prettyprint">
<b>GET</b> /api/v2/assets/<code>{uid}</code>/files/{file_uid}/content/
</pre>

> Example
>
>       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/files/pG6AeSjCwNtpWazQAX76Ap/content/
"""

files_create = """
### Create a new file
<pre class="prettyprint">
<b>POST</b> /api/v2/assets/<code>{uid}</code>/files/
</pre>

> Example
>
>       curl -X POST https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/files/ \\
>            -H 'Content-Type: application/json' \\
>            -d '<payload>'  # Payload is sent as a string

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

> _Payload to create a file with binary content_
>
>        {
>           "user": "https://[kpi]/api/v2/users/{username}/",
>           "asset": "https://[kpi]/api/v2/asset/{asset_uid}/",
>           "description": "Description of the file",
>           "content": <binary>
>        }

> _Payload to create a file with base64 encoded content_
>
>        {
>           "user": "https://[kpi]/api/v2/users/{username}/",
>           "asset": "https://[kpi]/api/v2/asset/{asset_uid}/",
>           "description": "Description of the file",
>           "base64Encoded": "<base64-encoded-string>"
>           "metadata": {"filename": "filename.ext"}
>        }

> _Payload to create a file with a remote URL_
>
>        {
>           "user": "https://[kpi]/api/v2/users/{username}/",
>           "asset": "https://[kpi]/api/v2/asset/{asset_uid}/",
>           "description": "Description of the file",
>           "metadata": {"redirect_url": "https://domain.tld/image.jpg"}
>        }
"""

files_delete = """
### Delete a file

<pre class="prettyprint">
<b>DELETE</b> /api/v2/assets/<code>{uid}</code>/files/{file_uid}/
</pre>

> Example
>
>       curl -X DELETE https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/files/pG6AeSjCwNtpWazQAX76Ap/
"""

files_list = """
### List an asset's files
<pre class="prettyprint">
<b>GET</b> /api/v2/assets/<code>{uid}</code>/files/
</pre>

> Example
>
>       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/files/

Results can be narrowed down with a filter by type

> Example
>
>       curl -X GET https://[kpi]/assets/aSAvYreNzVEkrWg5Gdcvg/files/?file_type=map_layer
"""

files_retrieve = """
### Retrieve an asset's file
<pre class="prettyprint">
<b>GET</b> /api/v2/assets/<code>{uid}</code>/files/{file_uid}/
</pre>

> Example
>
>       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/files/afQoJxA4kmKEXVpkH6SYbhb/
"""
