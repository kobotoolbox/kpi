from copy import deepcopy

from rest_framework.permissions import (
    SAFE_METHODS,
    DjangoObjectPermissions,
    IsAuthenticated,
)

from kobo.apps.openrosa.apps.api.exceptions import LegacyAPIException
from kpi.constants import (
    PERM_CHANGE_ASSET,
    PERM_DELETE_SUBMISSIONS,
    PERM_VALIDATE_SUBMISSIONS,
)
from kpi.utils.permissions import is_user_anonymous


class ViewDjangoObjectPermissions(DjangoObjectPermissions):
    perms_map = {
        'GET': ['%(app_label)s.view_%(model_name)s'],
        'OPTIONS': [],
        'HEAD': [],
        'POST': ['%(app_label)s.add_%(model_name)s'],
        'PUT': ['%(app_label)s.change_%(model_name)s'],
        'PATCH': ['%(app_label)s.change_%(model_name)s'],
        'DELETE': ['%(app_label)s.delete_%(model_name)s'],
    }


class AssetObjectPermissions(DjangoObjectPermissions):
    perms_map = {
        'GET': ['kpi.view_asset'],
        'OPTIONS': [],
        'HEAD': [],
        'POST': ['kpi.add_asset'],
        'PUT': ['kpi.change_asset'],
        'PATCH': ['kpi.change_asset'],
        'DELETE': ['kpi.delete_asset'],
    }


