# coding: utf-8
import json
import os
import re
from copy import deepcopy
from io import BytesIO
from xml.sax.saxutils import escape as xml_escape

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.urls import reverse
from django.db import models
from django.db.models.signals import post_save, post_delete, pre_delete
from django.utils.encoding import smart_str
from django.utils.translation import gettext_lazy as t
from taggit.managers import TaggableManager

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.fields import LazyDefaultBooleanField
from kobo.apps.openrosa.apps.logger.models.daily_xform_submission_counter import DailyXFormSubmissionCounter
from kobo.apps.openrosa.apps.logger.models.monthly_xform_submission_counter import (
    MonthlyXFormSubmissionCounter,
)
from kobo.apps.openrosa.apps.logger.xform_instance_parser import XLSFormError
from kobo.apps.openrosa.koboform.pyxform_utils import convert_csv_to_xls
from kobo.apps.openrosa.libs.models.base_model import BaseModel
from kobo.apps.openrosa.libs.constants import (
    CAN_ADD_SUBMISSIONS,
    CAN_VALIDATE_XFORM,
    CAN_DELETE_DATA_XFORM,
    CAN_TRANSFER_OWNERSHIP,
)
from kobo.apps.openrosa.libs.utils.guardian import (
    assign_perm,
    get_perms_for_model
)
from kobo.apps.openrosa.libs.utils.hash import get_hash
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)
from kpi.models.asset import Asset
from kpi.utils.xml import XMLFormWithDisclaimer

XFORM_TITLE_LENGTH = 255
title_pattern = re.compile(r"<h:title>([^<]+)</h:title>")


def upload_to(instance, filename):
    return os.path.join(
        instance.user.username, 'xls', os.path.split(filename)[1]
    )


class XFormWithoutPendingDeletedManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().exclude(pending_delete=True)


class XFormAllManager(models.Manager):
    pass


