import inspect
import os
import re
from datetime import datetime

import rest_framework.views as rest_framework_views
from django import forms
from django.conf import settings
from django.http import HttpResponse, HttpResponseNotFound, HttpResponseRedirect
from django.urls import Resolver404, resolve
from django.utils.translation import gettext as t
from rest_framework import exceptions
from rest_framework.request import Request
from taggit.forms import TagField

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.main.forms import QuickConverterForm
from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.openrosa.apps.main.models.meta_data import MetaData
from kobo.apps.openrosa.apps.viewer.models.parsed_instance import datetime_from_str
from kobo.apps.openrosa.libs.utils.logger_tools import (
    publish_form,
    response_with_mimetype_and_name,
)
from kobo.apps.openrosa.libs.utils.user_auth import (
    check_and_set_form_by_id,
    check_and_set_form_by_id_string,
)
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)
from kpi.views.v2.paired_data import OpenRosaDynamicDataAttachmentViewset

DECIMAL_PRECISION = 2


def _get_first_last_names(name):
    name_split = name.split()
    first_name = name_split[0]
    last_name = ''
    if len(name_split) > 1:
        last_name = ' '.join(name_split[1:])
    return first_name, last_name


def _get_id_for_type(record, mongo_field):
    date_field = datetime_from_str(record[mongo_field])
    mongo_str = '$' + mongo_field

    return (
        {'$substr': [mongo_str, 0, 10]}
        if isinstance(date_field, datetime)
        else mongo_str
    )


def publish_xlsform(request, user, existing_xform=None):
    """
    If `existing_xform` is specified, that form will be overwritten with the
    new XLSForm
    """
    if (
        not request.user.is_superuser
        and not request.user.has_perm(
            'can_add_xform', UserProfile.objects.get_or_create(user=user)[0]
        )
    ):
        raise exceptions.PermissionDenied(
            detail=t(
                'User %(user)s has no permission to add xforms to '
                'account %(account)s'
                % {'user': request.user.username, 'account': user.username}
            )
        )
    if (
        existing_xform
        and not request.user.is_superuser
        and not request.user.has_perm('change_xform', existing_xform)
    ):
        raise exceptions.PermissionDenied(
            detail=t(
                'User %(user)s has no permission to change this '
                'form.'
                % {
                    'user': request.user.username,
                }
            )
        )

    def set_form():
        form = QuickConverterForm(request.POST, request.FILES)
        if existing_xform:
            return form.publish(user, existing_xform.id_string)
        else:
            return form.publish(user)

    return publish_form(set_form)


def get_xform(formid, request, username=None):
    try:
        formid = int(formid)
    except ValueError:
        username = username is None and request.user.username
        xform = check_and_set_form_by_id_string(username, formid, request)
    else:
        xform = check_and_set_form_by_id(int(formid), request)

    if not xform:
        raise exceptions.PermissionDenied(
            t('You do not have permission to view data from this form.')
        )

    return xform


def get_user_profile_or_none(username):
    profile = None

    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        pass
    else:
        profile, created = UserProfile.objects.get_or_create(user=user)

    return profile


def add_tags_to_instance(request, instance):
    class TagForm(forms.Form):
        tags = TagField()

    form = TagForm(request.data)

    if form.is_valid():
        tags = form.cleaned_data.get('tags', None)

        if tags:
            for tag in tags:
                instance.tags.add(tag)
            instance.save()


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
