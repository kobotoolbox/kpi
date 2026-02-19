from xml.dom import NotFoundErr

from django.conf import settings
from django.core.files import File
from django.core.validators import ValidationError
from django.http import Http404
from django.utils.translation import gettext as t
from drf_spectacular.utils import extend_schema
from rest_framework import exceptions, mixins, permissions, status
from rest_framework.decorators import action
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response

from kobo.apps.openrosa.apps.api.permissions import AssetObjectPermissions
from kobo.apps.openrosa.apps.api.tools import get_media_file_response
from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kobo.apps.openrosa.apps.logger.models.instance import Instance
from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.openrosa.apps.main.models.meta_data import MetaData
from kobo.apps.openrosa.libs import filters
from kobo.apps.openrosa.libs.mixins.openrosa_headers_mixin import OpenRosaHeadersMixin
from kobo.apps.openrosa.libs.renderers.renderers import TemplateXMLRenderer
from kobo.apps.openrosa.libs.serializers.xform_serializer import (
    XFormListSerializer,
    XFormManifestSerializer,
)
from kobo.apps.openrosa.libs.utils.logger_tools import (
    get_instance_or_404,
    publish_form,
    publish_xml_form,
)
from kpi.authentication import DigestAuthentication
from ..utils.rest_framework.viewsets import OpenRosaGenericViewSet


def _extract_uuid(text):
    if isinstance(text, str):
        form_id_parts = text.split('/')

        if form_id_parts.__len__() < 2:
            raise ValidationError(t('Invalid formId %s.' % text))

        text = form_id_parts[1]
        at_key_position = text.find('@key=')
        text = text[at_key_position:-1].replace('@key=', '')

        if text.startswith('uuid:'):
            text = text.replace('uuid:', '')

    return text


def _extract_id_string(form_id):
    if isinstance(form_id, str):
        return form_id[0:form_id.find('[')]

    return form_id


def _parse_int(num):
    try:
        return num and int(num)
    except ValueError:
        pass


class DoXmlFormUpload:

    def __init__(self, xml_file, user):
        self.xml_file = xml_file
        self.user = user

    def publish(self):
        return publish_xml_form(self.xml_file, self.user)


