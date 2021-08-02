# -*- coding: utf-8 -*-
from django.core.exceptions import ObjectDoesNotExist
from django.http import Http404, HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _
from rest_framework import viewsets, renderers
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.deployment_backends.kc_access.shadow_models import (
    ReadOnlyKobocatAttachment,
)
from kpi.filters import AttachmentFilter
from kpi.models.asset import Asset
from kpi.renderers import MediaFileRenderer
from kpi.serializers.v2.gallery import (
    AttachmentSerializer,
    AttachmentListSerializer,
    AttachmentPagination,
    QuestionSerializer,
    QuestionPagination,
    SubmissionSerializer,
    SubmissionPagination,
)


class AttachmentViewSet(NestedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    lookup_field = 'pk'
    serializer_class = AttachmentSerializer
    filter_backends = (AttachmentFilter,)
    renderer_classes = (
        renderers.JSONRenderer,
        renderers.BrowsableAPIRenderer,
        MediaFileRenderer
    )

    def _group_by(self):
        if not self.request:
            return None
        return self.request.query_params.get('group_by')

    def get_serializer_class(self):
        if self.action == 'list':
            if self._group_by() == 'question':
                return QuestionSerializer
            if self._group_by() == 'submission':
                return SubmissionSerializer
            return AttachmentListSerializer
        else:
            return AttachmentSerializer

    def get_serializer_context(self):
        _asset_uid = self.get_parents_query_dict()['asset']
        return {'request': self.request,
                'asset': _asset_uid,
                'group_by': self._group_by()}

    def get_queryset(self):
        _asset_uid = self.get_parents_query_dict()['asset']
        try:
            asset = Asset.objects.get(uid=_asset_uid)
        except ObjectDoesNotExist:
            asset = None
        if not asset or not asset.has_deployment:
            raise Http404
        xform_id = asset.deployment.identifier.split('/')[-1]
        return ReadOnlyKobocatAttachment.objects.filter(instance__xform__id_string=xform_id)

    def get_paginator(self):
        if self._group_by() and self._group_by() == 'question':
            paginator = QuestionPagination()
        elif self._group_by() and self._group_by() == 'submission':
            paginator = SubmissionPagination()
        else:
            paginator = AttachmentPagination()
        return paginator

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        index = request.query_params.get('index')
        if index:
            try:
                index = int(index)
                queryset = queryset[index]
            except (ValueError, IndexError):
                raise Http404(_("Index '%s' out of range" % index))

        is_many = False if index is not None else True
        paginator = self.get_paginator() if is_many else None
        if paginator:
            page = paginator.paginate_queryset(queryset, request)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return paginator.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=is_many)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        self.object = self.get_object()
        serializer = self.get_serializer(self.object)

        if hasattr(request, 'accepted_renderer'):
            if isinstance(request.accepted_renderer, MediaFileRenderer) \
                    and self.object.media_file is not None:
                data = self.object.media_file.read()

                return Response(data, content_type=self.object.mimetype)

        filename = request.query_params.get('filename')
        if filename:
            source = None
            if filename == self.object.media_file.name \
                    or filename == self.object.filename:
                size = request.query_params.get('size')
                if size == 'small':
                    source = serializer.get_small_download_url(self.object)
                elif size == 'medium':
                    source = serializer.get_medium_download_url(self.object)
                elif size == 'large':
                    source = serializer.get_large_download_url(self.object)
                else:
                    source = serializer.get_download_url(self.object)
            if source:
                return HttpResponseRedirect(source)
            else:
                raise Http404(_("Filename '%s' not found." % filename))

        return Response(serializer.data)
