# -*- coding: utf-8 -*-
from functools import reduce
from collections import OrderedDict

from rest_framework import serializers
from rest_framework.pagination import LimitOffsetPagination, _positive_int
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework.utils.urls import replace_query_param, remove_query_param

from kpi.deployment_backends.kc_access.shadow_models import ReadOnlyKobocatAttachment
from kpi.deployment_backends.kc_access.utils import check_obj


def dict_key_for_value(_dict, value):
    """
    This function is used to get key by value in a dictionary
    """
    return _dict.keys()[_dict.values().index(value)]


def get_path(data, question_name, path_list=[]):
    name = data.get('name')
    if name == question_name:
        return '/'.join(path_list)
    elif data.get('children') is not None:
        for node in data.get('children'):
            path_list.append(node.get('name'))
            path = get_path(node, question_name, path_list)
            if path is not None:
                return path
            else:
                del path_list[len(path_list) - 1]
    return None


class HybridPagination(LimitOffsetPagination):
    max_limit = 100
    default_limit = max_limit
    page_query_param = 'page'
    page_size_query_param = 'page_size'

    def paginate_queryset(self, queryset, request, view=None):
        self.page = self.get_page(request)
        return super(HybridPagination, self).paginate_queryset(
            queryset, request, view
        )

    def get_paginated_response(self, data):
        return Response(OrderedDict([
            ('count', self.count),
            ('next', self.get_next_link()),
            ('next_page', self.get_next_page()),
            ('previous', self.get_previous_link()),
            ('previous_page', self.get_previous_page()),
            ('results', data)
        ]))

    def get_limit(self, request):
        # Handles case where API request specifies page_size instead of limit
        if self.limit_query_param not in request.query_params:
            try:
                return _positive_int(
                    request.query_params[self.page_size_query_param],
                    cutoff=self.max_limit
                )
            except (KeyError, ValueError):
                pass

        return super(HybridPagination, self).get_limit(request)

    def get_offset(self, request):
        # Handles case where API request specifies page instead of offset
        if self.offset_query_param not in request.query_params:
            try:
                page = _positive_int(
                    request.query_params[self.page_query_param],
                    strict=True
                )
                limit = self.get_limit(request)
                return (page-1) * limit
            except (KeyError, ValueError):
                pass
        return super(HybridPagination, self).get_offset(request)

    def get_page(self, request):
        # Parse the page number if provided in the query request
        if self.page_query_param in request.query_params:
            try:
                return _positive_int(
                    request.query_params[self.page_query_param],
                    strict=True
                )
            except (KeyError, ValueError):
                pass

        limit = self.get_limit(request)
        offset = self.get_offset(request)
        return int(offset / limit) + 1

    def get_next_link(self):
        next_link = super(HybridPagination, self).get_next_link()
        if next_link:
            next_link = remove_query_param(next_link, self.page_query_param)
            next_link = remove_query_param(next_link, self.page_size_query_param)

        return next_link

    def get_previous_link(self):
        prev_link = super(HybridPagination, self).get_previous_link()
        if prev_link:
            prev_link = remove_query_param(prev_link, self.page_query_param)
            prev_link = remove_query_param(prev_link, self.page_size_query_param)

        return prev_link

    def get_next_page(self):
        next_page = self.get_next_link()
        if next_page:
            next_page = remove_query_param(next_page, self.limit_query_param)
            next_page = remove_query_param(next_page, self.offset_query_param)
            next_page = replace_query_param(
                next_page, self.page_query_param, self.page + 1
            )
            if self.limit != self.default_limit:
                next_page = replace_query_param(
                    next_page, self.page_size_query_param, self.limit
                )

        return next_page

    def get_previous_page(self):
        prev_page = super(HybridPagination, self).get_previous_link()
        if prev_page:
            prev_page = remove_query_param(prev_page, self.limit_query_param)
            prev_page = remove_query_param(prev_page, self.offset_query_param)
            if self.page > 1:
                prev_page = replace_query_param(
                    prev_page, self.page_query_param, self.page - 1
                )
            if self.limit != self.default_limit:
                prev_page = replace_query_param(
                    prev_page, self.page_size_query_param, self.limit
                )

        return prev_page

    def get_html_context(self):
        html_json = super(HybridPagination, self).get_html_context()
        for (i, page_link) in enumerate(html_json['page_links']):
            link = remove_query_param(page_link.url, self.page_query_param)
            link = remove_query_param(link, self.page_size_query_param)
            link = replace_query_param(link, self.limit_query_param, self.limit)
            html_json['page_links'][i] = page_link._replace(url=link)

        return html_json


