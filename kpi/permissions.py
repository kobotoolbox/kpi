# coding: utf-8
from __future__ import annotations

from typing import Union

from django.conf import settings
from django.http import Http404
from rest_framework import exceptions, permissions
from rest_framework.permissions import IsAuthenticated as DRFIsAuthenticated

from kpi.constants import (
    PERM_ADD_SUBMISSIONS,
    PERM_CHANGE_METADATA_ASSET,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.exceptions import DeploymentNotFound
from kpi.mixins.validation_password_permission import ValidationPasswordPermissionMixin
from kpi.models.asset import Asset, AssetSnapshot
from kpi.utils.object_permission import get_database_user
from kpi.utils.project_views import (
    user_has_project_view_asset_perm,
)


# FIXME: Move to `object_permissions` module.
def get_perm_name(perm_name_prefix, model_instance):
    """
    Get the type-specific permission name for a model from a permission name
    prefix and a model instance.

    Example:
        >>>get_perm_name('view', my_asset)
        'view_asset'

    :param perm_name_prefix: Prefix of the desired permission name (i.e.
        "view_", "change_", or "delete_").
    :type perm_name_prefix: str
    :param model_instance: An instance of the model for which the permission
        name is desired.
    :type model_instance: :py:class:`Asset`
    :return: The computed permission name.
    :rtype: str
    """
    if not perm_name_prefix[-1] == '_':
        perm_name_prefix += '_'
    perm_name = perm_name_prefix + model_instance._meta.model_name
    return perm_name


class BaseAssetNestedObjectPermission(permissions.BasePermission):
    """
    Base class for Asset and related objects permissions
    """

    MODEL_NAME = Asset._meta.model_name
    APP_LABEL = Asset._meta.app_label

    @staticmethod
    def _get_asset(view):
        """
        Returns Asset from the view.
        The view must have a property `asset`.
        It's easily done with `AssetNestedObjectViewsetMixin (kpi.utils.viewset_mixins.py)
        :param view: ViewSet
        :return: Asset
        """
        return view.asset

    @classmethod
    def _get_parent_object(cls, view):
        """
        Returns parent object from the view (`Asset` or `Collection`)
        The view must have a property `asset` or `collection`
        It's easily done with `AssetNestedObjectViewsetMixin (kpi.utils.viewset_mixins.py)
        :param view: ViewSet
        :return: Asset/Collection
        """
        # TODO: remove all collection stuff
        if cls.MODEL_NAME == 'collection':
            return cls._get_collection(view)
        else:
            return cls._get_asset(view)

    def _get_user_permissions(
        self,
        object_: Union['kpi.Asset', 'kpi.Collection'],
        user: settings.AUTH_USER_MODEL,
    ) -> list[str]:
        """
        Returns a list of `user`'s permission for `asset`
        """
        return object_.get_perms(user)

    def get_required_permissions(self, method):
        """
        Given a model and an HTTP method, return the list of permission
        codes that the user is required to have.

        :param method: str. e.g. Mostly keys of `perms_map`
        :return:
        """
        app_label = self.APP_LABEL

        kwargs = {
            'app_label': app_label,
            'model_name': self.MODEL_NAME
        }

        try:
            perm_list = self.perms_map[method]
        except KeyError:
            raise exceptions.MethodNotAllowed(method)

        perms = [perm % kwargs for perm in perm_list]
        # Because `ObjectPermissionMixin.get_perms()` returns codenames only,
        # remove the `app_label` prefix before returning
        return [perm.replace('{}.'.format(app_label), '') for perm in perms]

    def has_object_permission(self, request, view, obj):
        # Because authentication checks has already executed via
        # `has_permission()`, always return True.
        return True


class AssetPermission(
    ValidationPasswordPermissionMixin, permissions.DjangoObjectPermissions
):

    # Setting this to False allows real permission checking on AnonymousUser.
    # With the default of True, anonymous requests are categorically rejected.
    authenticated_users_only = False

    perms_map = permissions.DjangoObjectPermissions.perms_map.copy()
    perms_map['GET'] = ['%(app_label)s.view_%(model_name)s']
    perms_map['OPTIONS'] = perms_map['GET']
    perms_map['HEAD'] = perms_map['GET']

    def has_permission(self, request, view):
        self.validate_password(request)
        return super().has_permission(request=request, view=view)

    def has_object_permission(self, request, view, obj):

        user = get_database_user(request.user)
        # When calling the endpoint with the API renderer, it calls this method
        # for each method declared in `perms_maps`. To detect the real method,
        # we need to access `request._request.method`
        method = request._request.method
        if (
            method == 'PATCH'
            and user_has_project_view_asset_perm(
                obj, user, PERM_CHANGE_METADATA_ASSET
            )
        ) or (
            method == 'GET'
            and user_has_project_view_asset_perm(obj, user, PERM_VIEW_ASSET)
        ):
            return True

        return super().has_object_permission(request, view, obj)


class AssetNestedObjectPermission(
    ValidationPasswordPermissionMixin, BaseAssetNestedObjectPermission
):
    """
    Permissions for nested objects of Asset.
    Only owner and managers can have write access on these objects.
    i.e.:
        - Reads need 'view_asset' permission
        - Writes need 'manage_asset' permission
    """

    perms_map = {
        'GET': ['%(app_label)s.view_asset'],
        'POST': ['%(app_label)s.manage_asset'],
    }

    perms_map['OPTIONS'] = perms_map['GET']
    perms_map['HEAD'] = perms_map['GET']
    perms_map['PUT'] = perms_map['POST']
    perms_map['PATCH'] = perms_map['POST']
    perms_map['DELETE'] = perms_map['POST']

    def has_permission(self, request, view):
        self.validate_password(request)
        if not request.user:
            return False
        elif request.user.is_superuser:
            return True

        parent_object = self._get_parent_object(view)
        user = get_database_user(request.user)
        user_permissions = self._get_user_permissions(parent_object, user)
        view_permissions = self.get_required_permissions('GET')
        can_view = set(view_permissions).issubset(user_permissions)

        try:
            required_permissions = self.get_required_permissions(request.method)
        except exceptions.MethodNotAllowed as e:
            # Only reveal the HTTP 405 if the user has view access
            if can_view:
                raise e
            else:
                raise Http404

        if user == parent_object.owner:
            # The owner can always manage permission assignments
            has_perm = True
        else:
            has_perm = set(required_permissions).issubset(user_permissions)

        if has_perm:
            # Access granted!
            return True

        if not has_perm and can_view:
            # If users are allowed to view, we want to show them HTTP 403
            return False

        # Don't reveal the existence of this object to users who do not have
        # permission to view it
        raise Http404


class AssetEditorPermission(AssetNestedObjectPermission):
    """
    Owner, managers and editors can write.
    i.e.:
        - Reads need 'view_asset' permission
        - Writes need 'change_asset' permission
    """
    perms_map = AssetNestedObjectPermission.perms_map.copy()
    perms_map['POST'] = ['%(app_label)s.change_asset']
    perms_map['PUT'] = perms_map['POST']
    perms_map['PATCH'] = perms_map['POST']
    perms_map['DELETE'] = perms_map['POST']


class AssetEditorSubmissionViewerPermission(AssetNestedObjectPermission):
    """
    Permissions for objects that are nested under Asset whose only users can
    change/edit and need to view submissions
    Others should receive a 404 response (instead of 403) to avoid revealing
    existence of objects.
    """

    required_permissions = ['%(app_label)s.change_asset',
                            '%(app_label)s.view_submissions']
    perms_map = {
        'GET': required_permissions,
        'POST': required_permissions,
        'PUT': required_permissions,
        'PATCH': required_permissions,
        'DELETE': required_permissions
    }


class AssetPermissionAssignmentPermission(AssetNestedObjectPermission):

    perms_map = AssetNestedObjectPermission.perms_map.copy()
    # This change allows users with `view_asset` to permissions to
    # remove themselves from an asset that has been shared with them
    perms_map['DELETE'] = perms_map['GET']


class AssetSnapshotPermission(AssetPermission):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Do NOT mutate `perms_map` from the parent class! Doing so will affect
        # *every* instance of `DjangoObjectPermissions` and all its subclasses
        app_label = Asset._meta.app_label
        model_name = Asset._meta.model_name

        self.perms_map = self.perms_map.copy()
        for action in self.perms_map.keys():
            for idx, perm in enumerate(self.perms_map[action]):
                self.perms_map[action][idx] = perm % {
                    'app_label': app_label,
                    'model_name': model_name,
                }

    def has_object_permission(self, request, view, obj):
        if view.action == 'submission' or (
            view.action == 'retrieve' and request.accepted_renderer.format == 'xml'
        ):
            return True

        asset = obj.asset
        return super().has_object_permission(request, view, asset)


class AssetVersionReadOnlyPermission(AssetNestedObjectPermission):

    required_permissions = ['%(app_label)s.view_asset']

    perms_map = {
        'GET': ['%(app_label)s.view_asset'],
    }


class IsAuthenticated(ValidationPasswordPermissionMixin, DRFIsAuthenticated):

    def has_permission(self, request, view):
        self.validate_password(request)
        return super().has_permission(request=request, view=view)


# FIXME: Name is no longer accurate.
class IsOwnerOrReadOnly(AssetPermission):
    """
    Custom permission to only allow owners of an object to edit it.
    """

    def has_object_permission(self, request, view, obj):

        return super(AssetPermission, self).has_object_permission(
            request, view, obj
        )


class PostMappedToChangePermission(IsOwnerOrReadOnly):
    """
    Maps POST requests to the change_model permission instead of DRF's default
    of add_model
    """
    perms_map = IsOwnerOrReadOnly.perms_map.copy()
    perms_map['POST'] = ['%(app_label)s.change_%(model_name)s']


class ReportPermission(IsOwnerOrReadOnly):
    def has_object_permission(self, request, view, obj):
        # Checks if the user has the required permissions
        # to access the submission data in reports
        user = get_database_user(request.user)
        if user.is_superuser:
            return True
        permissions = obj.get_perms(user)
        required_permissions = [
            PERM_VIEW_SUBMISSIONS,
            PERM_PARTIAL_SUBMISSIONS,
        ]

        if PERM_VIEW_ASSET not in permissions:
            raise Http404

        return any(
            perm in permissions for perm in required_permissions
        )


class SubmissionPermission(AssetNestedObjectPermission):
    """
    Permissions for submissions.
    """

    MODEL_NAME = 'submissions'  # Hard-code `model_name` to match permissions

    perms_map = {
        'GET': ['%(app_label)s.view_%(model_name)s'],
        'OPTIONS': ['%(app_label)s.view_%(model_name)s'],
        'HEAD': ['%(app_label)s.view_%(model_name)s'],
        'POST': ['%(app_label)s.add_%(model_name)s'],
        'PATCH': ['%(app_label)s.change_%(model_name)s'],
        'DELETE': ['%(app_label)s.delete_%(model_name)s'],
    }

    def _get_user_permissions(self, asset: Asset, user: 'settings.AUTH_USER_MODEL') -> list:
        """
        Overrides parent method to include partial permissions (which are
        specific to submissions)
        """

        user_permissions = super()._get_user_permissions(asset, user)

        if PERM_PARTIAL_SUBMISSIONS in user_permissions:
            # Merge partial permissions with permissions to find out if there
            # is a match within required permissions.
            # Restricted users will be narrowed down in MongoDB query.
            partial_perms = asset.get_partial_perms(user.id)
            if partial_perms:
                user_permissions = list(set(
                    user_permissions + partial_perms
                ))

        return user_permissions


class AssetExportSettingsPermission(SubmissionPermission):
    perms_map = {
        'GET': ['%(app_label)s.view_submissions'],
        'POST': ['%(app_label)s.manage_asset'],
    }

    perms_map['OPTIONS'] = perms_map['GET']
    perms_map['HEAD'] = perms_map['GET']
    perms_map['PUT'] = perms_map['POST']
    perms_map['PATCH'] = perms_map['POST']
    perms_map['DELETE'] = perms_map['POST']


class DuplicateSubmissionPermission(SubmissionPermission):
    perms_map = {
        'GET': ['%(app_label)s.view_%(model_name)s'],
        'POST': ['%(app_label)s.change_%(model_name)s'],
    }


class EditLinkSubmissionPermission(SubmissionPermission):

    perms_map = {
        'GET': ['%(app_label)s.change_%(model_name)s'],
        'HEAD': ['%(app_label)s.change_%(model_name)s'],
        'POST': ['%(app_label)s.change_%(model_name)s'],
    }

    def has_object_permission(self, request, view, obj):
        # Authentication validation has already been made in `has_permission()`
        # because we validate the permissions on the `obj`'s parent, i.e. the asset.
        # But we do want to be sure that user is authenticated before going further.
        #
        # It will force DRF to send authentication header (i.e. `WWW-authenticate`)
        # when the first authentication class implements an authentication header
        # response.
        # See
        #  - https://github.com/encode/django-rest-framework/blob/45082b39368729caa70534dde11b0788ef186a37/rest_framework/views.py#L190
        #  - https://github.com/encode/django-rest-framework/blob/45082b39368729caa70534dde11b0788ef186a37/rest_framework/views.py#L453-L456
        return not request.user.is_anonymous


class EditSubmissionPermission(EditLinkSubmissionPermission):
    # TODO: Refactor this so we don't have to check for the object twice
    def has_permission(self, request, view):
        try:
            return super().has_permission(request, view)
        except Http404:
            uid = request.parser_context['kwargs']['uid']
            # Is this a real 404 (object does not exist)? If so, raise it
            if not AssetSnapshot.objects.filter(uid=uid).exists():
                raise

            # If we forced a 404 for permissions issues, we want to
            # change it to a 401 to allow the user log in with different credentials.
            # Enketo Express will prompt the credential form only if it receives a 401.
            raise exceptions.AuthenticationFailed()


class ViewSubmissionPermission(SubmissionPermission):
    perms_map = {
        'GET': ['%(app_label)s.view_%(model_name)s'],
    }


class ExportTaskPermission(SubmissionPermission):
    perms_map = {
        'GET': ['%(app_label)s.view_submissions'],
    }

    perms_map['POST'] = perms_map['GET']
    perms_map['DELETE'] = perms_map['GET']


class SubmissionValidationStatusPermission(SubmissionPermission):
    perms_map = {
        'GET': ['%(app_label)s.view_%(model_name)s'],
        'PATCH': ['%(app_label)s.validate_%(model_name)s'],
        'DELETE': ['%(app_label)s.validate_%(model_name)s'],
    }


class XMLExternalDataPermission(permissions.BasePermission):

    def has_permission(self, request, view):
        """
        We cannot rely on Django permissions because the form clients
        (i.e. Enketo, Collect) need to get access even if user is
        not authenticated
        """
        return True

    def has_object_permission(self, request, view, obj):
        """
        The responsibility for securing data behove to the owner of the
        asset `obj` (the child project) by requiring authentication on
        their form.
        Otherwise, the paired source (the parent project) data may be exposed
        to anyone.
        """
        # Check whether the project requires authentication
        try:
            require_auth = obj.asset.deployment.xform.require_auth
        except (DeploymentNotFound, AttributeError):
            require_auth = True

        real_user = request.user

        # If authentication is required, `request.user` should have
        # 'add_submission' permission on `obj`
        if (
            require_auth
            and not obj.asset.has_perm(real_user, PERM_ADD_SUBMISSIONS)
        ):
            raise Http404

        return True
