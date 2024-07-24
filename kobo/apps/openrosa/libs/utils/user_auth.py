# coding: utf-8
import re

from django.conf import settings
from django.http import HttpResponseRedirect, HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request as DRFRequest

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.api.utils.rest_framework import openrosa_drf_settings
from kobo.apps.openrosa.apps.logger.models import XForm, Note
from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.openrosa.libs.utils.guardian import (
    assign_perm,
    get_perms_for_model,
)
from kobo.apps.openrosa.libs.utils.string import (
    base64_encodestring,
)
from kobo.apps.openrosa.libs.constants import (
    CAN_DELETE_DATA_XFORM,
    CAN_CHANGE_XFORM,
    CAN_VIEW_XFORM,
)


class HttpResponseNotAuthorized(HttpResponse):
    status_code = 401

    def __init__(self):
        HttpResponse.__init__(self)
        self['WWW-Authenticate'] = (
            'Basic realm="%s"' % settings.KOBOCAT_PUBLIC_HOSTNAME
        )


def check_and_set_user(request, username):
    if username != request.user.username:
        return HttpResponseRedirect("/%s" % username)
    content_user = None
    try:
        content_user = User.objects.get(username=username)
    except User.DoesNotExist:
        return HttpResponseRedirect("/")
    return content_user


def set_profile_data(data, content_user):
    # create empty profile if none exists
    profile, created = UserProfile.objects.get_or_create(user=content_user)
    location = ""
    if profile.city:
        location = profile.city
    if profile.country:
        if profile.city:
            location += ", "
        location += profile.country
    forms = content_user.xforms.filter(shared__exact=1)
    num_forms = forms.count()
    user_instances = profile.num_of_submissions
    home_page = profile.home_page
    if home_page and re.match("http", home_page) is None:
        home_page = "http://%s" % home_page

    data.update(
        {
            'location': location,
            'user_instances': user_instances,
            'home_page': home_page,
            'num_forms': num_forms,
            'forms': forms,
            'profile': profile,
            'content_user': content_user,
        }
    )


def has_permission(xform, owner, request, shared=False):
    user = request.user
    return (
        shared
        or xform.shared_data
        or (
            hasattr(request, 'session')
            and request.session.get('public_link') == xform.uuid
        )
        or owner == user
        or user.has_perm('logger.' + CAN_VIEW_XFORM, xform)
        or user.has_perm('logger.' + CAN_CHANGE_XFORM, xform)
    )


def has_delete_data_permission(xform, owner, request):
    user = request.user
    return owner == user or user.has_perm(
        'logger.' + CAN_DELETE_DATA_XFORM, xform
    )


def has_edit_permission(xform, owner, request):
    user = request.user
    return owner == user or user.has_perm('logger.' + CAN_CHANGE_XFORM, xform)


def check_and_set_user_and_form(username, id_string, request):
    xform = get_object_or_404(
        XForm, user__username=username, id_string=id_string
    )
    owner = User.objects.get(username=username)
    return (
        [xform, owner]
        if has_permission(xform, owner, request)
        else [False, False]
    )


def check_and_set_form_by_id_string(username, id_string, request):
    xform = get_object_or_404(
        XForm, user__username=username, id_string=id_string
    )
    return xform if has_permission(xform, xform.user, request) else False


def check_and_set_form_by_id(pk, request):
    xform = get_object_or_404(XForm, pk=pk)
    return xform if has_permission(xform, xform.user, request) else False


def get_xform_and_perms(username, id_string, request):
    xform = get_object_or_404(
        XForm, user__username=username, id_string=id_string
    )
    is_owner = xform.user == request.user
    can_edit = is_owner or request.user.has_perm(
        'logger.' + CAN_CHANGE_XFORM, xform
    )
    can_view = can_edit or request.user.has_perm(
        'logger.' + CAN_VIEW_XFORM, xform
    )
    can_delete_data = is_owner or request.user.has_perm(
        'logger.' + CAN_DELETE_DATA_XFORM, xform
    )
    return [xform, is_owner, can_edit, can_view, can_delete_data]


def helper_auth_helper(request):

    if request.user and request.user.is_authenticated:
        return

    if not request.user.is_authenticated:
        # This is not a DRF view, but we need to honor things like
        # `DigestAuthentication` (ODK Briefcase uses it!) and
        # `TokenAuthentication`. Let's try all the DRF authentication
        # classes before giving up
        drf_request = DRFRequest(request)
        for auth_class in openrosa_drf_settings.DEFAULT_AUTHENTICATION_CLASSES:
            try:
                # `authenticate()` will:
                #   * return `None` if no applicable authentication attempt
                #     was found in the request
                #   * raise `AuthenticationFailed` if an attempt _was_
                #     found but it failed
                #   * return a tuple if authentication succeeded
                auth_tuple = auth_class().authenticate(drf_request)
            except AuthenticationFailed:
                return HttpResponseNotAuthorized()
            if auth_tuple is not None:
                # Is it kosher to modify `request`? Let's do it anyway
                # since that's what `has_permission()` requires...
                request.user = auth_tuple[0]
                # `DEFAULT_AUTHENTICATION_CLASSES` are ordered and the
                # first match wins; don't look any further
                break


def http_auth_string(username, password):
    credentials = base64_encodestring('%s:%s' % (username, password)).strip()
    auth_string = 'Basic %s' % credentials
    return auth_string


def add_cors_headers(response):
    response['Access-Control-Allow-Origin'] = '*'
    response['Access-Control-Allow-Methods'] = 'GET'
    response['Access-Control-Allow-Headers'] = (
        'Accept, Origin,' ' X-Requested-With,' ' Authorization'
    )
    response['Content-Type'] = 'application/json'
    return response


def set_api_permissions_for_user(user):
    models = [UserProfile, XForm, Note]
    for model in models:
        for perm in get_perms_for_model(model):
            assign_perm(
                '%s.%s' % (perm.content_type.app_label, perm.codename), user
            )