class XForm(BaseModel):
    CLONED_SUFFIX = '_cloned'
    MAX_ID_LENGTH = 100

    xls = models.FileField(
        storage=default_storage, upload_to=upload_to, null=True
    )
    json = models.TextField(default='')
    description = models.TextField(default='', null=True)
    xml = models.TextField()

    user = models.ForeignKey(User, related_name='xforms', null=True, on_delete=models.CASCADE)
    require_auth = models.BooleanField(
        default=True,
        verbose_name=t('Require authentication to see form and submit data'),
    )
    shared = models.BooleanField(default=False)
    shared_data = models.BooleanField(default=False)
    downloadable = models.BooleanField(default=True)
    encrypted = models.BooleanField(default=False)

    id_string = models.SlugField(
        editable=False,
        verbose_name=t("ID"),
        max_length=MAX_ID_LENGTH
    )
    title = models.CharField(editable=False, max_length=XFORM_TITLE_LENGTH)
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)
    last_submission_time = models.DateTimeField(blank=True, null=True)
    has_start_time = models.BooleanField(default=False)
    uuid = models.CharField(max_length=32, default='', db_index=True)

    uuid_regex = re.compile(r'(<instance>.*?id="[^"]+">)(.*</instance>)(.*)',
                            re.DOTALL)
    instance_id_regex = re.compile(r'<instance>.*?id="([^"]+)".*</instance>',
                                   re.DOTALL)
    uuid_node_location = 2
    uuid_bind_location = 4
    instances_with_geopoints = models.BooleanField(default=False)
    num_of_submissions = models.IntegerField(default=0)
    attachment_storage_bytes = models.BigIntegerField(default=0)

    tags = TaggableManager()

    has_kpi_hooks = LazyDefaultBooleanField(default=False)
    kpi_asset_uid = models.CharField(max_length=32, null=True)
    pending_delete = models.BooleanField(default=False)

    class Meta:
        app_label = 'logger'
        unique_together = (("user", "id_string"),)
        verbose_name = t("XForm")
        verbose_name_plural = t("XForms")
        ordering = ("id_string",)
        permissions = (
            (CAN_ADD_SUBMISSIONS, t('Can make submissions to the form')),
            (CAN_TRANSFER_OWNERSHIP, t('Can transfer form ownership.')),
            (CAN_VALIDATE_XFORM, t('Can validate submissions')),
            (CAN_DELETE_DATA_XFORM, t('Can delete submissions')),
        )

    objects = XFormWithoutPendingDeletedManager()
    all_objects = XFormAllManager()

    def file_name(self):
        return self.id_string + '.xml'

    @property
    def asset(self):
        """
        Retrieve related asset object easily from XForm instance.

        Useful to display form disclaimer in Enketo.
        See kpi.utils.xml.XMLFormWithDisclaimer for more details.
        """
        if not hasattr(self, '_cache_asset'):
            try:
                asset = Asset.objects.get(uid=self.kpi_asset_uid)
            except Asset.DoesNotExist:
                try:
                    asset = Asset.objects.get(_deployment_data__formid=self.pk)
                except Asset.DoesNotExist:
                    # An `Asset` object needs to be returned to avoid 500 while
                    # Enketo is fetching for project XML (e.g: /formList, /manifest)
                    asset = Asset(uid=self.id_string)

            setattr(self, '_cache_asset', asset)

        return getattr(self, '_cache_asset')

    def url(self):
        return reverse(
            'download_xform',
            kwargs={
                'username': self.user.username,
                'pk': self.pk
            }
        )

    def data_dictionary(self, use_cache: bool = False):
        from kobo.apps.openrosa.apps.viewer.models.data_dictionary import DataDictionary

        if not use_cache:
            return DataDictionary.all_objects.get(pk=self.pk)

        xform_dict = deepcopy(self.__dict__)
        xform_dict.pop('_state', None)
        return DataDictionary(**xform_dict)

    @property
    def has_instances_with_geopoints(self):
        return self.instances_with_geopoints

    @property
    def kpi_hook_service(self):
        """
        Returns kpi hook service if it exists. XForm should have only one occurrence in any case.
        :return: RestService
        """
        return self.restservices.filter(name="kpi_hook").first()

    def _set_id_string(self):
        matches = self.instance_id_regex.findall(self.xml)
        if len(matches) != 1:
            raise XLSFormError(t("There should be a single id string."))
        self.id_string = matches[0]

    def _set_title(self):
        self.xml = smart_str(self.xml)
        text = re.sub(r'\s+', ' ', self.xml)
        matches = title_pattern.findall(text)
        title_xml = matches[0][:XFORM_TITLE_LENGTH]

        if len(matches) != 1:
            raise XLSFormError(t("There should be a single title."), matches)

        if self.title and title_xml != self.title:
            title_xml = self.title[:XFORM_TITLE_LENGTH]
            title_xml = xml_escape(title_xml)
            self.xml = title_pattern.sub(
                "<h:title>%s</h:title>" % title_xml, self.xml)

        self.title = title_xml

    def _set_description(self):
        self.description = self.description \
            if self.description and self.description != '' else self.title

    def _set_encrypted_field(self):
        if self.json and self.json != '':
            json_dict = json.loads(self.json)
            if 'submission_url' in json_dict and 'public_key' in json_dict:
                self.encrypted = True
            else:
                self.encrypted = False

    def update(self, *args, **kwargs):
        super().save(*args, **kwargs)

    def save(self, *args, **kwargs):
        self._set_title()
        self._set_description()
        old_id_string = self.id_string
        self._set_id_string()
        self._set_encrypted_field()
        # check if we have an existing id_string,
        # if so, the one must match but only if xform is NOT new
        if self.pk and old_id_string and old_id_string != self.id_string:
            raise XLSFormError(
                t("Your updated form's id_string '%(new_id)s' must match "
                  "the existing forms' id_string '%(old_id)s'." %
                  {'new_id': self.id_string, 'old_id': old_id_string}))

        if getattr(settings, 'STRICT', True) and \
                not re.search(r"^[\w-]+$", self.id_string):
            raise XLSFormError(t('In strict mode, the XForm ID must be a '
                               'valid slug and contain no spaces.'))

        super().save(*args, **kwargs)

    def __str__(self):
        return getattr(self, "id_string", "")

    def submission_count(self, force_update=False):
        if self.num_of_submissions == 0 or force_update:
            count = self.instances.count()
            self.num_of_submissions = count
            self.save(update_fields=['num_of_submissions'])
        return self.num_of_submissions
    submission_count.short_description = t("Submission Count")

    def geocoded_submission_count(self):
        """Number of geocoded submissions."""
        return self.instances.filter(geom__isnull=False).count()

    def time_of_last_submission(self):
        if self.last_submission_time is None and self.num_of_submissions > 0:
            try:
                last_submission = self.instances.latest("date_created")
            except ObjectDoesNotExist:
                pass
            else:
                self.last_submission_time = last_submission.date_created
                self.save()
        return self.last_submission_time

    def time_of_last_submission_update(self):
        try:
            # We don't need to filter on `deleted_at` field anymore.
            # Instances are really deleted and not flagged as deleted.
            return self.instances.latest("date_modified").date_modified
        except ObjectDoesNotExist:
            pass

    @property
    def md5_hash(self):
        return get_hash(self.xml)

    @property
    def md5_hash_with_disclaimer(self):
        return get_hash(self.xml_with_disclaimer)

    @property
    def can_be_replaced(self):
        if hasattr(self.submission_count, '__call__'):
            num_submissions = self.submission_count()
        else:
            num_submissions = self.submission_count
        return num_submissions == 0

    @classmethod
    def public_forms(cls):
        return cls.objects.filter(shared=True)

    def _xls_file_io(self):
        """
        Pulls the xls file from remote storage

        this should be used sparingly
        """
        file_path = self.xls.name

        if file_path != '' and default_storage.exists(file_path):
            with default_storage.open(file_path) as ff:
                if file_path.endswith('.csv'):
                    return convert_csv_to_xls(ff.read())
                else:
                    return BytesIO(ff.read())

    @property
    def settings(self):
        """
        Mimic Asset settings.
        :return: Object
        """
        # As soon as we need to add custom validation statuses in Asset settings,
        # validation in add_validation_status_to_instance
        # (kobocat/kobo.apps.openrosa/apps/api/tools.py) should still work
        default_validation_statuses = getattr(settings, "DEFAULT_VALIDATION_STATUSES", [])

        # Later purpose, default_validation_statuses could be merged with a custom validation statuses dict
        # for example:
        #   self._validation_statuses.update(default_validation_statuses)

        return {
            "validation_statuses": default_validation_statuses
        }

    @property
    def xml_with_disclaimer(self):
        return XMLFormWithDisclaimer(self).get_object().xml


