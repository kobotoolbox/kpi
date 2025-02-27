from typing import Union

from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext as t
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError
from rest_framework.response import Response
from rest_framework.settings import api_settings

from kobo.apps.openrosa.apps.api.permissions import XFormDataPermissions
from kobo.apps.openrosa.apps.api.tools import add_tags_to_instance
from kobo.apps.openrosa.apps.api.viewsets.xform_viewset import custom_response_handler
from kobo.apps.openrosa.apps.logger.models.instance import Instance
from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.openrosa.libs import filters
from kobo.apps.openrosa.libs.mixins.anonymous_user_public_forms_mixin import (
    AnonymousUserPublicFormsMixin,
)
from kobo.apps.openrosa.libs.renderers import renderers
from kobo.apps.openrosa.libs.serializers.data_serializer import (
    DataInstanceSerializer,
    DataListSerializer,
    DataSerializer,
)
from ..utils.rest_framework.viewsets import OpenRosaModelViewSet

SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']


class DataViewSet(AnonymousUserPublicFormsMixin, OpenRosaModelViewSet):

    """
    This endpoint provides access to submitted data in JSON format. Where:

    * `pk` - the form unique identifier
    * `dataid` - submission data unique identifier
    * `owner` - username of the owner of the data point

    ## GET JSON List of data end points

    Lists the data endpoints accessible to requesting user, for anonymous access
    a list of public data endpoints is returned.

    <pre class="prettyprint">
    <b>GET</b> /api/v1/data
    </pre>

    > Example
    >
    >       curl -X GET https://example.com/api/v1/data

    > Response
    >
    >        [{
    >            "id": 4240,
    >            "id_string": "dhis2form"
    >            "title": "dhis2form"
    >            "description": "dhis2form"
    >            "url": "https://example.com/api/v1/data/4240"
    >         },
    >            ...
    >        ]

    ## Download data in `csv` format
    <pre class="prettyprint">
    <b>GET</b> /api/v1/data.csv</pre>
    >
    >       curl -O https://example.com/api/v1/data.csv

    ## GET JSON List of data end points filter by owner

    Lists the data endpoints accessible to requesting user, for the specified
    `owner` as a query parameter.

    <pre class="prettyprint">
    <b>GET</b> /api/v1/data?<code>owner</code>=<code>owner_username</code>
    </pre>

    > Example
    >
    >       curl -X GET https://example.com/api/v1/data?owner=ona

    ## Get Submitted data for a specific form
    Provides a list of json submitted data for a specific form.
    <pre class="prettyprint">
    <b>GET</b> /api/v1/data/<code>{pk}</code></pre>
    > Example
    >
    >       curl -X GET https://example.com/api/v1/data/22845

    > Response
    >
    >        [
    >            {
    >                "_id": 4503,
    >                "expense_type": "service",
    >                "_xform_id_string": "exp",
    >                "_geolocation": [
    >                    null,
    >                    null
    >                ],
    >                "end": "2013-01-03T10:26:25.674+03",
    >                "start": "2013-01-03T10:25:17.409+03",
    >                "expense_date": "2011-12-23",
    >                "_status": "submitted_via_web",
    >                "today": "2013-01-03",
    >                "_uuid": "2e599f6fe0de42d3a1417fb7d821c859",
    >                "imei": "351746052013466",
    >                "formhub/uuid": "46ea15e2b8134624a47e2c4b77eef0d4",
    >                "kind": "monthly",
    >                "_submission_time": "2013-01-03T02:27:19",
    >                "required": "yes",
    >                "_attachments": [],
    >                "item": "Rent",
    >                "amount": "35000.0",
    >                "deviceid": "351746052013466",
    >                "subscriberid": "639027...60317"
    >            },
    >            {
    >                ....
    >                "subscriberid": "639027...60317"
    >            }
    >        ]

    ## Get a single data submission for a given form

    Get a single specific submission json data providing `pk`
     and `dataid` as url path parameters, where:

    * `pk` - is the identifying number for a specific form
    * `dataid` - is the unique id of the data, the value of `_id` or `_uuid`

    <pre class="prettyprint">
    <b>GET</b> /api/v1/data/<code>{pk}</code>/<code>{dataid}</code></pre>
    > Example
    >
    >       curl -X GET https://example.com/api/v1/data/22845/4503

    > Response
    >
    >            {
    >                "_id": 4503,
    >                "expense_type": "service",
    >                "_xform_id_string": "exp",
    >                "_geolocation": [
    >                    null,
    >                    null
    >                ],
    >                "end": "2013-01-03T10:26:25.674+03",
    >                "start": "2013-01-03T10:25:17.409+03",
    >                "expense_date": "2011-12-23",
    >                "_status": "submitted_via_web",
    >                "today": "2013-01-03",
    >                "_uuid": "2e599f6fe0de42d3a1417fb7d821c859",
    >                "imei": "351746052013466",
    >                "formhub/uuid": "46ea15e2b8134624a47e2c4b77eef0d4",
    >                "kind": "monthly",
    >                "_submission_time": "2013-01-03T02:27:19",
    >                "required": "yes",
    >                "_attachments": [],
    >                "item": "Rent",
    >                "amount": "35000.0",
    >                "deviceid": "351746052013466",
    >                "subscriberid": "639027...60317"
    >            },
    >            {
    >                ....
    >                "subscriberid": "639027...60317"
    >            }
    >        ]

    ## Query submitted data of a specific form
    Provides a list of json submitted data for a specific form. Use `query`
    parameter to apply form data specific, see
    <a href="http://docs.mongodb.org/manual/reference/operator/query/">
    http://docs.mongodb.org/manual/reference/operator/query/</a>.

    For more details see
    <a href="https://github.com/modilabs/formhub/wiki/Formhub-Access-Points-(API)#
    api-parameters">
    API Parameters</a>.
    <pre class="prettyprint">
    <b>GET</b> /api/v1/data/<code>{pk}</code>?query={"field":"value"}</b>
    <b>GET</b> /api/v1/data/<code>{pk}</code>?query={"field":{"op": "value"}}"</b>
    </pre>
    > Example
    >
    >       curl -X GET 'https://example.com/api/v1/data/22845?query={"kind": \
    "monthly"}'
    >       curl -X GET 'https://example.com/api/v1/data/22845?query={"date": \
    {"$gt": "2014-09-29T01:02:03+0000"}}'

    > Response
    >
    >        [
    >            {
    >                "_id": 4503,
    >                "expense_type": "service",
    >                "_xform_id_string": "exp",
    >                "_geolocation": [
    >                    null,
    >                    null
    >                ],
    >                "end": "2013-01-03T10:26:25.674+03",
    >                "start": "2013-01-03T10:25:17.409+03",
    >                "expense_date": "2011-12-23",
    >                "_status": "submitted_via_web",
    >                "today": "2013-01-03",
    >                "_uuid": "2e599f6fe0de42d3a1417fb7d821c859",
    >                "imei": "351746052013466",
    >                "formhub/uuid": "46ea15e2b8134624a47e2c4b77eef0d4",
    >                "kind": "monthly",
    >                "_submission_time": "2013-01-03T02:27:19",
    >                "required": "yes",
    >                "_attachments": [],
    >                "item": "Rent",
    >                "amount": "35000.0",
    >                "deviceid": "351746052013466",
    >                "subscriberid": "639027...60317"
    >            },
    >            {
    >                ....
    >                "subscriberid": "639027...60317"
    >            }
    >        ]

    ## Query submitted data of a specific form using Tags
    Provides a list of json submitted data for a specific form matching specific
    tags. Use the `tags` query parameter to filter the list of forms, `tags`
    should be a comma separated list of tags.

    <pre class="prettyprint">
    <b>GET</b> /api/v1/data?<code>tags</code>=<code>tag1,tag2</code></pre>
    <pre class="prettyprint">
    <b>GET</b> /api/v1/data/<code>{pk}</code>?<code>tags\
    </code>=<code>tag1,tag2</code></pre>

    > Example
    >
    >       curl -X GET https://example.com/api/v1/data/22845?tags=monthly

    ## Tag a submission data point

    A `POST` payload of parameter `tags` with a comma separated list of tags.

    Examples

    - `animal fruit denim` - space delimited, no commas
    - `animal, fruit denim` - comma delimited

    <pre class="prettyprint">
    <b>POST</b> /api/v1/data/<code>{pk}</code>/<code>{dataid}</code>/labels</pre>

    Payload

        {"tags": "tag1, tag2"}

    ## Delete a specific tag from a submission

    <pre class="prettyprint">
    <b>DELETE</b> /api/v1/data/<code>{pk}</code>/<code>\
    {dataid}</code>/labels/<code>tag_name</code></pre>

    > Request
    >
    >       curl -X DELETE \
    https://example.com/api/v1/data/28058/20/labels/tag1
    or to delete the tag "hello world"
    >
    >       curl -X DELETE \
    https://example.com/api/v1/data/28058/20/labels/hello%20world
    >
    > Response
    >
    >        HTTP 200 OK
    """
    renderer_classes = api_settings.DEFAULT_RENDERER_CLASSES + [
        renderers.XLSRenderer,
        renderers.XLSXRenderer,
        renderers.CSVRenderer,
        renderers.RawXMLRenderer
    ]

    content_negotiation_class = renderers.InstanceContentNegotiation
    filter_backends = (filters.RowLevelObjectPermissionFilter,
                       filters.XFormOwnerFilter)
    permission_classes = (XFormDataPermissions,)
    lookup_field = 'pk'
    lookup_fields = ('pk', 'dataid')
    extra_lookup_fields = None
    queryset = XForm.objects.all()

    def get_serializer_class(self):
        pk_lookup, dataid_lookup = self.lookup_fields
        pk = self.kwargs.get(pk_lookup)
        dataid = self.kwargs.get(dataid_lookup)
        if pk is not None and dataid is None:
            serializer_class = DataListSerializer
        elif pk is not None and dataid is not None:
            serializer_class = DataInstanceSerializer
        else:
            serializer_class = DataSerializer

        return serializer_class

    def get_object(self) -> Union[XForm, Instance]:
        """
        Return a `XForm` object or a `Instance` object if its primary key is
        present in the url. If no results are found, a HTTP 404 error is raised
        """
        xform = super().get_object()
        pk_lookup, dataid_lookup = self.lookup_fields
        pk = self.kwargs.get(pk_lookup)
        dataid = self.kwargs.get(dataid_lookup)

        if pk is None or dataid is None:
            return xform

        try:
            int(pk)
        except ValueError:
            raise ParseError(t('Invalid pk `%(pk)s`' % {'pk': pk}))
        try:
            int(dataid)
        except ValueError:
            raise ParseError(t('Invalid dataid `%(dataid)s`' % {'dataid': dataid}))

        return get_object_or_404(Instance, pk=dataid, xform__pk=pk)

    def _get_public_forms_queryset(self):
        return XForm.objects.filter(Q(shared=True) | Q(shared_data=True))

    def _filtered_or_shared_qs(self, qs, pk):
        filter_kwargs = {self.lookup_field: pk}
        qs = qs.filter(**filter_kwargs)

        if not qs:
            filter_kwargs['shared_data'] = True
            qs = XForm.objects.filter(**filter_kwargs)
            if not qs:
                raise Http404(t('No data matches with given query.'))

        return qs

    def filter_queryset(self, queryset, view=None):
        qs = super().filter_queryset(queryset)
        pk = self.kwargs.get(self.lookup_field)
        tags = self.request.query_params.get('tags', None)

        if tags and isinstance(tags, str):
            tags = tags.split(',')
            qs = qs.filter(tags__name__in=tags).distinct()

        if pk:
            try:
                int(pk)
            except ValueError:
                raise ParseError(t('Invalid pk %(pk)s' % {'pk': pk}))
            else:
                qs = self._filtered_or_shared_qs(qs, pk)

        return qs

    @action(
        detail=True,
        methods=['GET', 'POST', 'DELETE'],
        extra_lookup_fields=['label'],
    )
    def labels(self, request, *args, **kwargs):
        http_status = status.HTTP_400_BAD_REQUEST
        instance = self.get_object()

        if request.method == 'POST':
            if add_tags_to_instance(request, instance):
                http_status = status.HTTP_201_CREATED

        tags = instance.tags
        label = kwargs.get('label', None)

        if request.method == 'GET' and label:
            data = [tag['name'] for tag in
                    tags.filter(name=label).values('name')]

        elif request.method == 'DELETE' and label:
            count = tags.count()
            tags.remove(label)

            # Accepted, label does not exist hence nothing removed
            http_status = status.HTTP_200_OK if count == tags.count() \
                else status.HTTP_404_NOT_FOUND

            data = list(tags.names())
        else:
            data = list(tags.names())

        if request.method == 'GET':
            http_status = status.HTTP_200_OK

        return Response(data, status=http_status)

    def retrieve(self, request, *args, **kwargs):
        # XML rendering does not a serializer
        if request.accepted_renderer.format == 'xml':
            instance = self.get_object()
            return Response(instance.xml)
        else:
            return super().retrieve(request, *args, **kwargs)

    def list(self, request, *args, **kwargs):
        lookup_field = self.lookup_field
        lookup = self.kwargs.get(lookup_field)

        if lookup_field not in kwargs.keys():
            self.object_list = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(self.object_list, many=True)

            return Response(serializer.data)

        xform = self.get_object()
        query = request.GET.get('query', {})
        export_type = kwargs.get('format')
        if export_type is None or export_type in ['json']:
            # perform default viewset retrieve, no data export

            # With DRF ListSerializer are automatically created and wraps
            # everything in a list. Since this returns a list
            # # already, we unwrap it.
            res = super().list(request, *args, **kwargs)
            res.data = res.data[0]
            return res

        return custom_response_handler(request, xform, query, export_type)
