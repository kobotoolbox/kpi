from django.db import models
from django.core.exceptions import ValidationError, ImproperlyConfigured
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth.models import User, AnonymousUser, Permission
from django.conf import settings
import copy
import re

def perm_parse(perm, obj=None):
    if obj is not None:
        obj_app_label = ContentType.objects.get_for_model(obj).app_label
    else:
        obj_app_label = None
    try:
        app_label, codename = perm.split('.', 1)
        if app_label != obj_app_label:
            raise ValidationError('The app specified in the permission string '
                'does not contain the given object.')
    except ValueError:
        app_label = obj_app_label
        codename = perm
    return app_label, codename

def get_all_objects_for_user(user, klass):
    ''' Return all objects of type klass to which user has been assigned any
    permission. '''
    return klass.objects.filter(pk__in=ObjectPermission.objects.filter(
        user=user,
        content_type=ContentType.objects.get_for_model(klass)
    ).values_list('object_id', flat=True))

def get_anonymous_user():
    ''' Return a real User in the database to represent AnonymousUser. '''
    try:
        user = User.objects.get(pk=settings.ANONYMOUS_USER_ID)
    except User.DoesNotExist:
        username = getattr(
            settings,
            'ANONYMOUS_DEFAULT_USERNAME_VALUE',
            'AnonymousUser'
        )
        user = User.objects.create(
            pk=settings.ANONYMOUS_USER_ID,
            username=username
        )
    return user


class ObjectPermissionManager(models.Manager):
    def _rewrite_query_args(self, method, content_object, **kwargs):
        ''' Rewrite content_object into object_id and content_type, then pass
        those together with **kwargs to the given method. '''
        content_type = ContentType.objects.get_for_model(content_object)
        kwargs['object_id'] = content_object.pk
        kwargs['content_type'] = content_type
        return method(**kwargs)

    def get_for_object(self, content_object, **kwargs):
        ''' Wrapper to allow get() queries using a generic foreign key. '''
        return self._rewrite_query_args(
            super(ObjectPermissionManager, self).get,
            content_object, **kwargs
        )

    def filter_for_object(self, content_object, **kwargs):
        ''' Wrapper to allow filter() queries using a generic foreign key. '''
        return self._rewrite_query_args(
            super(ObjectPermissionManager, self).filter,
            content_object, **kwargs
        )

    def get_or_create_for_object(self, content_object, **kwargs):
        ''' Wrapper to allow get_or_create() calls using a generic foreign
        key. '''
        return self._rewrite_query_args(
            super(ObjectPermissionManager, self).get_or_create,
            content_object, **kwargs
        )


class ObjectPermission(models.Model):
    ''' An application of an auth.Permission instance to a specific
    content_object. Call ObjectPermission.objects.get_for_object() or
    filter_for_object() to run queries using the content_object field. '''
    user = models.ForeignKey('auth.User')
    permission = models.ForeignKey('auth.Permission')
    deny = models.BooleanField(default=False)
    inherited = models.BooleanField(default=False)
    object_id = models.PositiveIntegerField()
    # We can't do something like GenericForeignKey('permission__content_type'),
    # so duplicate the content_type field here.
    content_type = models.ForeignKey(ContentType)
    content_object = GenericForeignKey('content_type', 'object_id')
    objects = ObjectPermissionManager()

    class Meta:
        unique_together = ('user', 'permission', 'deny', 'inherited',
            'object_id', 'content_type')

    def save(self, *args, **kwargs):
        if self.permission.content_type_id is not self.content_type_id:
            raise ValidationError('The content type of the permission does '
                'not match that of the object.')
        super(ObjectPermission, self).save(*args, **kwargs)


