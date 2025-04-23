assset_usage_documentation = """
## Asset Usage Tracker
Tracks the total and monthly submissions per asset, as well as NLP usage and total storage use

<pre class="prettyprint">
<b>GET</b> /api/v2/asset_usage/
</pre>

> Example
>
>       curl -X GET https://[kpi]/api/v2/asset_usage/
>       {
>           "count": {integer},
>           "next": {url_to_next_page},
>           "previous": {url_to_previous_page},
>           "results": [
>               {
>                   "asset": {asset_url},
>                   "asset_name": {string},
>                   "nlp_usage_current_period": {
>                       "total_asr_seconds": {integer},
>                       "total_mt_characters": {integer},
>                   }
>                   "nlp_usage_all_time": {
>                       "total_asr_seconds": {integer},
>                       "total_mt_characters": {integer},
>                   }
>                   "storage_bytes": {integer},
>                   "submission_count_current_period": {integer},
>                   "submission_count_all_time": {integer},
>               },{...}
>           ]
"""
