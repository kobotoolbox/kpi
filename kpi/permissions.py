from django.contrib.auth.models import AnonymousUser
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from rest_framework import permissions

def _get_perm_name(perm_name_prefix, model_instance):
    '''
    Get the type-specific permission name for a model from a permission name
    prefix and a model instance.

    Example:
        >>>self._get_perm_name('view_', my_survey_asset)
        'view_surveyasset'

    :param perm_name_prefix: Prefix of the desired permission name (i.e.
        "view_", "change_", or "delete_").
    :type perm_name_prefix: str
    :param model_instance: An instance of the model for which the permission
        name is desired.
    :type model_instance: :py:class:`Collection` or :py:class:`SurveyAsset`
    :return: The computed permission name.
    :rtype: str
    '''
    perm_name= Permission.objects.get(
        content_type= ContentType.objects.get_for_model(model_instance),
        codename__startswith=perm_name_prefix
    ).natural_key()[0]
    return perm_name


# FIXME: Name is no longer accurate.
class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object to edit it.
    """

    def has_object_permission(self, request, view, obj):
        if not request.user:
            import ipdb; ipdb.set_trace()
            request.user= AnonymousUser

        # Allow the owner any permission (even if the permission has been
        #   explicitly revoked).
        if obj.owner == request.user:
            return True

        import ipdb; ipdb.set_trace()
        # Read permissions are allowed to any request,
        # so we'll always allow GET, HEAD or OPTIONS requests.
        view_perm_name= _get_perm_name('view_', obj)
        if (request.method in permissions.SAFE_METHODS) and \
                request.user.has_perm(view_perm_name, obj):
            return True

        # Write permissions.
        edit_perm_name= _get_perm_name('edit_', obj)
        if (request.method in ['POST', 'PATCH', 'PUT']) and \
                request.user.has_perm(edit_perm_name, obj):
            return True

        return False