class ObjectPermissionsWithViewRestricted(DjangoObjectPermissions):
    """
    The default `perms_map` does not include GET, OPTIONS, or HEAD, meaning
    anyone can view objects. We override this here to check for `view_…`
    permissions before allowing objects to be seen. Refer to
    https://www.django-rest-framework.org/api-guide/permissions/#djangoobjectpermissions
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Do NOT mutate `perms_map` from the parent class! Doing so will affect
        # *every* instance of `DjangoObjectPermissions` and all its subclasses
        self.perms_map = deepcopy(self.perms_map)
        self.perms_map['GET'] = ['%(app_label)s.view_%(model_name)s']
        self.perms_map['OPTIONS'] = ['%(app_label)s.view_%(model_name)s']
        self.perms_map['HEAD'] = ['%(app_label)s.view_%(model_name)s']

        # `PATCH` should already be set properly by DRF, but it used to be
        # explicitly assigned here as well. Double-check that it's right
        assert self.perms_map['PATCH'] == ['%(app_label)s.change_%(model_name)s']

    def get_required_permissions(self, method, model_cls):

        app_label = (
            model_cls._meta.app_label
            if not hasattr(self, 'APP_LABEL')
            else self.APP_LABEL
        )
        model_name = (
            model_cls._meta.model_name
            if not hasattr(self, 'MODEL_NAME')
            else self.MODEL_NAME
        )
        kwargs = {
            'app_label': app_label,
            'model_name': model_name
        }
        return [perm % kwargs for perm in self.perms_map[method]]

    def get_required_object_permissions(self, method, model_cls):
        return self.get_required_permissions(method, model_cls)

    authenticated_users_only = False


class XFormPermissions(ObjectPermissionsWithViewRestricted):
    APP_LABEL = 'kpi'
    MODEL_NAME = 'asset'

    def has_permission(self, request, view):
        # Allow anonymous users to access shared data
        is_anonymous = is_user_anonymous(request.user)
        if is_anonymous:
            return (
                request.method in SAFE_METHODS
                and view.action
                and view.action == 'retrieve'
            )

        if (
            request.method not in SAFE_METHODS
            and view.action
            and view.action in ['create', 'update', 'partial_update', 'destroy']
        ):
            raise LegacyAPIException

        return super().has_permission(request, view)

    def has_object_permission(self, request, view, obj):
        # Allow anonymous users to access shared data
        if request.method in SAFE_METHODS and view.action == 'retrieve':
            if obj.shared:
                return True
        if request.method == 'POST':
            post_view = getattr(view, 'post', object)
            url_name = getattr(post_view, 'url_name', None)
            # Labels POST action goes through this permission class. By default,
            # the POST action is not associated to changing the asset but to creating
            # a new asset, so we need to check for change asset permissions instead
            if url_name == 'labels':
                return request.user.has_perm(PERM_CHANGE_ASSET, obj.asset)

        return super().has_object_permission(request, view, obj.asset)


class XFormDataPermissions(ObjectPermissionsWithViewRestricted):
    APP_LABEL = 'kpi'
    MODEL_NAME = 'asset'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Those who can edit submissions can also delete them, following the
        # behavior of `kobo.apps.openrosa.apps.main.views.delete_data`
        self.perms_map = deepcopy(self.perms_map)
        self.perms_map['DELETE'] = [f'kpi.{PERM_DELETE_SUBMISSIONS}']

    def has_permission(self, request, view):
        lookup_field = view.lookup_field
        lookup = view.kwargs.get(lookup_field)
        is_anonymous = is_user_anonymous(request.user)
        allowed_anonymous_actions = ['retrieve']
        if lookup:
            # We need to grant access to anonymous on list endpoint too when
            # a form pk is specified. e.g. `/api/v1/data/{pk}.json
            allowed_anonymous_actions.append('list')

        if (
            request.method in SAFE_METHODS
            and view.action in allowed_anonymous_actions
        ):
            return True
        # No need to check more permissions if it's an anonymous user (saves db queries)
        if is_anonymous:
            return False

        return super().has_permission(request, view)

    def has_object_permission(self, request, view, obj):
        user = request.user

        # Grant access if user is the owner or a superuser
        if user.is_superuser or user == obj.user:
            return True

        allowed_anonymous_actions = ['retrieve', 'list']
        # Allow anonymous users to access shared data
        if (
            request.method in SAFE_METHODS
            and view.action in allowed_anonymous_actions
            and obj.shared_data
        ):
            return True

        # TODO Use a better solution than these mapping.
        #  E.g.:
        #  - Add new endpoints for enketo-edit and enketo-view -- DONE
        #  - Add new permission classes for each action -- DONE
        #  - Remove this kludgy solution
        perms_actions_map = {
            'bulk_delete': {
                'DELETE': [f'kpi.{PERM_DELETE_SUBMISSIONS}'],
            },
            'bulk_validation_status': {
                'PATCH': [f'kpi.{PERM_VALIDATE_SUBMISSIONS}'],
            },
            'labels': {'DELETE': [f'kpi.{PERM_CHANGE_ASSET}']},
            'validation_status': {
                'DELETE': [f'kpi.{PERM_VALIDATE_SUBMISSIONS}'],
                'PATCH': [f'kpi.{PERM_VALIDATE_SUBMISSIONS}'],
            },
        }

        try:
            required_perms = perms_actions_map[view.action][request.method]
        except KeyError:
            pass
        else:
            # Deleting submissions is not allowed with KoboCAT API
            if view.action == 'bulk_delete':
                raise LegacyAPIException

            return user.has_perms(required_perms, obj.asset)

        # Deleting submissions is not allowed with KoboCAT API
        if view.action == 'destroy':
            raise LegacyAPIException

        return super().has_object_permission(request, view, obj)


class AttachmentObjectPermissions(DjangoObjectPermissions):

    def __init__(self, *args, **kwargs):
        # The default `perms_map` does not include GET, OPTIONS, PATCH or HEAD.
        # See http://www.django-rest-framework.org/api-guide/filtering/#djangoobjectpermissionsfilter  # noqa
        self.perms_map = deepcopy(DjangoObjectPermissions.perms_map)
        self.perms_map['GET'] = ['kpi.view_asset']
        self.perms_map['OPTIONS'] = ['kpi.view_asset']
        self.perms_map['HEAD'] = ['kpi.view_asset']
        return super().__init__(*args, **kwargs)

    def has_permission(self, request, view):
        if request.user and request.user.is_superuser:
            return True

        return super().has_permission(request, view)

    def has_object_permission(self, request, view, obj):
        if request.user and request.user.is_superuser:
            return True

        return super().has_object_permission(request, view, obj.xform.asset)


__permissions__ = [DjangoObjectPermissions, IsAuthenticated]
