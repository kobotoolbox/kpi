import os

from django.contrib.auth.models import User
from django.db import models
from django.db import ProgrammingError
from django.utils.translation import ugettext_lazy

from jsonfield import JSONField


class ReadOnlyModelError(ValueError):
    pass


class _ReadOnlyModel(models.Model):
    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        raise ReadOnlyModelError('Cannot save read-only-model')

    def delete(self, *args, **kwargs):
        raise ReadOnlyModelError('Cannot delete read-only-model')


class LazyModelGroup:
    @property
    def XForm(self):
        if not hasattr(self, '_XForm'):
            self._define()
        return self._XForm

    @property
    def Instance(self):
        if not hasattr(self, '_Instance'):
            self._define()
        return self._Instance

    @property
    def Attachment(self):
        if not hasattr(self, '_Attachment'):
            self._define()
        return self._Attachment

    @property
    def UserProfile(self):
        if not hasattr(self, '_UserProfile'):
            self._define()
        return self._UserProfile

    def _define(self):
        class _ReadOnlyXform(_ReadOnlyModel):
            class Meta:
                managed = False
                db_table = 'logger_xform'
                verbose_name = 'xform'
                verbose_name_plural = 'xforms'

            xml = models.TextField()
            user = models.ForeignKey(User, null=True)
            id_string = models.SlugField()
            date_created = models.DateTimeField()
            date_modified = models.DateTimeField()
            uuid = models.CharField(max_length=249, default=u'')

        class _ReadOnlyInstance(_ReadOnlyModel):
            class Meta:
                managed = False
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

        class _ReadOnlyAttachment(_ReadOnlyModel):
            class Meta:
                managed = False
                db_table = 'logger_attachment'
                verbose_name = 'attachment'
                verbose_name_plural = 'attachments'

            instance = models.ForeignKey(_ReadOnlyInstance, related_name="attachments")
            media_file = models.FileField(max_length=380)
            mimetype = models.CharField(max_length=50, null=False, blank=True, default='')

            @property
            def filename(self):
                return os.path.basename(self.media_file.name)

            @property
            def can_view_submission(self):
                # TODO: Only attachments synced to s3 should be viewable by other users
                # Can determine this by looking at media_file upload properties
                # Alternatively, can move this into User Profile or Asset permissions logic
                return True

        class _UserProfile(models.Model):
            '''
            From onadata/apps/main/models/user_profile.py
            Not read-only because we need write access to `require_auth`
            '''
            class Meta:
                managed = False
                db_table = 'main_userprofile'
                verbose_name = 'user profile'
                verbose_name_plural = 'user profiles'

            # This field is required.
            user = models.OneToOneField(User, related_name='profile')

            # Other fields here
            name = models.CharField(max_length=255, blank=True)
            city = models.CharField(max_length=255, blank=True)
            country = models.CharField(max_length=2, blank=True)
            organization = models.CharField(max_length=255, blank=True)
            home_page = models.CharField(max_length=255, blank=True)
            twitter = models.CharField(max_length=255, blank=True)
            description = models.CharField(max_length=255, blank=True)
            require_auth = models.BooleanField(
                default=False,
                verbose_name=ugettext_lazy(
                    "Require authentication to see forms and submit data"
                )
            )
            address = models.CharField(max_length=255, blank=True)
            phonenumber = models.CharField(max_length=30, blank=True)
            created_by = models.ForeignKey(User, null=True, blank=True)
            num_of_submissions = models.IntegerField(default=0)
            metadata = JSONField(default={}, blank=True)

        self._XForm = _ReadOnlyXform
        self._Instance = _ReadOnlyInstance
        self._Attachment = _ReadOnlyAttachment
        self._UserProfile = _UserProfile

_models = LazyModelGroup()


def safe_kc_read(func):
    def _wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ProgrammingError as e:
            raise ProgrammingError('kc_reader error accessing kobocat '
                                   'tables: {}'.format(e.message))
    return _wrapper
