# -*- coding: utf-8 -*-
from __future__ import absolute_import

import datetime

from django.contrib.auth.decorators import login_required
from django.template.response import TemplateResponse
from django.conf import settings
from django.contrib.auth import login
from django.contrib.auth.models import User
from django.db import transaction
from django.http import HttpResponseBadRequest, HttpResponseRedirect
from django.shortcuts import resolve_url
from django.utils.http import is_safe_url
from django.utils.translation import ugettext_lazy as _
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework import exceptions
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, authentication_classes
from rest_framework.response import Response

from kpi.models import AuthorizedApplication, OneTimeAuthenticationKey
from kpi.models.authorized_application import ApplicationTokenAuthentication
from kpi.serializers import AuthorizedApplicationUserSerializer

from .v1.asset import AssetViewSet
from .v1.asset_file import AssetFileViewSet
from .v1.asset_snapshot import AssetSnapshotViewSet
from .v1.asset_version import AssetVersionViewSet
from .v1.authorized_application_user import AuthorizedApplicationUserViewSet
from .v1.collection import CollectionViewSet
from .v1.current_user import CurrentUserViewSet
from .v1.environment import EnvironmentView
from .v1.export_task import ExportTaskViewSet
from .v1.hook_signal import HookSignalViewSet
from .v1.import_task import ImportTaskViewSet
from .v1.object_permission import ObjectPermissionViewSet
from .v1.one_time_authentication_key import OneTimeAuthenticationKeyViewSet
from .v1.sitewide_message import SitewideMessageViewSet
from .v1.submission import SubmissionViewSet
from .v1.tag import TagViewSet
from .v1.token import TokenView
from .v1.user import UserViewSet
from .v1.user_collection_subscription import UserCollectionSubscriptionViewSet


@login_required
def home(request):
    return TemplateResponse(request, "index.html")


def browser_tests(request):
    return TemplateResponse(request, "browser_tests.html")


@api_view(['POST'])
@authentication_classes([ApplicationTokenAuthentication])
def authorized_application_authenticate_user(request):
    """
    Returns a user-level API token when given a valid username and
    password. The request header must include an authorized application key
    """
    if type(request.auth) is not AuthorizedApplication:
        # Only specially-authorized applications are allowed to authenticate
        # users this way
        raise exceptions.PermissionDenied()
    serializer = AuthorizedApplicationUserSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    username = serializer.validated_data['username']
    password = serializer.validated_data['password']
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        raise exceptions.PermissionDenied()
    if not user.is_active or not user.check_password(password):
        raise exceptions.PermissionDenied()
    token = Token.objects.get_or_create(user=user)[0]
    response_data = {'token': token.key}
    user_attributes_to_return = (
        'username',
        'first_name',
        'last_name',
        'email',
        'is_staff',
        'is_active',
        'is_superuser',
        'last_login',
        'date_joined'
    )
    for attribute in user_attributes_to_return:
        response_data[attribute] = getattr(user, attribute)
    return Response(response_data)


@require_POST
@csrf_exempt
def one_time_login(request):
    """
    If the request provides a key that matches a OneTimeAuthenticationKey
    object, log in the User specified in that object and redirect to the
    location specified in the 'next' parameter
    """
    try:
        key = request.POST['key']
    except KeyError:
        return HttpResponseBadRequest(_('No key provided'))
    try:
        next_ = request.GET['next']
    except KeyError:
        next_ = None
    if not next_ or not is_safe_url(url=next_, host=request.get_host()):
        next_ = resolve_url(settings.LOGIN_REDIRECT_URL)
    # Clean out all expired keys, just to keep the database tidier
    OneTimeAuthenticationKey.objects.filter(
        expiry__lt=datetime.datetime.now()).delete()
    with transaction.atomic():
        try:
            otak = OneTimeAuthenticationKey.objects.get(
                key=key,
                expiry__gte=datetime.datetime.now()
            )
        except OneTimeAuthenticationKey.DoesNotExist:
            return HttpResponseBadRequest(_('Invalid or expired key'))
        # Nevermore
        otak.delete()
    # The request included a valid one-time key. Log in the associated user
    user = otak.user
    user.backend = settings.AUTHENTICATION_BACKENDS[0]
    login(request, user)
    return HttpResponseRedirect(next_)


# TODO Verify if it's still used
def _wrap_html_pre(content):
    return "<!doctype html><html><body><code><pre>%s</pre></code></body></html>" % content
