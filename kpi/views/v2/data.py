# coding: utf-8
import json
import re
from xml.etree import ElementTree as ET

import requests
from django.conf import settings
from django.http import Http404
from django.utils.translation import gettext_lazy as t
from pymongo.errors import OperationFailure
from rest_framework import (
    renderers,
    serializers,
    status,
    viewsets,
)
from rest_framework.decorators import action
from rest_framework.pagination import _positive_int as positive_int
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.reports.constants import INFERRED_VERSION_ID_KEY
from kobo.apps.reports.report_data import build_formpack
from kpi.authentication import EnketoSessionAuthentication
from kpi.constants import (
    SUBMISSION_FORMAT_TYPE_JSON,
    SUBMISSION_FORMAT_TYPE_XML,
    PERM_CHANGE_SUBMISSIONS,
    PERM_DELETE_SUBMISSIONS,
    PERM_VALIDATE_SUBMISSIONS,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.exceptions import ObjectDeploymentDoesNotExist
from kpi.models import Asset
from kpi.paginators import DataPagination
from kpi.permissions import (
    DuplicateSubmissionPermission,
    EditLinkSubmissionPermission,
    SubmissionPermission,
    SubmissionValidationStatusPermission,
    ViewSubmissionPermission,
)
from kpi.renderers import (
    SubmissionGeoJsonRenderer,
    SubmissionXMLRenderer,
)
from kpi.utils.log import logging
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

    <sup>*</sup>`id` can be the primary key of the submission or its `uuid`.
    Please note that using the `uuid` may match **several** submissions, only
    the first match will be returned.

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
    renderer_classes = (
        renderers.BrowsableAPIRenderer,
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
                t('The specified asset has not been deployed')
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
        permission_classes=[EditLinkSubmissionPermission],
        url_path='(enketo\/)?edit',
    )
    def enketo_edit(self, request, pk, *args, **kwargs):
        submission_id = positive_int(pk)
        enketo_response = self._get_enketo_link(request, submission_id, 'edit')
        if enketo_response.status_code in (
            status.HTTP_201_CREATED, status.HTTP_200_OK
        ):
            # See https://github.com/enketo/enketo-express/issues/187
            EnketoSessionAuthentication.prepare_response_with_csrf_cookie(
                request, enketo_response
            )
        return enketo_response

    @action(
        detail=True,
        methods=['GET'],
        renderer_classes=[renderers.JSONRenderer],
        permission_classes=[ViewSubmissionPermission],
        url_path='enketo/view',
    )
    def enketo_view(self, request, pk, *args, **kwargs):
        submission_id = positive_int(pk)
        return self._get_enketo_link(request, submission_id, 'view')

    def get_queryset(self):
        # This method is needed when pagination is activated and renderer is
        # `BrowsableAPIRenderer`. Because data comes from Mongo, `list()` and
        # `retrieve()` don't need Django Queryset, we only need return `None`.
        return None

    def get_submission(self):
        # Perform the lookup filtering.
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field

        assert lookup_url_kwarg in self.kwargs, (
                'Expected view %s to be called with a URL keyword argument '
                'named "%s". Fix your URL conf, or set the `.lookup_field` '
                'attribute on the view correctly.' %
                (self.__class__.__name__, lookup_url_kwarg)
        )

        filter_kwargs = {self.lookup_field: self.kwargs[lookup_url_kwarg]}
        print('FILTER KWARGS', filter_kwargs)

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
                    request=request,
                    **filters
                )
            )

        try:
            submissions = deployment.get_submissions(request.user,
                                                    format_type=format_type,
                                                    request=request,
                                                    **filters)
        except OperationFailure as err:
            message = str(err)
            # Don't show just any raw exception message out of fear of data leaking
            if message == '$all needs an array':
                raise serializers.ValidationError(message)
            logging.warning(message, exc_info=True)
            raise serializers.ValidationError('Unsupported query')
        # Create a dummy list to let the Paginator do all the calculation
        # for pagination because it does not need the list of real objects.
        # It avoids retrieving all the objects from MongoDB
        dummy_submissions_list = [None] * deployment.current_submissions_count
        page = self.paginate_queryset(dummy_submissions_list)
        if page is not None:
            return self.get_paginated_response(submissions)

        return Response(list(submissions))

    def retrieve(self, request, pk, *args, **kwargs):
        """
        Retrieve a submission by its primary key or its UUID.

        Warning when using the UUID. Submissions can have the same uuid because
        there is no unique constraint on this field. The first occurrence
        will be returned.
        """
        format_type = kwargs.get('format', request.GET.get('format', 'json'))
        deployment = self._get_deployment()
        params = {
            'user': request.user,
            'format_type': format_type,
            'request': request,
        }
        filters = self._filter_mongo_query(request)

        # Unfortunately, Django expects that the URL parameter is `pk`,
        # its name cannot be changed (easily).
        submission_id_or_uuid = pk
        try:
            submission_id_or_uuid = positive_int(submission_id_or_uuid)
        except ValueError:
            if not re.match(
                r'[a-z\d]{8}-([a-z\d]{4}-){3}[a-z\d]{12}', submission_id_or_uuid
            ):
                raise Http404

            try:
                query = json.loads(filters.pop('query', '{}'))
            except json.JSONDecodeError:
                raise serializers.ValidationError(
                    {'query': t('Value must be valid JSON.')}
                )
            query['_uuid'] = submission_id_or_uuid
            filters['query'] = query
        else:
            params['submission_ids'] = [submission_id_or_uuid]

        # Join all parameters to be passed to `deployment.get_submissions()`
        params.update(filters)

        # The `get_submissions()` is a generator in KobocatDeploymentBackend
        # class but a list in MockDeploymentBackend. We cast the result as a list
        # no matter what is the deployment back-end class to make it work with
        # both. Since the number of submissions is be very small, it should not
        # have a big impact on memory (i.e. list vs generator)
        submissions = list(deployment.get_submissions(**params))
        if not submissions:
            raise Http404

        submission = submissions[0]
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
                {'limit': t('A positive integer is required')}
            )

        return filters

    def _get_enketo_link(
        self, request: Request, submission_id: int, action_: str
    ) -> Response:

        deployment = self._get_deployment()
        user = request.user

        if action_ == 'edit':
            enketo_endpoint = settings.ENKETO_EDIT_INSTANCE_ENDPOINT
            partial_perm = PERM_CHANGE_SUBMISSIONS
        elif action_ == 'view':
            enketo_endpoint = settings.ENKETO_VIEW_INSTANCE_ENDPOINT
            partial_perm = PERM_VIEW_SUBMISSIONS

        # User's permissions are validated by the permission class. This extra step
        # is needed to validate at a row level for users with partial permissions.
        # A `PermissionDenied` error will be raised if it is not the case.
        # `validate_access_with_partial_perms()` is called no matter what are the
        # user's permissions. The first check inside the method is the user's
        # permissions. `submission_ids` should be equal to `None` if user has
        # regular permissions.
        deployment.validate_access_with_partial_perms(
            user=user,
            perm=partial_perm,
            submission_ids=[submission_id],
        )

        # The XML version is needed for Enketo
        submission_xml = deployment.get_submission(
            submission_id, user, SUBMISSION_FORMAT_TYPE_XML
        )
        # The JSON version is needed to detect its version
        submission_json = deployment.get_submission(
            submission_id, user, request=request
        )

        # Do not use version_uid from the submission until UI gives users the
        # possibility to choose which version they want to use

        # # TODO: un-nest `_infer_version_id()` from `build_formpack()` and move
        # # it into some utility file
        # _, submissions_stream = build_formpack(
        #     self.asset,
        #     submission_stream=[submission_json],
        #     use_all_form_versions=True
        # )
        # version_uid = list(submissions_stream)[0][INFERRED_VERSION_ID_KEY]

        # Let's use the latest version uid temporarily
        version_uid = self.asset.latest_version.uid

        # Retrieve the XML root node name from the submission. The instance's
        # root node name specified in the form XML (i.e. the first child of
        # `<instance>`) must match the root node name of the submission XML,
        # otherwise Enketo will refuse to open the submission.
        xml_root_node_name = ET.fromstring(submission_xml).tag

        # This will raise `AssetVersion.DoesNotExist` if the inferred version
        # of the submission disappears between the call to `build_formpack()`
        # and here, but allow a 500 error in that case because there's nothing
        # the client can do about it
        snapshot = self.asset.versioned_snapshot(
            version_uid=version_uid, root_node_name=xml_root_node_name
        )

        data = {
            'server_url': reverse(
                viewname='assetsnapshot-detail',
                kwargs={'uid': snapshot.uid},
                request=request,
            ),
            'instance': submission_xml,
            'instance_id': submission_json['_uuid'],
            'form_id': snapshot.uid,
            'return_url': 'false'  # String to be parsed by EE as a boolean
        }

        # Add attachments if any.
        attachments = deployment.get_attachment_objects_from_dict(submission_json)
        for attachment in attachments:
            key_ = f'instance_attachments[{attachment.media_file_basename}]'
            data[key_] = reverse(
                'attachment-detail',
                args=(self.asset.uid, submission_id, attachment.pk),
                request=request,
            )

        response = requests.post(
            f'{settings.ENKETO_URL}/{enketo_endpoint}',
            # bare tuple implies basic auth
            auth=(settings.ENKETO_API_TOKEN, ''),
            data=data
        )
        if response.status_code != status.HTTP_201_CREATED:
            # Some Enketo errors are useful to the client. Attempt to pass them
            # along if possible
            try:
                parsed_resp = response.json()
            except ValueError:
                parsed_resp = None
            if parsed_resp and 'message' in parsed_resp:
                message = parsed_resp['message']
            else:
                message = response.reason
            return Response(
                # This doesn't seem worth translating
                {'detail': 'Enketo error: ' + message},
                status=response.status_code,
            )

        json_response = response.json()
        enketo_url = json_response.get(f'{action_}_url')

        return Response({'url': enketo_url})
