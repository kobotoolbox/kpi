 ### Reports

    Returns the submission data for all deployments of a survey.
    This data is grouped by answers, and does not show the data for individual submissions.
    The endpoint will return a <b>404 NOT FOUND</b> error if the asset is not deployed and will only return the data for the most recently deployed version.

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/{uid}/reports/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/reports/
