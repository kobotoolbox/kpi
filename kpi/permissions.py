from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework_extensions.settings import extensions_api_settings

from kpi.models.asset import Asset

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
    perms_map['GET']= ['%(app_label)s.view_%(model_name)s']
    perms_map['OPTIONS']= perms_map['GET']
    perms_map['HEAD']= perms_map['GET']


class PostMappedToChangePermission(IsOwnerOrReadOnly):
    '''
    Maps POST requests to the change_model permission instead of DRF's default
    of add_model
    '''
    perms_map = IsOwnerOrReadOnly.perms_map
    perms_map['POST'] = ['%(app_label)s.change_%(model_name)s']


class AssetOwnerNestedObjectsPermissions(permissions.BasePermission):
    """
    Permissions for objects that are nested under Asset which only owner should access.
    Others should receive a 404 response (instead of 403) to avoid revealing existence
    of objects.
    """
    def has_permission(self, request, view):

        if not request.user or (request.user and
                                (request.user.is_anonymous() or
                                not request.user.is_authenticated())):
            return False

        asset_uid = self.__get_parents_query_dict(request).get("asset")
        asset = get_object_or_404(Asset, uid=asset_uid)

        if request.user != asset.owner:
            raise Http404

        return True

    def has_object_permission(self, request, view, obj):
        # Because authentication checks have already executed via has_permission,
        # always return True.
        # Only owner can reach access this.
        return True

    def __get_parents_query_dict(self, request):
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