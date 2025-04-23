asset_count_get = """
Returns up to the last 31 days of daily counts and total counts of submissions to a survey.

<pre class="prettyprint">
<b>GET</b> /api/v2/assets/{uid}/counts/
</pre>

> Example
>
>       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/counts/

> Response
>
>       HTTP 200 Ok
>        {
>           "daily_submission_counts": {
>               "2022-10-20": 7,
>           },
>           "total_submission_count": 37
>        }
>

#### Queries

Query days to return the last x amount of daily counts up to a maximum of 31 days.

<pre class="prettyprint">
<b>GET</b> /api/v2/assets/{uid}/counts/?days={int}
</pre>

> Example
>
>       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/counts/?days=7
"""
