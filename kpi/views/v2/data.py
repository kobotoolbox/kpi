# coding: utf-8
import json

from django.conf import settings
from django.http import Http404
from django.utils.translation import ugettext_lazy as _
from rest_framework import (
    renderers,
    serializers,
    status,
    viewsets,
)
from rest_framework.decorators import action
from rest_framework.pagination import _positive_int as positive_int
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.constants import (
    SUBMISSION_FORMAT_TYPE_JSON,
    PERM_CHANGE_SUBMISSIONS,
    PERM_DELETE_SUBMISSIONS,
    PERM_VALIDATE_SUBMISSIONS,
)
from kpi.exceptions import ObjectDeploymentDoesNotExist
from kpi.models import Asset
from kpi.paginators import DataPagination
from kpi.permissions import (
    DuplicateSubmissionPermission,
    EditSubmissionPermission,
    SubmissionPermission,
    SubmissionValidationStatusPermission,
    ViewSubmissionPermission,
)
from kpi.renderers import SubmissionGeoJsonRenderer, SubmissionXMLRenderer
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin
from kpi.serializers.v2.data import DataBulkActionsValidator


class DataViewSet(AssetNestedObjectViewsetMixin, NestedViewSetMixin,
                  viewsets.GenericViewSet):
    """
    ## List of submissions for a specific asset

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data/
    </pre>

    By default, JSON format is used, but XML and GeoJSON are also available:

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data.xml
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data.geojson
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data.json
    </pre>

    or

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data/?format=xml
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data/?format=geojson
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data/?format=json
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/

    ## Pagination
    Two parameters can be used to control pagination.

    * `start`: Index (zero-based) from which the results start
    * `limit`: Number of results per page <span class='label label-warning'>Maximum results per page is **30000**</span>

    > Example: The first ten results
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/?start=0&limit=10

    ## Query submitted data
    Provides a list of submitted data for a specific form. Use `query`
    parameter to apply form data specific, see
    <a href="http://docs.mongodb.org/manual/reference/operator/query/">
    http://docs.mongodb.org/manual/reference/operator/query/</a>.

    For more details see
    <a href="https://github.com/SEL-Columbia/formhub/wiki/Formhub-Access-Points-(API)#api-parameters">API Parameters</a>.
    <span class='label label-warning'>API parameter `count` is not implemented</span>


    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data/?query={"field":"value"}</b>
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data/?query={"field":{"op": "value"}}"</b>
    </pre>
    > Example
    >
    >       curl -X GET 'https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/?query={"__version__": "vWvkKzNE8xCtfApJvabfjG"}'
    >       curl -X GET 'https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/?query={"_submission_time": {"$gt": "2019-09-01T01:02:03"}}'

    ## About the GeoJSON format

    Requesting the `geojson` format returns a `FeatureCollection` where each
    submission is a `Feature`. If your form has multiple geographic questions,
    use the `geo_question_name` query parameter to determine which question's
    responses populate the `geometry` for each `Feature`; otherwise, the first
    geographic question is used.  All question/response pairs are included in
    the `properties` of each `Feature`, but _repeating groups are omitted_.

    Question types are mapped to GeoJSON geometry types as follows:

    * `geopoint` to `Point`;
    * `geotrace` to `LineString`;
    * `geoshape` to `Polygon`.

    ## CRUD

    * `uid` - is the unique identifier of a specific asset
    * `id` - is the unique identifier of a specific submission

    **It is not allowed to create submissions with `kpi`'s API as this is handled by `kobocat`'s `/submission` endpoint**

    Retrieves a specific submission
    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{uid}</code>/data/<code>{id}</code>/
    </pre>

    It is also possible to specify the format.

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{uid}</code>/data/<code>{id}</code>.xml
    <b>GET</b> /api/v2/assets/<code>{uid}</code>/data/<code>{id}</code>.json
    </pre>

    or

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data/<code>{id}</code>/?format=xml
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data/<code>{id}</code>/?format=json
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/234/

    Deletes current submission
    <pre class="prettyprint">
    <b>DELETE</b> /api/v2/assets/<code>{uid}</code>/data/<code>{id}</code>/
    </pre>


    > Example
    >
    >       curl -X DELETE https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/234/


    Update current submission

    _It is not possible to update a submission directly with `kpi`'s API as this is handled by `kobocat`'s `/submission` endpoint.
    Instead, it returns the URL where the instance can be opened in Enketo for editing in the UI._

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{uid}</code>/data/<code>{id}</code>/enketo/edit/?return_url=false
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/234/enketo/edit/?return_url=false

    View-only version of current submission

    Return a URL to display the filled submission in view-only mode in the Enketo UI.

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{uid}</code>/data/<code>{id}</code>/enketo/view/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/234/enketo/view/

    ### Duplicate submission

    Duplicates the data of a submission
    <pre class="prettyprint">
    <b>POST</b> /api/v2/assets/<code>{uid}</code>/data/<code>{id}</code>/duplicate/
    </pre>

    > Example
    >
    >       curl -X POST https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/234/duplicate/


    ### Validation statuses

    Retrieves the validation status of a submission.
    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{uid}</code>/data/<code>{id}</code>/validation_status/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/234/validation_status/

    Update the validation of a submission
    <pre class="prettyprint">
    <b>PATCH</b> /api/v2/assets/<code>{uid}</code>/data/<code>{id}</code>/validation_status/
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/234/validation_status/

    > **Payload**
    >
    >        {
    >           "validation_status.uid": <validation_status>
    >        }

    where `<validation_status>` is a string and can be one of these values:

    * `validation_status_approved`
    * `validation_status_not_approved`
    * `validation_status_on_hold`

    Bulk update
    <pre class="prettyprint">
    <b>PATCH</b> /api/v2/assets/<code>{uid}</code>/data/validation_statuses/
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/validation_statuses/

    > **Payload**
    >
    >        {
    >           "submission_ids": [{integer}],
    >           "validation_status.uid": <validation_status>
    >        }


    ### Bulk updating of submissions

    <pre class="prettyprint">
    <b>PATCH</b> /api/v2/assets/<code>{uid}</code>/data/bulk/
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/bulk/

    > **Payload**
    >
    >        {
    >           "submission_ids": [{integer}],
    >           "data": {
    >               <field_to_update_1>: <value_1>,
    >               <field_to_update_2>: <value_2>,
    >               <field_to_update_n>: <value_n>
    >           }
    >        }

    where `<field_to_update_n>` is a string and should be an existing XML field value of the submissions.
    If `<field_to_update_n>` is part of a group or nested group, the field must follow the group hierarchy
    structure, i.e.:

    If the field is within a group called `group_1`, the field name is `question_1` and the new value is `new value`,
    the payload should contain an item with the following structure:

    <pre class="prettyprint">
    "group_1/question_1": "new value"
    </pre>

    Similarly, if there are `N` nested groups, the structure will be:

    <pre class="prettyprint">
    "group_1/sub_group_1/.../sub_group_n/question_1": "new value"
    </pre>


    ### CURRENT ENDPOINT
    """

    parent_model = Asset
    renderer_classes = (renderers.BrowsableAPIRenderer,
                        renderers.JSONRenderer,
                        SubmissionGeoJsonRenderer,
                        SubmissionXMLRenderer,
                        )
    permission_classes = (SubmissionPermission,)
    pagination_class = DataPagination

    def _get_deployment(self):
        """
        Returns the deployment for the asset specified by the request
        """
        if not self.asset.has_deployment:
            raise ObjectDeploymentDoesNotExist(
                _('The specified asset has not been deployed')
            )

        return self.asset.deployment

    @action(detail=False, methods=['PATCH', 'DELETE'],
            renderer_classes=[renderers.JSONRenderer])
    def bulk(self, request, *args, **kwargs):
        deployment = self._get_deployment()
        kwargs = {
            'data': request.data,
            'context': self.get_serializer_context(),
        }
        if request.method == 'DELETE':
            action_ = deployment.delete_submissions
            kwargs['perm'] = PERM_DELETE_SUBMISSIONS
        elif request.method == 'PATCH':
            action_ = deployment.bulk_update_submissions
            kwargs['perm'] = PERM_CHANGE_SUBMISSIONS

        bulk_actions_validator = DataBulkActionsValidator(**kwargs)
        bulk_actions_validator.is_valid(raise_exception=True)
        json_response = action_(bulk_actions_validator.data, request.user)

        return Response(**json_response)

    def destroy(self, request, pk, *args, **kwargs):
        deployment = self._get_deployment()
        # Coerce to int because back end only finds matches with same type
        submission_id = positive_int(pk)
        json_response = deployment.delete_submission(
            submission_id, user=request.user
        )
        return Response(**json_response)

    @action(
        detail=True,
        methods=['GET'],
        renderer_classes=[renderers.JSONRenderer],
        permission_classes=[EditSubmissionPermission],
        url_path='enketo(?:/(?P<action>edit))?',
    )
    def enketo_edit(self, request, pk, *args, **kwargs):
        return self._enketo_request(request, pk, action_='edit', *args, **kwargs)

    @action(
        detail=True,
        methods=['GET'],
        renderer_classes=[renderers.JSONRenderer],
        permission_classes=[ViewSubmissionPermission],
        url_path='enketo/view',
    )
    def enketo_view(self, request, pk, *args, **kwargs):
        return self._enketo_request(request, pk, action_='view', *args, **kwargs)

    def get_queryset(self):
        # This method is needed when pagination is activated and renderer is
        # `BrowsableAPIRenderer`. Because data comes from Mongo, `list()` and
        # `retrieve()` don't need Django Queryset, we only need return `None`.
        return None

    def list(self, request, *args, **kwargs):
        format_type = kwargs.get('format', request.GET.get('format', 'json'))
        deployment = self._get_deployment()
        filters = self._filter_mongo_query(request)

        if format_type == 'geojson':
            # For GeoJSON, get the submissions as JSON and let
            # `SubmissionGeoJsonRenderer` handle the rest
            return Response(
                deployment.get_submissions(
                    user=request.user,
                    format_type=SUBMISSION_FORMAT_TYPE_JSON,
                    **filters
                )
            )

        submissions = deployment.get_submissions(request.user,
                                                 format_type=format_type,
                                                 **filters)
        # Create a dummy list to let the Paginator do all the calculation
        # for pagination because it does not need the list of real objects.
        # It avoids retrieving all the objects from MongoDB
        dummy_submissions_list = [None] * deployment.current_submissions_count
        page = self.paginate_queryset(dummy_submissions_list)
        if page is not None:
            return self.get_paginated_response(submissions)

        return Response(list(submissions))

    def retrieve(self, request, pk, *args, **kwargs):
        format_type = kwargs.get('format', request.GET.get('format', 'json'))
        deployment = self._get_deployment()
        filters = self._filter_mongo_query(request)
        try:
            submission = deployment.get_submission(
                positive_int(pk),
                user=request.user,
                format_type=format_type,
                **filters,
            )
        except ValueError:
            raise Http404
        else:
            if not submission:
                raise Http404
        return Response(submission)

    @action(detail=True, methods=['POST'],
            renderer_classes=[renderers.JSONRenderer],
            permission_classes=[DuplicateSubmissionPermission])
    def duplicate(self, request, pk, *args, **kwargs):
        """
        Creates a duplicate of the submission with a given `pk`
        """
        deployment = self._get_deployment()
        # Coerce to int because back end only finds matches with same type
        submission_id = positive_int(pk)
        duplicate_response = deployment.duplicate_submission(
            submission_id=submission_id, user=request.user
        )
        return Response(duplicate_response, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['GET', 'PATCH', 'DELETE'],
            renderer_classes=[renderers.JSONRenderer],
            permission_classes=[SubmissionValidationStatusPermission])
    def validation_status(self, request, pk, *args, **kwargs):
        deployment = self._get_deployment()
        # Coerce to int because back end only finds matches with same type
        submission_id = positive_int(pk)
        if request.method == 'GET':
            json_response = deployment.get_validation_status(
                submission_id=submission_id,
                user=request.user,
            )
        else:
            json_response = deployment.set_validation_status(
                submission_id=submission_id,
                user=request.user,
                data=request.data,
                method=request.method,
            )

        return Response(**json_response)

    @action(detail=False, methods=['PATCH', 'DELETE'],
            renderer_classes=[renderers.JSONRenderer],
            permission_classes=[SubmissionValidationStatusPermission])
    def validation_statuses(self, request, *args, **kwargs):
        deployment = self._get_deployment()
        bulk_actions_validator = DataBulkActionsValidator(
            data=request.data,
            context=self.get_serializer_context(),
            perm=PERM_VALIDATE_SUBMISSIONS
        )
        bulk_actions_validator.is_valid(raise_exception=True)
        json_response = deployment.set_validation_statuses(
            request.user, bulk_actions_validator.data)

        return Response(**json_response)

    def _enketo_request(self, request, pk, action_, *args, **kwargs):
        deployment = self._get_deployment()
        submission_id = positive_int(pk)
        json_response = deployment.get_enketo_submission_url(
            submission_id,
            user=request.user,
            action_=action_,
            params=request.GET
        )
        return Response(**json_response)

    def _filter_mongo_query(self, request):
        """
        Build filters to pass to Mongo query.
        Acts like Django `filter_backends`

        :param request:
        :return: dict
        """
        filters = {}

        if request.method == "GET":
            filters = request.GET.dict()

        # Remove `format` from filters. No need to use it
        filters.pop('format', None)
        # Do not allow requests to retrieve more than `SUBMISSION_LIST_LIMIT`
        # submissions at one time
        limit = filters.get('limit', settings.SUBMISSION_LIST_LIMIT)
        try:
            filters['limit'] = positive_int(
                limit, strict=True, cutoff=settings.SUBMISSION_LIST_LIMIT
            )
        except ValueError:
            raise serializers.ValidationError(
                {'limit': _('A positive integer is required')}
            )

        return filters
