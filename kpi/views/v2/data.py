# -*- coding: utf-8 -*-
from __future__ import unicode_literals, absolute_import

from django.conf import settings
from django.http import Http404
from django.utils.translation import ugettext_lazy as _
from rest_framework import exceptions, renderers, serializers, viewsets
from rest_framework.decorators import detail_route, list_route
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.models import Asset
from kpi.paginators import DataPagination
from kpi.permissions import (
    EditSubmissionPermission,
    SubmissionPermission,
    SubmissionValidationStatusPermission,
)
from kpi.renderers import SubmissionXMLRenderer
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class DataViewSet(AssetNestedObjectViewsetMixin, NestedViewSetMixin,
                  viewsets.GenericViewSet):
    """
    ## List of submissions for a specific asset

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data/
    </pre>

    By default, JSON format is used but XML format can be used too.
    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data.xml
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data.json
    </pre>

    or

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data/?format=xml
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data/?format=json
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/

    ## CRUD

    * `uid` - is the unique identifier of a specific asset
    * `id` - is the unique identifier of a specific submission

    **It's not allowed to create submissions with `kpi`'s API**

    Retrieves current submission
    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{uid}</code>/data/<code>{id}</code>/
    </pre>

    It's also possible to specify the format.

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

    _It's not possible to update a submission directly with `kpi`'s API.
    Instead, it returns the link where the instance can be opened for edition._

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{uid}</code>/data/<code>{id}</code>/edit/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/234/edit/


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

        - `validation_status_approved`
        - `validation_status_not_approved`
        - `validation_status_on_hold`

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
    >           "submissions_ids": [{integer}],
    >           "validation_status.uid": <validation_status>
    >        }


    ### CURRENT ENDPOINT
    """

    parent_model = Asset
    renderer_classes = (renderers.BrowsableAPIRenderer,
                        renderers.JSONRenderer,
                        SubmissionXMLRenderer
                        )
    permission_classes = (SubmissionPermission,)
    pagination_class = DataPagination

    def _get_deployment(self):
        """
        Returns the deployment for the asset specified by the request
        """
        if not self.asset.has_deployment:
            raise serializers.ValidationError(
                _('The specified asset has not been deployed'))
        return self.asset.deployment

    @list_route(methods=['DELETE'], renderer_classes=[renderers.JSONRenderer])
    def bulk(self, request, *args, **kwargs):
        deployment = self._get_deployment()
        json_response = deployment.delete_submissions(request.data,
                                                      request.user)
        return Response(**json_response)

    def destroy(self, request, *args, **kwargs):
        deployment = self._get_deployment()
        pk = kwargs.get("pk")
        json_response = deployment.delete_submission(pk, user=request.user)
        return Response(**json_response)

    @detail_route(methods=['GET'], renderer_classes=[renderers.JSONRenderer],
                  permission_classes=[EditSubmissionPermission])
    def edit(self, request, pk, *args, **kwargs):
        deployment = self._get_deployment()
        json_response = deployment.get_submission_edit_url(pk,
                                                           user=request.user,
                                                           params=request.GET)
        return Response(**json_response)

    def list(self, request, *args, **kwargs):
        format_type = kwargs.get('format', request.GET.get('format', 'json'))
        deployment = self._get_deployment()
        filters = self._filter_mongo_query(request)
        submissions = deployment.get_submissions(format_type=format_type, **filters)
        # Create a dummy list to let the Paginator do all the calculation
        # for pagination because it does not need the list of real objects.
        # It avoids to retrieve all the objects from MongoDB
        dummy_submissions_list = [None] * deployment.current_submissions_count
        page = self.paginate_queryset(dummy_submissions_list)
        if page is not None:
            return self.get_paginated_response(submissions)

        return Response(list(submissions))

    def retrieve(self, request, pk, *args, **kwargs):
        format_type = kwargs.get('format', request.GET.get('format', 'json'))
        deployment = self._get_deployment()
        filters = self._filter_mongo_query(request)
        submission = deployment.get_submission(pk, format_type=format_type, **filters)
        if not submission:
            raise Http404
        return Response(submission)

    @detail_route(methods=['GET', 'PATCH', 'DELETE'],
                  renderer_classes=[renderers.JSONRenderer],
                  permission_classes=[SubmissionValidationStatusPermission])
    def validation_status(self, request, pk, *args, **kwargs):
        deployment = self._get_deployment()
        if request.method == 'GET':
            json_response = deployment.get_validation_status(pk, request.GET, request.user)
        else:
            json_response = deployment.set_validation_status(pk,
                                                             request.data,
                                                             request.user,
                                                             request.method)

        return Response(**json_response)

    @list_route(methods=['PATCH', 'DELETE'],
                renderer_classes=[renderers.JSONRenderer],
                permission_classes=[SubmissionValidationStatusPermission])
    def validation_statuses(self, request, *args, **kwargs):
        deployment = self._get_deployment()
        json_response = deployment.set_validation_statuses(request.data,
                                                           request.user,
                                                           request.method)

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
            limit = int(limit)
        except ValueError:
            raise exceptions.ValidationError(
                {'limit': _('A valid integer is required')}
            )
        filters['limit'] = min(limit, settings.SUBMISSION_LIST_LIMIT)
        permission_filters = self.asset.get_filters_for_partial_perm(request.user.id)

        # This should overwrite existing `permission_filters` param.
        # We don't want users to bypass their partial permissions filters.
        filters.update({
            'permission_filters': permission_filters
        })
        return filters