class ObjectPermissionMixin(object):
    ''' A mixin class that adds the methods necessary for object-level
    permissions to a model (either models.Model or MPTTModel). The model must
    define parent, get_descendants_list(), ASSIGNABLE_PERMISSIONS,
    CALCULATED_PERMISSIONS, and, if parent references a different model,
    MAPPED_PARENT_PERMISSIONS. A post_delete signal receiver should also clean
    up any ObjectPermission records associated with the model instance.
    The MRO is important, so be sure to include this mixin before the base
    class in your model definition, e.g.
        class MyAwesomeModel(ObjectPermissionMixin, models.Model)
    '''
    def save(self, *args, **kwargs):
        # Make sure we exist in the database before proceeding
        super(ObjectPermissionMixin, self).save(*args, **kwargs)
        # We may have a differnet parent; recalculate inherited permissions
        self._recalculate_inherited_perms()
        # Recalculate all descendants
        for descendant in self.get_descendants_list():
            descendant._recalculate_inherited_perms()

    def _get_effective_perms(
        self, user=None, codename=None, include_calculated=True
    ):
        ''' Reconcile all grant and deny permissions, and return an
        authoritative set of grant permissions (i.e. deny=False) for the
        current object. '''
        # Including calculated permissions means we can't just pass kwargs
        # through to filter(), but we'll map the ones we understand.
        kwargs = {}
        if user is not None:
            kwargs['user'] = user
        if codename is not None:
            # share_ requires loading change_ from the database
            if codename.startswith('share_'):
                kwargs['permission__codename'] = re.sub(
                    '^share_', 'change_', codename, 1)
            else:
                kwargs['permission__codename'] = codename
        grant_perms = set(ObjectPermission.objects.filter_for_object(self,
            deny=False, **kwargs).values_list('user_id', 'permission_id'))
        deny_perms = set(ObjectPermission.objects.filter_for_object(self,
            deny=True, **kwargs).values_list('user_id', 'permission_id'))
        effective_perms = grant_perms.difference(deny_perms)
        # Sometimes only the explicitly assigned permissions are wanted,
        # e.g. when calculating inherited permissions
        if not include_calculated:
            return effective_perms
        # Add on the calculated permissions
        content_type = ContentType.objects.get_for_model(self)
        if codename in self.CALCULATED_PERMISSIONS:
            # A sepecific query for a calculated permission should not return
            # any explicitly assigned permissions, e.g. share_ should not
            # include change_
            effective_perms_copy = effective_perms
            effective_perms = set()
        else:
            effective_perms_copy = copy.copy(effective_perms)
        if self.editors_can_change_permissions and (
            codename is None or codename.startswith('share_')):
            # Everyone with change_ should also get share_
            change_permission = Permission.objects.get(
                content_type=content_type,
                codename__startswith='change_'
            )
            share_permission = Permission.objects.get(
                content_type=content_type,
                codename__startswith='share_'
            )
            for user_id, permission_id in effective_perms_copy:
                if permission_id == change_permission.pk:
                    effective_perms.add((user_id, share_permission.pk))
        # The owner has the delete_ permission
        if self.owner is not None and (
            user is None or user.pk == self.owner.pk) and (
            codename is None or codename.startswith('delete_')):
            delete_permission = Permission.objects.get(
                content_type=content_type,
                codename__startswith='delete_'
            )
            effective_perms.add((self.owner.pk, delete_permission.pk))
        return effective_perms

    def _recalculate_inherited_perms(self):
        ''' Copy all of our parent's effective permissions to ourself,
        marking the copies as inherited permissions. The owner's rights are
        also made explicit as "inherited" permissions. '''
        # Start with a clean slate
        ObjectPermission.objects.filter_for_object(
            self,
            inherited=True
        ).delete()
        # Is there anything to inherit?
        if self.parent is not None:
            # All our parent's effective permissions become our inherited
            # permissions
            # Store translations in a dictionary here to minimize invocations
            # of the Django machinery
            translate_perm = {}
            for user_id, permission_id in self.parent._get_effective_perms(
                include_calculated=False
            ):
                if hasattr(self, 'MAPPED_PARENT_PERMISSIONS'):
                    try:
                        translated_id = translate_perm[permission_id]
                    except KeyError:
                        parent_perm = Permission.objects.get(pk=permission_id)
                        try:
                            translated_codename = \
                                self.MAPPED_PARENT_PERMISSIONS[
                                    parent_perm.codename]
                        except KeyError:
                            # We haven't been configured to inherit this
                            # permission from our parent, so skip it
                            continue
                        permission_id = Permission.objects.get(
                            content_type__app_label=\
                                parent_perm.content_type.app_label,
                            codename=translated_codename
                        ).pk
                elif type(self) is not type(self.parent):
                    raise ImproperlyConfigured(
                        'Parent of {} is a {}, but the child has not defined '
                        'MAPPED_PARENT_PERMISSIONS.'.format(
                            type(self), type(self.parent))
                    )
                ObjectPermission.objects.create(
                    content_object=self,
                    user_id=user_id,
                    permission_id=permission_id,
                    inherited=True
                )
        # The owner gets every assignable permission
        if self.owner is not None:
            content_type = ContentType.objects.get_for_model(self)
            for perm in Permission.objects.filter(
                content_type=content_type,
                codename__in=self.ASSIGNABLE_PERMISSIONS
            ):
                # Use get_or_create in case the owner already has permissions
                ObjectPermission.objects.get_or_create_for_object(
                    self,
                    user=self.owner,
                    permission=perm,
                    inherited=True
                )

    def assign_perm(self, user_obj, perm, deny=False, defer_recalc=False):
        ''' Assign user_obj the given perm on this object. To break
        inheritance from a parent object, use deny=True. '''
        app_label, codename = perm_parse(perm, self)
        if codename not in self.ASSIGNABLE_PERMISSIONS:
            # Some permissions are calculated and not stored in the database
            raise ValidationError('{} cannot be assigned explicitly.'.format(
                codename)
            )
        if isinstance(user_obj, AnonymousUser):
            # Is an anonymous user allowed to have this permission?
            if not codename in settings.ALLOWED_ANONYMOUS_PERMISSIONS:
                raise ValidationError(
                    'Anonymous users cannot have the permission {}.'.format(
                        codename)
                )
            # Get the User database representation for AnonymousUser
            user_obj = get_anonymous_user()
        perm_model = Permission.objects.get(
            content_type__app_label=app_label,
            codename=codename
        )
        existing_perms = ObjectPermission.objects.filter_for_object(
            self,
            user=user_obj,
        )
        if existing_perms.filter(
            inherited=False,
            permission_id=perm_model.pk,
            deny=deny,
        ):
            # The user already has this permission directly applied
            return
        # Remove any explicitly-defined contradictory grants or denials
        existing_perms.filter(user=user_obj,
            permission_id=perm_model.pk,
            deny=not deny,
            inherited=False
        ).delete()
        # Create the new permission
        ObjectPermission.objects.create(
            content_object=self,
            user=user_obj,
            permission_id=perm_model.pk,
            deny=deny,
            inherited=False
        )
        # Granting change implies granting view
        if codename.startswith('change_') and not deny:
            change_codename = re.sub('^change_', 'view_', codename)
            self.assign_perm(user_obj, change_codename, defer_recalc=True)
        # Denying view implies denying change
        if deny and codename.startswith('view_'):
            change_codename = re.sub('^view_', 'change_', codename)
            self.assign_perm(user_obj, change_codename,
                             deny=True, defer_recalc=True)
        # We might have been called by ourself to assign a related
        # permission. In that case, don't recalculate here.
        if defer_recalc:
            return
        # Recalculate all descendants
        for descendant in self.get_descendants_list():
            descendant._recalculate_inherited_perms()

    def get_perms(self, user_obj):
        ''' Return a list of codenames of all effective grant permissions that
        user_obj has on this object. '''
        user_perm_ids = self._get_effective_perms(user=user_obj)
        perm_ids = [x[1] for x in user_perm_ids]
        return Permission.objects.filter(pk__in=perm_ids).values_list(
            'codename', flat=True)

    def get_users_with_perms(self, attach_perms=False):
        ''' Return a QuerySet of all users with any effective grant permission
        on this object. If attach_perms=True, then return a dict with
        users as the keys and lists of their permissions as the values. '''
        user_perm_ids = self._get_effective_perms()
        if attach_perms:
            user_perm_dict = {}
            for user_id, perm_id in user_perm_ids:
                perm_list = user_perm_dict.get(user_id, [])
                perm_list.append(Permission.objects.get(pk=perm_id).codename)
                user_perm_dict[user_id] = perm_list
            # Resolve user ids into actual user objects
            user_perm_dict = {User.objects.get(pk=key): value for (key, value)
                in user_perm_dict.iteritems()}
            return user_perm_dict
        else:
            # Use a set to avoid duplicate users
            user_ids = {x[0] for x in user_perm_ids}
            return User.objects.filter(pk__in=user_ids)

    def has_perm(self, user_obj, perm):
        ''' Does user_obj have perm on this object? (True/False) '''
        app_label, codename = perm_parse(perm, self)
        is_anonymous = False
        if isinstance(user_obj, AnonymousUser):
            # Get the User database representation for AnonymousUser
            user_obj = get_anonymous_user()
            is_anonymous = True
        # Treat superusers the way django.contrib.auth does
        if user_obj.is_active and user_obj.is_superuser:
            return True
        # Look for matching permissions
        result = len(self._get_effective_perms(
            user=user_obj,
            codename=codename
        )) == 1
        if not result and not is_anonymous:
            # The user-specific test failed, but does the public have access?
            result = self.has_perm(AnonymousUser(), perm)
        if result and is_anonymous:
            # Is an anonymous user allowed to have this permission?
            if not codename in settings.ALLOWED_ANONYMOUS_PERMISSIONS:
                return False
        return result

    def remove_perm(self, user_obj, perm, deny=False):
        ''' Revoke perm on this object from user_obj. '''
        if isinstance(user_obj, AnonymousUser):
            # Get the User database representation for AnonymousUser
            user_obj = get_anonymous_user()
        app_label, codename = perm_parse(perm, self)
        if codename not in self.ASSIGNABLE_PERMISSIONS:
            # Some permissions are calculated and not stored in the database
            raise ValidationError('{} cannot be removed explicitly.'.format(
                codename)
            )
        ObjectPermission.objects.filter_for_object(
            self,
            user=user_obj,
            permission__codename=codename,
            deny=deny,
            inherited=False
        ).delete()
        # Recalculate all descendants
        for descendant in self.get_descendants_list():
            descendant._recalculate_inherited_perms()
