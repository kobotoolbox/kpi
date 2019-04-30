from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework_extensions.settings import extensions_api_settings

from kpi.models.asset import Asset
from kpi.models.object_permission import get_anonymous_user
from kpi.constants import PERM_RESTRICTED_SUBMISSIONS


# FIXME: Move to `object_permissions` module.
def get_perm_name(perm_name_prefix, model_instance):
    '''
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
    :type model_instance: :py:class:`Collection` or :py:class:`Asset`
    :return: The computed permission name.
    :rtype: str
    '''
    if not perm_name_prefix[-1] == '_':
        perm_name_prefix += '_'
    perm_name = perm_name_prefix + model_instance._meta.model_name
    return perm_name


# FIXME: Name is no longer accurate.
class IsOwnerOrReadOnly(permissions.DjangoObjectPermissions):

    """
    Custom permission to only allow owners of an object to edit it.
    """

    # Setting this to False allows real permission checking on AnonymousUser.
    # With the default of True, anonymous requests are categorically rejected.
    authenticated_users_only = False

    perms_map = permissions.DjangoObjectPermissions.perms_map
    perms_map['GET'] = ['%(app_label)s.view_%(model_name)s']
    perms_map['OPTIONS'] = perms_map['GET']
    perms_map['HEAD'] = perms_map['GET']


class PostMappedToChangePermission(IsOwnerOrReadOnly):
    '''
    Maps POST requests to the change_model permission instead of DRF's default
    of add_model
    '''
    perms_map = IsOwnerOrReadOnly.perms_map
    perms_map['POST'] = ['%(app_label)s.change_%(model_name)s']


class AssetNestedObjectPermission(permissions.BasePermission):

    def has_permission(self, request, view):
        # This method should be overridden in subclasses
        return False

    def has_object_permission(self, request, view, obj):
        # Because authentication checks have already executed via has_permission,
        # always return True.
        # Only owner can reach access this.
        return True

    @staticmethod
    def _get_parents_query_dict(request):
        """
        Mimics NestedViewSetMixin.get_parents_query_dict
        :param request:
        :return:
        """
        result = {}
        for kwarg_name, kwarg_value in request.parser_context.get("kwargs").items():
            if kwarg_name.startswith(extensions_api_settings.DEFAULT_PARENT_LOOKUP_KWARG_NAME_PREFIX):
                query_lookup = kwarg_name.replace(
                    extensions_api_settings.DEFAULT_PARENT_LOOKUP_KWARG_NAME_PREFIX,
                    '',
                    1
                )
                query_value = kwarg_value
                result[query_lookup] = query_value
        return result


class AssetOwnerNestedObjectPermission(AssetNestedObjectPermission):
    """
    Permissions for objects that are nested under Asset which only owner should access.
    Others should receive a 404 response (instead of 403) to avoid revealing existence
    of objects.
    """
    def has_permission(self, request, view):

        if getattr(view, '_ignore_model_permissions', False):
            return True

        if not request.user or (request.user and
                                (request.user.is_anonymous() or
                                 not request.user.is_authenticated())):
            return False

        asset_uid = self._get_parents_query_dict(request).get("asset")
        asset = get_object_or_404(Asset, uid=asset_uid)

        if request.user != asset.owner:
            raise Http404

        return True


class SubmissionPermission(AssetNestedObjectPermission):
    """
    Permissions for submissions
    """

    MODEL_NAME = "submissions"  # Hardcode model_name to match permissions
    
    perms_map = {
        'GET': ['%(app_label)s.view_%(model_name)s'],
        'OPTIONS': ['%(app_label)s.view_%(model_name)s'],
        'HEAD': ['%(app_label)s.view_%(model_name)s'],
        'POST': ['%(app_label)s.add_%(model_name)s'],
        'PATCH': ['%(app_label)s.change_%(model_name)s'],
        'DELETE': ['%(app_label)s.change_%(model_name)s'],
    }

    action_map = {
        "edit": {
            "GET": ["%(app_label)s.change_%(model_name)s"],
        },
        "validation_status": {
            "PATCH": ["%(app_label)s.validate_%(model_name)s"],
        }
    }

    def has_permission(self, request, view):
        if getattr(view, '_ignore_model_permissions', False):
            return True

        if not request.user:
            return False

        asset_uid = self._get_parents_query_dict(request).get("asset")
        asset = get_object_or_404(Asset, uid=asset_uid)
        required_permissions = self.get_required_permissions(request.method, view.action)
        user = request.user
        if user.is_anonymous():
            user = get_anonymous_user()

        user_permissions = list(asset.get_perms(user))

        if PERM_RESTRICTED_SUBMISSIONS in user_permissions:
            # Merge restricted permissions with permissions to find out if there
            # is a match within required permissions.
            # Restricted users will be narrowed down in MongoDB query.
            restricted_perms = asset.get_restricted_perms(user)
            if restricted_perms:
                user_permissions = list(set(
                    user_permissions + required_permissions
                ))

        has_perm = False
        for permission in required_permissions:
            if permission in user_permissions:
                has_perm = True
                break

        # We don't want to make a difference between non-existing assets vs non permitted assets
        # to avoid users to be able guess asset existence
        if not has_perm:
            # Except if users are allowed to view submissions, we want to show them Access Denied
            if request.method not in permissions.SAFE_METHODS:
                view_permissions = self.get_required_permissions("GET")
                can_view = view_permissions[0] in user_permissions
                if can_view:
                    return False

            raise Http404

        return True

    def get_required_permissions(self, method, action=None):
        """
        Given a model and an HTTP method, return the list of permission
        codes that the user is required to have.

        :param method: str. e.g. Mostly keys of `perms_map`
        :param action: str. Optional
        :return:
        """
        app_label = Asset._meta.app_label

        kwargs = {
            'app_label': app_label,
            'model_name': self.MODEL_NAME
        }

        # Handle
        if action in self.action_map and self.action_map.get(action).get(method):
            perms = [perm % kwargs for perm in self.action_map.get(action).get(method)]
        else:
            if method not in self.perms_map:
                raise exceptions.MethodNotAllowed(method)

            perms = [perm % kwargs for perm in self.perms_map[method]]

        return [perm.replace("{}.".format(app_label), "") for perm in perms]