class AttachmentSerializer(serializers.ModelSerializer):

    url = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()
    small_download_url = serializers.SerializerMethodField()
    medium_download_url = serializers.SerializerMethodField()
    large_download_url = serializers.SerializerMethodField()
    filename = serializers.ReadOnlyField(source='media_file.name')
    short_filename = serializers.SerializerMethodField()
    question = serializers.SerializerMethodField()
    submission = serializers.SerializerMethodField()
    can_view_submission = serializers.SerializerMethodField()

    class Meta:
        fields = (
            'url',
            'filename',
            'short_filename',
            'mimetype',
            'id',
            'submission',
            'can_view_submission',
            'question',
            'download_url',
            'small_download_url',
            'medium_download_url',
            'large_download_url',
        )
        lookup_field = 'pk'
        model = ReadOnlyKobocatAttachment

    def get_short_filename(self, obj):
        return obj.filename

    def get_question(self, obj):
        return obj.question

    def get_submission(self, obj):
        return self._get_submission(obj)

    def get_can_view_submission(self, obj):
        # Kept for retro-compability with the front-end
        # Attachments are narrowed down in the `AttachmentFilter` so
        # submission should be visible all the time.
        return True

    def get_url(self, obj):
        asset_uid = self.context.get('asset_uid')
        url = reverse(
            'asset-gallery-attachment-detail',
            args=(
                asset_uid,
                obj.id,
            ),
            request=self.context.get('request', None),
        )
        return url

    def get_download_url(self, obj):
        return self._get_download_url(obj, 'original')

    def get_small_download_url(self, obj):
        return self._get_download_url(obj, 'small')

    def get_medium_download_url(self, obj):
        return self._get_download_url(obj, 'medium')

    def get_large_download_url(self, obj):
        return self._get_download_url(obj, 'large')

    def _get_download_url(self, obj, size):
        if not obj.media_file:
            return None

        submission = self._get_submission(obj)
        try:
            attachments = submission['_attachments']
        except KeyError:
            return None

        for attachment in attachments:
            if int(attachment['id']) != int(obj.id):
                continue
            try:
                return attachment[f'download_{size}_url']
            except KeyError:
                return None

    def _get_submission(self, obj):
        asset = self.context['asset']
        request = self.context['request']

        if not hasattr(obj, 'submission'):
            submission = asset.deployment.get_submission(
                submission_id=obj.instance.pk,
                user=request.user,
                request=request,
            )
            setattr(obj, 'submission', submission)

        return obj.submission


class AttachmentListSerializer(AttachmentSerializer):

    class Meta(AttachmentSerializer.Meta):
        fields = (
            'url',
            'filename',
            'short_filename',
            'mimetype',
            'id',
            'submission',
            'can_view_submission',
            'question',
            'download_url',
            'small_download_url',
            'medium_download_url',
            'large_download_url',
        )

    @check_obj
    def get_download_url(self, obj):
        url = self.get_url(obj)
        if url:
            return super(AttachmentListSerializer, self).get_download_url(obj)
        return None

    def to_representation(self, obj):
        rep = super(AttachmentListSerializer, self).to_representation(obj)
        return rep


class AttachmentPagination(HybridPagination):
    default_limit = 10


