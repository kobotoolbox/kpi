# coding: utf-8

from django.conf import settings
from django.http import HttpResponse
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request as DRFRequest

from kobo.apps.openrosa.apps.api.utils.rest_framework import openrosa_drf_settings
from kpi.constants import PERM_VIEW_ASSET


class HttpResponseNotAuthorized(HttpResponse):
    status_code = 401

    def __init__(self):
        HttpResponse.__init__(self)
        self['WWW-Authenticate'] = (
            'Basic realm="%s"' % settings.KOBOCAT_PUBLIC_HOSTNAME
        )


def has_permission(xform, owner, request, shared=False):
    # PERM_VIEW_ASSET covers holders of PERM_CHANGE_ASSET too: the asset model
    # declares change_asset → view_asset in its IMPLIED_PERMISSIONS mapping.
    user = request.user
    return (
        shared
        or xform.shared_data
        or owner == user
        or user.has_perm(PERM_VIEW_ASSET, xform.asset)
    )


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


def add_cors_headers(response):
    response['Access-Control-Allow-Origin'] = '*'
    response['Access-Control-Allow-Methods'] = 'GET'
    response['Access-Control-Allow-Headers'] = (
        'Accept, Origin,' ' X-Requested-With,' ' Authorization'
    )
    response['Content-Type'] = 'application/json'
    return response