def update_profile_num_submissions(sender, instance, **kwargs):
    profile_qs = User.profile.get_queryset()
    try:
        profile = profile_qs.select_for_update()\
            .get(pk=instance.user.profile.pk)
    except ObjectDoesNotExist:
        pass
    else:
        profile.num_of_submissions -= instance.num_of_submissions
        if profile.num_of_submissions < 0:
            profile.num_of_submissions = 0
        profile.save(update_fields=['num_of_submissions'])


post_delete.connect(update_profile_num_submissions, sender=XForm,
                    dispatch_uid='update_profile_num_submissions')


def set_object_permissions(sender, instance=None, created=False, **kwargs):
    if created:
        for perm in get_perms_for_model(XForm):
            assign_perm(perm.codename, instance.user, instance)


post_save.connect(set_object_permissions, sender=XForm,
                  dispatch_uid='xform_object_permissions')


# signals are fired during cascade deletion (i.e. deletion initiated by the
# removal of a related object), whereas the `delete()` model method is not
# called. We need call this signal before cascade deletion. Otherwise,
# MonthlySubmissionCounter objects will be deleted before the signal is fired.
pre_delete.connect(
    MonthlyXFormSubmissionCounter.update_catch_all_counter_on_delete,
    sender=XForm,
    dispatch_uid='update_catch_all_monthly_xform_submission_counter',
)

pre_delete.connect(
    DailyXFormSubmissionCounter.update_catch_all_counter_on_delete,
    sender=XForm,
    dispatch_uid='update_catch_all_daily_xform_submission_counter',
)
