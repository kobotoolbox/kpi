from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from rest_framework import permissions, exceptions


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
        perm_name_prefix+= '_'

    perm_name= Permission.objects.get(
        content_type=ContentType.objects.get_for_model(model_instance),
        codename__startswith=perm_name_prefix
    ).natural_key()[0]

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


class ClonePermissions(permissions.DjangoModelPermissions):
    '''
    Defers to DjangoModelPermissions for model-level queries (e.g. a POST to
    /assets/ requires `add_asset`), and checks to see if the user has view
    access to the particular object
    '''
    ALLOWED_METHODS = ('POST',)
    def _check_allowed_method(self, request):
        if request.method not in self.ALLOWED_METHODS:
            raise exceptions.MethodNotAllowed(request.method)
    def has_permission(self, request, view):
        self._check_allowed_method(request)
        return super(ClonePermissions, self).has_permission(request, view)
    def has_object_permission(self, request, view, obj):
        self._check_allowed_method(request)
        view_perm = get_perm_name('view', obj)
        return request.user.has_perm(view_perm, obj)
