from django.db import models
from django.core.exceptions import ValidationError
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

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
    ''' Return all objects of type klass on which user has been assigned any
    permission. '''
    return klass.objects.filter(pk__in=ObjectPermission.objects.filter(
        user=user,
        content_type=ContentType.objects.get_for_model(klass)
    ).values_list('object_id', flat=True))

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
