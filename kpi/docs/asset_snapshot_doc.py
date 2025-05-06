form_list_method = """
Implements part of the OpenRosa Form List API.
This route returns the xml blank form file used by Enketo to preview the form.

<pre class="prettyprint">
<b>GET</b>  /api/v2/asset_snapshots/<code>{asset_snapshot_uid}</code>/formList?formId=<code>{form_id}</code>
</pre>

> Example
>
>       curl -X GET https://[kpi]/api/v2/asset_snapshots/szkzxHbuQSF8w2bhN9CTdt/formList?formId=sNXTi2Frubz9h3fPsTGm5h

"""

manifest_method = """
Implements part of the OpenRosa Form List API.
This route is used by Enketo when it fetches external resources.
It returns form media files location in order to display them within
Enketo preview.

<pre class="prettyprint">
<b>GET</b>  /api/v2/asset_snapshots/<code>{asset_snapshot_uid}</code>/manifest.xml
</pre>

> Example
>
>       curl -X GET https://[kpi]/api/v2/asset_snapshots/szkzxHbuQSF8w2bhN9CTdt/manifest.xml

"""

preview_method = """
## GET a the preview of an asset
<pre class="prettyprint">
<b>GET</b>  /api/v2/asset_snapshots/<code>{asset_uid}</code>/preview
</pre>

> Example
>
>       curl -X GET https://[kpi]/api/v2/asset_snapshots/szkzxHbuQSF8w2bhN9CTdt/preview
"""

submission_method = """
Implements the OpenRosa Form Submission API.

<pre class="prettyprint">
<b>POST</b>  /api/v2/asset_snapshots/<code>{asset_snapshot_uid}</code>/submission
</pre>

> Example
>
>       curl -X POST https://[kpi]/api/v2/asset_snapshots/szkzxHbuQSF8w2bhN9CTdt/submission

"""

xform_method = """
This route will render the XForm into syntax-highlighted HTML.
It is useful for debugging pyxform transformations
"""

xml_disclaimer_method = """
Implements part of the OpenRosa Form List API.
This route is used by Enketo when it fetches and returns the full xml form.

<pre class="prettyprint">
<b>GET</b>  /api/v2/asset_snapshots/<code>{asset_snapshot_uid}</code>/xlm_with_disclaimer.xml
</pre>

> Example
>
>       curl -X GET https://[kpi]/api/v2/asset_snapshots/szkzxHbuQSF8w2bhN9CTdt/xlm_with_disclaimer.xml

"""

