# coding: utf-8
from rest_framework.response import Response

from kpi.views.v2.data import DataViewSet


class SubmissionViewSet(DataViewSet):
    """
    ## This document is for a deprecated version of kpi's API.

    **Please upgrade to latest release `/api/v2/assets/{uid}/data/`**

    ## List of submissions for a specific asset

    <pre class="prettyprint">
    <b>GET</b> /assets/<code>{asset_uid}</code>/submissions/
    </pre>

    By default, JSON format is used but XML format can be used too.
    <pre class="prettyprint">
    <b>GET</b> /assets/<code>{asset_uid}</code>/submissions.xml
    <b>GET</b> /assets/<code>{asset_uid}</code>/submissions.json
    </pre>

    or

    <pre class="prettyprint">
    <b>GET</b> /assets/<code>{asset_uid}</code>/submissions/?format=xml
    <b>GET</b> /assets/<code>{asset_uid}</code>/submissions/?format=json
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/submissions/

    ## CRUD

    * `uid` - is the unique identifier of a specific asset
    * `id` - is the unique identifier of a specific submission

    **It's not allowed to create submissions with `kpi`'s API**

    Retrieves current submission
    <pre class="prettyprint">
    <b>GET</b> /assets/<code>{uid}</code>/submissions/<code>{id}</code>/
    </pre>

    It's also possible to specify the format.

    <pre class="prettyprint">
    <b>GET</b> /assets/<code>{uid}</code>/submissions/<code>{id}</code>.xml
    <b>GET</b> /assets/<code>{uid}</code>/submissions/<code>{id}</code>.json
    </pre>

    or

    <pre class="prettyprint">
    <b>GET</b> /assets/<code>{asset_uid}</code>/submissions/<code>{id}</code>/?format=xml
    <b>GET</b> /assets/<code>{asset_uid}</code>/submissions/<code>{id}</code>/?format=json
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/submissions/234/

    Deletes current submission
    <pre class="prettyprint">
    <b>DELETE</b> /assets/<code>{uid}</code>/submissions/<code>{id}</code>/
    </pre>


    > Example
    >
    >       curl -X DELETE https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/submissions/234/


    Update current submission

    _It's not possible to update a submission directly with `kpi`'s API.
    Instead, it returns the link where the instance can be opened for edition._

    <pre class="prettyprint">
    <b>GET</b> /assets/<code>{uid}</code>/submissions/<code>{id}</code>/edit/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/submissions/234/edit/


    ### Validation statuses

    Retrieves the validation status of a submission.
    <pre class="prettyprint">
    <b>GET</b> /assets/<code>{uid}</code>/submissions/<code>{id}</code>/validation_status/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/submissions/234/validation_status/

    Update the validation of a submission
    <pre class="prettyprint">
    <b>PATCH</b> /assets/<code>{uid}</code>/submissions/<code>{id}</code>/validation_status/
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/submissions/234/validation_status/

    > **Payload**
    >
    >        {
    >           "validation_status.uid": <validation_status>
    >        }

    where `<validation_status>` is a string and can be one of theses values:

        - `validation_status_approved`
        - `validation_status_not_approved`
        - `validation_status_on_hold`

    Bulk update
    <pre class="prettyprint">
    <b>PATCH</b> /assets/<code>{uid}</code>/submissions/validation_statuses/
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/submissions/validation_statuses/

    > **Payload**
    >
    >        {
    >           "submission_ids": [{integer}],
    >           "validation_status.uid": <validation_status>
    >        }


    ### CURRENT ENDPOINT
    """

    def list(self, request, *args, **kwargs):
        format_type = kwargs.get('format', request.GET.get('format', 'json'))
        deployment = self._get_deployment()
        filters = self._filter_mongo_query(request)
        submissions = deployment.get_submissions(request.user,
                                                 format_type=format_type,
                                                 **filters)
        return Response(list(submissions))
