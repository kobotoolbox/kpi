import os
import json
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.db import ProgrammingError
from django.utils.translation import ugettext_lazy
from hashlib import md5

from jsonfield import JSONField
from collections import OrderedDict


class ReadOnlyModelError(ValueError):
    pass


class _ReadOnlyModel(models.Model):
    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        raise ReadOnlyModelError('Cannot save read-only-model')

    def delete(self, *args, **kwargs):
        raise ReadOnlyModelError('Cannot delete read-only-model')

    @classmethod
    def upload_to(self, *args, **kwargs):
        raise ReadOnlyModelError('Cannot use read-only-model to upload assets')

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

    @staticmethod
    def get_content_type_for_model(model):
        MODEL_NAME_MAPPING = {
            '_readonlyxform': ('logger', 'xform'),
            '_readonlyinstance': ('logger', 'instance'),
            '_readonlyattachment': ('logger', 'attachment'),
            '_userprofile': ('main', 'userprofile')
        }
        try:
            app_label, model_name = MODEL_NAME_MAPPING[model._meta.model_name]
        except KeyError:
            raise NotImplementedError
        return ContentType.objects.get(app_label=app_label, model=model_name)


    def _define(self):
        class _ReadOnlyXform(_ReadOnlyModel):
            class Meta:
                managed = False
                db_table = 'logger_xform'
                verbose_name = 'xform'
                verbose_name_plural = 'xforms'

            XFORM_TITLE_LENGTH = 255
            xls = models.FileField(null=True)
            xml = models.TextField()
            json = models.TextField(default=u'')
            user = models.ForeignKey(User, related_name='xforms', null=True)
            downloadable = models.BooleanField(default=True)
            id_string = models.SlugField()
            title = models.CharField(max_length=XFORM_TITLE_LENGTH)
            date_created = models.DateTimeField()
            date_modified = models.DateTimeField()
            uuid = models.CharField(max_length=32, default=u'')

            @property
            def hash(self):
                return u'%s' % md5(self.xml.encode('utf8')).hexdigest()

            @property
            def prefixed_hash(self):
                ''' Matches what's returned by the KC API '''
                return u"md5:%s" % self.hash

            @property
            def questions(self):
                try:
                    questions = json.loads(self.json).get('children', [])
                    for index, question in enumerate(questions):
                        question.pop('bind', None)
                        question['number'] = index+1

                    return questions
                except ValueError:
                    return []


        class _ReadOnlyInstance(_ReadOnlyModel):
            class Meta:
                managed = False
                db_table = 'logger_instance'
                verbose_name = 'instance'
                verbose_name_plural = 'instances'

            xml = models.TextField()
            json = JSONField(default={}, null=False)
            user = models.ForeignKey(User, null=True)
            xform = models.ForeignKey(_ReadOnlyXform, related_name='instances')
            date_created = models.DateTimeField()
            date_modified = models.DateTimeField()
            deleted_at = models.DateTimeField(null=True, default=None)
            status = models.CharField(max_length=20,
                                      default=u'submitted_via_web')
            uuid = models.CharField(max_length=249, default=u'')

            @property
            def submission(self):
                try:
                    username = self.xform.user.username
                except ValueError:
                    username = None

                return OrderedDict({
                    'xform_id': self.xform.id_string,
                    'instance_uuid': self.uuid,
                    'username': username,
                    'status': self.status,
                    'date_created': self.date_created,
                    'date_modified': self.date_modified
                })

        class _ReadOnlyAttachment(_ReadOnlyModel):
            class Meta:
                managed = False
                db_table = 'logger_attachment'
                verbose_name = 'attachment'
                verbose_name_plural = 'attachments'

            instance = models.ForeignKey(_ReadOnlyInstance, related_name="attachments")
            media_file = models.FileField(upload_to=_ReadOnlyModel.upload_to, max_length=380)
            mimetype = models.CharField(max_length=50, null=False, blank=True, default='')

            @property
            def filename(self):
                return os.path.basename(self.media_file.name)

            @property
            def question_name(self):
                qa_dict = self.instance.json
                if self.filename not in qa_dict.values():
                    return None

                return qa_dict.keys()[qa_dict.values().index(self.filename)]

            @property
            def question(self):
                if not self.question_name or not self.instance.xform.questions:
                    return None

                for question in self.instance.xform.questions:
                    if question['name'] == self.question_name:
                        return question

                return None

            @property
            def question_index(self):
                if not self.question:
                    return self.id

                return self.question['number'] or self.question_name

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
