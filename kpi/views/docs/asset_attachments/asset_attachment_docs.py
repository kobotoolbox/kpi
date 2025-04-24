asset_attachment_list = """
## GET list of audio and video files

<pre class="prettyprint">
<b>GET</b>  /api/v2/assets/<code>{asset_uid}</code>/data/<code>{data_id}</code>/attachments/
</pre>

<sup>*</sup>`data_id` can be the primary key of the submission or its `uuid`.
Please note that using the `uuid` may match **several** submissions, only
the first match will be returned.

> Example
>
>       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/451/attachments/

"""

asset_attachment_retrieve = """
## GET an audio or video file

<pre class="prettyprint">
<b>GET</b>  /api/v2/assets/<code>{asset_uid}</code>/data/<code>{data_id}</code>/attachments/?xpath=<code>{xml_path_to_question}</code>
</pre>

<sup>*</sup>`data_id` can be the primary key of the submission or its `uuid`.
Please note that using the `uuid` may match **several** submissions, only
the first match will be returned.

> Example
>
>       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/451/attachments/?xpath=Upload_a_file

## GET an MP3 file from an audio or video file
Convert audio and video files. Only conversions to MP3 is supported for this feature

<pre class="prettyprint">
<b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data/<code>{data_id}</code>/attachments/?xpath=<code>{xml_path_to_question}</code>&format=mp3
</pre>

> Example
>
>       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/451/attachments/?xpath=Upload_a_file&format=mp3
"""

asset_attachment_thumb = """
## GET attachment file with specified thumbnail size

<pre class="prettyprint">
<b>GET</b>  /api/v2/assets/{parent_lookup_asset}/data/{parent_lookup_data}/attachments/{id}/{sufix}
</pre>

<sup>*</sup>`data_id` can be the primary key of the submission or its `uuid`.
Please note that using the `uuid` may match **several** submissions, only
the first match will be returned.

<sup>*</sup>`suffix` is an optional parameter.
If unspecified, the original thumbnail size will be returned.

> Example original size
>
>       curl -X GET https://[kpi]/api/v2/assets/{parent_lookup_asset}/data/{parent_lookup_data}/attachments/{id}/

> Example small size
>
>        curl -X GET https://[kpi]/api/v2/assets/{parent_lookup_asset}/data/{parent_lookup_data}/attachments/{id}/small/

> Example medium size
>
>        curl -X GET https://[kpi]/api/v2/assets/{parent_lookup_asset}/data/{parent_lookup_data}/attachments/{id}/medium/

> Example large size
>
>        curl -X GET https://[kpi]/api/v2/assets/{parent_lookup_asset}/data/{parent_lookup_data}/attachments/{id}/large/

"""
