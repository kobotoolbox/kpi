import inspect
import os
import re

import rest_framework.views as rest_framework_views
from django.conf import settings
from django.http import HttpResponse, HttpResponseNotFound, HttpResponseRedirect
from django.urls import Resolver404, resolve
from rest_framework.request import Request

from kobo.apps.openrosa.apps.main.models.meta_data import MetaData
from kobo.apps.openrosa.libs.utils.logger_tools import response_with_mimetype_and_name
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)
from kpi.views.v2.paired_data import OpenRosaDynamicDataAttachmentViewset


def get_media_file_response(
    metadata: MetaData,
    request: Request = None,
) -> HttpResponse:
    if metadata.data_file:
        file_path = metadata.data_file.name
        filename, extension = os.path.splitext(file_path.split('/')[-1])
        extension = extension.strip('.')

        if default_storage.exists(file_path):
            response = response_with_mimetype_and_name(
                metadata.data_file_type,
                filename, extension=extension, show_date=False,
                file_path=file_path, full_mime=True)

            return response
        else:
            return HttpResponseNotFound()
    elif not metadata.is_paired_data:
        return HttpResponseRedirect(metadata.data_value)

    # When `request.user` is authenticated, their authentication is lost with
    # an HTTP redirection. We need to call KPI viewset directly
    internal_url = metadata.data_value.replace(settings.KOBOFORM_URL, '')
    try:
        resolver_match = resolve(internal_url)
    except Resolver404:
        return HttpResponseNotFound()

    args = resolver_match.args
    kwargs = resolver_match.kwargs

    paired_data_viewset = OpenRosaDynamicDataAttachmentViewset.as_view(
        {'get': 'external'}
    )
    django_http_request = request._request
    return paired_data_viewset(request=django_http_request, *args, **kwargs)


def get_view_name(view_obj):
    """
    Override Django REST framework's name for the base API class
    """
    # The base API class should inherit directly from APIView. We can't use
    # issubclass() because ViewSets also inherit (indirectly) from APIView.
    try:
        if inspect.getmro(view_obj.__class__)[1] is rest_framework_views.APIView:
            return 'Kobo Api v1'
    except KeyError:
        pass
    return rest_framework_views.get_view_name(view_obj)


def get_view_description(view_obj, html=False):
    """
    Replace example.com in Django REST framework's default API description
    with the domain name of the current site
    """
    domain = settings.KOBOCAT_PUBLIC_HOSTNAME
    description = rest_framework_views.get_view_description(view_obj, html)
    # description might not be a plain string: e.g. it could be a SafeText
    # to prevent further HTML escaping
    original_type = type(description)
    description = original_type(re.sub(
        '(https*)://example.com',
        '\\1://{}'.format(domain),
        description
    ))
    return description
