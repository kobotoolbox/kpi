from django.db import models
from django.core.exceptions import ValidationError
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

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

class ObjectPermission(models.Model):
    ''' An application of an auth.Permission instance to a specific
    content_object. Call ObjectPermission.objects.get_for_object() or
    filter_for_object() to run queries using the content_object field. '''
    permission = models.ForeignKey('auth.Permission')
    objects = ObjectPermissionManager()
    object_id = models.PositiveIntegerField()
    # We can't do something like GenericForeignKey('permission__content_type'),
    # so duplicate the content_type field here.
    content_type = models.ForeignKey(ContentType)
    content_object = GenericForeignKey('content_type', 'object_id')
    # This whole model keeps looking worse and worse.
    user = models.ForeignKey('auth.User')
    
    def save(self, *args, **kwargs):
        self.content_type = self.permission.content_type
        if self.content_type.pk is not ContentType.objects.get_for_model(
            self.content_object).pk:
            raise ValidationError('The content type of the permission does '
                'not match that of the object.')
        super(ObjectPermission, self).save(*args, **kwargs)