@extend_schema(
    tags=['Briefcase'],
    exclude=True,
)
class BriefcaseApi(
    OpenRosaHeadersMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    OpenRosaGenericViewSet,
):
    """
    Implements the [Briefcase Aggregate API](\
    https://code.google.com/p/opendatakit/wiki/BriefcaseAggregateAPI).
    """
    filter_backends = (filters.AnonDjangoObjectPermissionFilter,)
    queryset = XForm.objects.all()
    permission_classes = (permissions.IsAuthenticated, AssetObjectPermissions)
    renderer_classes = (TemplateXMLRenderer,)
    serializer_class = XFormListSerializer
    template_name = 'openrosa_response.xml'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Respect DEFAULT_AUTHENTICATION_CLASSES, but also ensure that the
        # previously hard-coded authentication classes are included first
        authentication_classes = [
            DigestAuthentication,
        ]
        self.authentication_classes = authentication_classes + [
            auth_class
            for auth_class in self.authentication_classes
            if auth_class not in authentication_classes
        ]

    def get_object(self):
        form_id = self.request.GET.get('formId', '')
        id_string = _extract_id_string(form_id)
        uuid = _extract_uuid(form_id)

        obj = get_instance_or_404(
            xform__id_string=id_string,
            uuid=uuid,
        )
        self.check_object_permissions(self.request, obj.xform.asset)

        return obj

    def filter_queryset(self, queryset):
        username = self.kwargs.get('username')
        if username is None:
            # Briefcase does not allow anonymous access, user should always be
            # authenticated
            if self.request.user.is_anonymous:
                # raises a permission denied exception, forces authentication
                self.permission_denied(self.request)
            else:
                # Return all the forms the currently-logged-in user can access,
                # including those shared by other users
                queryset = super().filter_queryset(queryset)
        else:
            # With the advent of project-level anonymous access in #904, Briefcase
            # requests must no longer use endpoints whose URLs contain usernames.
            # Ideally, Briefcase would display error messages returned by this method,
            # but sadly that is not the case.
            # Raise an empty PermissionDenied since it's impossible to have
            # Briefcase display any guidance.
            raise exceptions.PermissionDenied()

        form_id = self.request.GET.get('formId', '')

        if form_id.find('[') != -1:
            form_id = _extract_id_string(form_id)

        xform = get_object_or_404(queryset, id_string=form_id)
        self.check_object_permissions(self.request, xform.asset)
        instances = Instance.objects.filter(xform=xform).order_by('pk')
        num_entries = self.request.GET.get('numEntries')
        cursor = self.request.GET.get('cursor')

        cursor = _parse_int(cursor)
        if cursor:
            instances = instances.filter(pk__gt=cursor)

        num_entries = _parse_int(num_entries)
        if num_entries:
            instances = instances[:num_entries]

        if instances.count():
            last_instance = instances[instances.count() - 1]
            self.resumption_cursor = last_instance.pk
        elif instances.count() == 0 and cursor:
            self.resumption_cursor = cursor
        else:
            self.resumption_cursor = 0

        return instances

    def create(self, request, *args, **kwargs):
        if request.method.upper() == 'HEAD':
            return Response(status=status.HTTP_204_NO_CONTENT,
                            headers=self.get_openrosa_headers(request),
                            template_name=self.template_name)

        xform_def = request.FILES.get('form_def_file', None)
        response_status = status.HTTP_201_CREATED
        # With the advent of project-level anonymous access in #904, Briefcase
        # requests must no longer use endpoints whose URLs contain usernames.
        # Ideally, Briefcase would display error messages returned by this method,
        # but sadly that is not the case.
        # Raise an empty PermissionDenied since it's impossible to have
        # Briefcase display any guidance.
        if kwargs.get('username'):
            raise exceptions.PermissionDenied()

        data = {}

        if isinstance(xform_def, File):
            do_form_upload = DoXmlFormUpload(xform_def, request.user)
            dd = publish_form(do_form_upload.publish)

            if isinstance(dd, XForm):
                data['message'] = t('%s successfully published.' % dd.id_string)
            else:
                data['message'] = dd['text']
                response_status = status.HTTP_400_BAD_REQUEST
        else:
            data['message'] = t('Missing xml file.')
            response_status = status.HTTP_400_BAD_REQUEST

        return Response(data, status=response_status,
                        headers=self.get_openrosa_headers(request,
                                                          location=False),
                        template_name=self.template_name)

    def list(self, request, *args, **kwargs):
        object_list = self.filter_queryset(self.get_queryset())

        data = {
            'instances': object_list,
            'resumptionCursor': self.resumption_cursor,
        }

        return Response(
            data,
            headers=self.get_openrosa_headers(request, location=False),
            template_name='submissionList.xml',
        )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        submission_xml_root_node = instance.get_root_node()
        submission_xml_root_node.setAttribute(
            'instanceID', 'uuid:%s' % instance.uuid)
        submission_xml_root_node.setAttribute(
            'submissionDate', instance.date_created.isoformat()
        )

        # Added this because of https://github.com/onaio/kobo.apps.open_rosa_server/pull/2139
        # Should bring support to ODK v1.17+
        if settings.SUPPORT_BRIEFCASE_SUBMISSION_DATE:
            # Remove namespace attribute if any
            try:
                submission_xml_root_node.removeAttribute('xmlns')
            except NotFoundErr:
                pass

        data = {
            'submission_data': submission_xml_root_node.toxml(),
            'media_files': self._get_attachments_with_md5hash(instance),
            'host': request.build_absolute_uri().replace(request.get_full_path(), ''),
        }
        return Response(
            data,
            headers=self.get_openrosa_headers(request, location=False),
            template_name='downloadSubmission.xml',
        )

    @action(detail=True, methods=['GET'])
    def manifest(self, request, *args, **kwargs):
        xform = self.get_object()
        object_list = MetaData.objects.filter(
            data_type__in=MetaData.MEDIA_FILES_TYPE, xform=xform
        )
        context = self.get_serializer_context()
        serializer = XFormManifestSerializer(
            object_list, many=True, context=context
        )

        return Response(
            serializer.data,
            headers=self.get_openrosa_headers(request, location=False),
        )

    @action(detail=True, methods=['GET'])
    def media(self, request, *args, **kwargs):
        xform = self.get_object()
        pk = kwargs.get('metadata')

        if not pk:
            raise Http404()

        meta_obj = get_object_or_404(
            MetaData,
            data_type__in=MetaData.MEDIA_FILES_TYPE,
            xform=xform,
            pk=pk,
        )

        return get_media_file_response(meta_obj, request)

    def _get_attachments_with_md5hash(self, instance):
        """
        Return a list of attachment with md5 hash for retro compatibility with Briefcase
        Attachment.hash is sha1 by default.
        """
        for att in Attachment.objects.filter(instance=instance):
            att.md5hash = att.get_hash(algorithm='md5')
            yield att
