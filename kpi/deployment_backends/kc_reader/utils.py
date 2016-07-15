from django.contrib.auth.models import User
from django.db import models
from django.db import ProgrammingError


class __ReadOnlyModelError(ValueError):
    pass


class __ReadOnlyModel:
    def save(self, *args, **kwargs):
        raise __ReadOnlyModelError('Cannot save read-only-model')

    def delete(self, *args, **kwargs):
        raise __ReadOnlyModelError('Cannot delete read-only-model')


class _ReadOnlyXform(models.Model,
                      __ReadOnlyModel):
    class Meta:
        db_table = 'logger_xform'
        verbose_name = 'xform'
        verbose_name_plural = 'xforms'

    xml = models.TextField()
    user = models.ForeignKey(User, null=True)
    id_string = models.SlugField()
    date_created = models.DateTimeField()
    date_modified = models.DateTimeField()
    deleted_at = models.DateTimeField(null=True, default=None)
    status = models.CharField(max_length=20,
                              default=u'submitted_via_web')
    uuid = models.CharField(max_length=249, default=u'')


class __ReadOnlyInstance(models.Model,
                         __ReadOnlyModel):
    class Meta:
        db_table = 'logger_instance'
        verbose_name = 'instance'
        verbose_name_plural = 'instances'

    xml = models.TextField()
    user = models.ForeignKey(User, null=True)
    xform = models.ForeignKey(_ReadOnlyXform, related_name='instances')
    date_created = models.DateTimeField()
    date_modified = models.DateTimeField()
    deleted_at = models.DateTimeField(null=True, default=None)
    status = models.CharField(max_length=20,
                              default=u'submitted_via_web')
    uuid = models.CharField(max_length=249, default=u'')


def wrap_kc_reader_call(func):
    def _wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ProgrammingError as e:
            raise ProgrammingError('kc_reader error accessing kobocat '
                                   'tables: {}'.format(e.message))
    return _wrapper


@wrap_kc_reader_call
def instance_count(xform_id_string, user_id, version_id=None):
    return __ReadOnlyInstance.objects.filter(xform__user_id=user_id,
                                             xform__id_string=xform_id_string,
                                             ).count()