class QuestionSerializer(serializers.Serializer):
    index = serializers.IntegerField(read_only=True)
    number = serializers.IntegerField(read_only=True)
    type = serializers.CharField(read_only=True)
    name = serializers.CharField(read_only=True)
    label = serializers.CharField(read_only=True)
    url = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()

    def get_url(self, qdict):
        request = self.context.get('request', None)
        if not request:
            return None
        url = request.build_absolute_uri()
        url = remove_query_param(url, 'limit')
        url = remove_query_param(url, 'offset')
        url = remove_query_param(url, 'page')
        url = remove_query_param(url, 'page_size')
        return replace_query_param(url, 'index', qdict['index'])

    def get_attachments(self, qdict):
        paginator = HybridPagination()
        paginator.default_limit = 5
        page = paginator.paginate_queryset(
            queryset=qdict['attachments'],
            request=self.context.get('request', None)
        )
        serializer = AttachmentListSerializer(
            page, many=True, read_only=True, context=self.context)

        attachments = OrderedDict([
            ('count', paginator.count),
            ('next', paginator.get_next_link()),
            ('next_page', paginator.get_next_page()),
            ('previous', paginator.get_previous_link()),
            ('previous_page', paginator.get_previous_page()),
            ('results', serializer.data)
        ])
        if attachments['next']:
            attachments['next'] = replace_query_param(
                attachments['next'], 'index', qdict['index']
            )
        if attachments['next_page']:
            attachments['next_page'] = replace_query_param(
                attachments['next_page'], 'index', qdict['index']
            )
        if attachments['previous']:
            attachments['previous'] = replace_query_param(
                attachments['previous'], 'index', qdict['index']
            )
        if attachments['previous_page']:
            attachments['previous_page'] = replace_query_param(
                attachments['previous_page'], 'index', qdict['index']
            )

        return attachments


class QuestionPagination(HybridPagination):
    # Not really a paginator

    def paginate_queryset(self, queryset, request, view=None):
        self.attachments_count = self.get_attachments_count(queryset)
        return queryset

    def get_paginated_response(self, data):
        return Response(OrderedDict([
            ('count', len(data)),
            ('attachments_count', self.attachments_count),
            ('results', data)
        ]))

    def get_attachments_count(self, queryset):
        if len(queryset):
            return reduce(
                lambda x, y: x + y,
                map(lambda question: len(question['attachments']), queryset),
            )
        else:
            return 0


class SubmissionSerializer(serializers.Serializer):

    index = serializers.IntegerField(read_only=True)
    instance_uuid = serializers.CharField(read_only=True)
    username = serializers.CharField(read_only=True)
    xform_id = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    date_created = serializers.DateTimeField(read_only=True)
    date_modified = serializers.DateTimeField(read_only=True)
    url = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()

    def get_url(self, sdict):
        request = self.context.get('request', None)
        if not request:
            return None
        url = request.build_absolute_uri()
        url = remove_query_param(url, 'limit')
        url = remove_query_param(url, 'offset')
        url = remove_query_param(url, 'page')
        url = remove_query_param(url, 'page_size')
        return replace_query_param(url, 'index', sdict['index'])

    def get_attachments(self, sdict):
        serializer = AttachmentListSerializer(
            sdict['attachments'],
            many=True,
            read_only=True,
            context=self.context,
        )
        return OrderedDict([
            ('count', len(sdict['attachments'])),
            ('results', serializer.data)
        ])


class SubmissionPagination(HybridPagination):
    default_limit = 5

    def paginate_queryset(self, queryset, request, view=None):
        self.attachments_count = self.get_attachments_count(queryset)
        return super(SubmissionPagination, self).paginate_queryset(
            queryset, request, view
        )

    def get_paginated_response(self, data):
        return Response(OrderedDict([
            ('count', self.count),
            ('next', self.get_next_link()),
            ('next_page', self.get_next_page()),
            ('previous', self.get_previous_link()),
            ('previous_page', self.get_previous_page()),
            ('attachments_count', self.attachments_count),
            ('results', data)
        ]))

    def get_attachments_count(self, queryset):

        if len(queryset):
            return reduce(
                lambda x, y: x + y,
                map(lambda question: len(question['attachments']), queryset),
            )
        else:
            return 0
