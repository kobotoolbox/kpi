import json
import os
import re
from copy import deepcopy
from io import BytesIO
from xml.sax.saxutils import escape as xml_escape

from django.apps import apps
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import models
from django.urls import reverse
from django.utils.encoding import smart_str
from django.utils.translation import gettext_lazy as t
from taggit.managers import TaggableManager

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.exceptions import XLSFormError
from kobo.apps.openrosa.koboform.pyxform_utils import convert_csv_to_xls
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)
from kpi.fields.file import ExtendedFileField
from kpi.models.abstract_models import AbstractTimeStampedModel
from kpi.utils.hash import calculate_hash
from kpi.utils.xml import XMLFormWithDisclaimer

XFORM_TITLE_LENGTH = 255
title_pattern = re.compile(r'<h:title>([^<]+)</h:title>')


def upload_to(instance, filename):
    return os.path.join(
        instance.user.username, 'xls', os.path.split(filename)[1]
    )


class XFormWithoutPendingDeletedManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().exclude(pending_delete=True)


class XFormAllManager(models.Manager):
    pass


class XForm(AbstractTimeStampedModel):

    CLONED_SUFFIX = '_cloned'
    MAX_ID_LENGTH = 100

    xls = ExtendedFileField(
        storage=default_storage,
        upload_to=upload_to,
        null=True,
        max_length=380,
    )
    json = models.TextField(default='')
    description = models.TextField(default='', null=True)
    xml = models.TextField()

    user = models.ForeignKey(
        User, related_name='xforms', null=True, on_delete=models.CASCADE
    )
    require_auth = models.BooleanField(
        default=True,
        verbose_name=t('Require authentication to see form and submit data'),
    )
    shared = models.BooleanField(default=False)
    shared_data = models.BooleanField(default=False)
    downloadable = models.BooleanField(default=True)
    encrypted = models.BooleanField(default=False)

    id_string = models.SlugField(
        editable=False, verbose_name=t('ID'), max_length=MAX_ID_LENGTH
    )
    title = models.CharField(editable=False, max_length=XFORM_TITLE_LENGTH)
    last_submission_time = models.DateTimeField(blank=True, null=True)
    has_start_time = models.BooleanField(default=False)
    uuid = models.CharField(max_length=32, default='', db_index=True)
    mongo_uuid = models.CharField(
        max_length=100, null=True, unique=True, db_index=True
    )

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

    kpi_asset_uid = models.CharField(max_length=32, null=True, db_index=True)
    pending_delete = models.BooleanField(default=False)
    pending_transfer = models.BooleanField(default=False, null=True)

    class Meta:
        app_label = 'logger'
        unique_together = (('user', 'id_string'),)
        verbose_name = t('XForm')
        verbose_name_plural = t('XForms')
        ordering = ('id_string',)

    objects = XFormWithoutPendingDeletedManager()
    all_objects = XFormAllManager()

    def __str__(self):
        return getattr(self, 'id_string', '')

    @property
    def asset(self):
        """
        Retrieve the related asset object easily from XForm instance.

        Useful to display form disclaimer in Enketo.
        See kpi.utils.xml.XMLFormWithDisclaimer for more details.
        """
        Asset = apps.get_model('kpi', 'Asset')  # noqa
        if not getattr(self, '_cached_asset', None):
            # We only need to load some fields when fetching the related Asset object
            # with XMLFormWithDisclaimer
            try:
                asset = Asset.all_objects.only(
                    'pk', 'name', 'uid', 'owner_id'
                ).get(uid=self.kpi_asset_uid)
            except Asset.DoesNotExist:
                # An `Asset` object needs to be returned to avoid 500 while
                # Enketo is fetching for project XML (e.g: /formList, /manifest)
                # The uid is set to null to auto-generate it when the asset is saved.
                # This is useful specially in unit tests for xforms without assets
                asset = Asset(
                    uid=None,
                    name=self.title,
                    owner_id=self.user.id,
                )

            setattr(self, '_cached_asset', asset)

        return getattr(self, '_cached_asset')

    @property
    def can_be_replaced(self):
        if hasattr(self.submission_count, '__call__'):
            num_submissions = self.submission_count()
        else:
            num_submissions = self.submission_count
        return num_submissions == 0

    def data_dictionary(self, use_cache: bool = False):
        # When the XForm is already in memory (e.g. fetched via `select_related`), and
        # with `use_cache=True`, `data_dictionary()` builds the `DataDictionary`
        # object directly from the XForm's in-memory `__dict__`, skipping the DB
        # entirely.
        from kobo.apps.openrosa.apps.viewer.models.data_dictionary import DataDictionary

        if not use_cache:
            return DataDictionary.all_objects.get(pk=self.pk)
        fields = [field.name for field in self._meta.get_fields()]
        xform_dict = deepcopy(self.__dict__)
        xform_dict = {key: val for key, val in xform_dict.items() if key in fields}
        return DataDictionary(**xform_dict)

    def file_name(self):
        return self.id_string + '.xml'

    def geocoded_submission_count(self):
        """Number of geocoded submissions."""
        return self.instances.filter(geom__isnull=False).count()

    @property
    def has_instances_with_geopoints(self):
        return self.instances_with_geopoints

    @property
    def md5_hash(self):
        return calculate_hash(self.xml)

    @property
    def md5_hash_with_disclaimer(self):
        return calculate_hash(self.xml_with_disclaimer)

    @property
    def prefixed_hash(self):
        """
        Matches what's returned by the KC API
        """
        return f'md5:{self.md5_hash}'

    @classmethod
    def public_forms(cls):
        return cls.objects.filter(shared=True)

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

        if getattr(settings, 'STRICT', True) and not re.search(
            r'^[\w-]+$', self.id_string
        ):
            raise XLSFormError(
                t(
                    'In strict mode, the XForm ID must be a '
                    'valid slug and contain no spaces.'
                )
            )

        super().save(*args, **kwargs)

    def submission_count(self, force_update=False):
        if self.num_of_submissions == 0 or force_update:
            count = self.instances.count()
            self.num_of_submissions = count
            self.save(update_fields=['num_of_submissions'])
        return self.num_of_submissions

    submission_count.short_description = t('Submission Count')

    def time_of_last_submission(self):
        if self.last_submission_time is None and self.num_of_submissions > 0:
            try:
                last_submission = self.instances.latest('date_created')
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
            return self.instances.latest('date_modified').date_modified
        except ObjectDoesNotExist:
            pass

    def update(self, *args, **kwargs):
        super().save(*args, **kwargs)

    def url(self):
        return reverse(
            'download_xform', kwargs={'username': self.user.username, 'pk': self.pk}
        )

    @property
    def xform_root_node_name(self):
        """
        Retrieves the name of the XML tag representing the root node of the "survey"
        in the XForm XML structure.

        It should always be present in `self.json`.
        """

        form_json = json.loads(self.json)
        return form_json['name']

    @property
    def xml_with_disclaimer(self):
        return XMLFormWithDisclaimer(self).get_object().xml

    def _set_id_string(self):
        matches = self.instance_id_regex.findall(self.xml)
        if len(matches) != 1:
            raise XLSFormError(t('There should be a single id string.'))
        self.id_string = matches[0]

    def _set_description(self):
        self.description = (
            self.description
            if self.description and self.description != ''
            else self.title
        )

    def _set_encrypted_field(self):
        if self.json and self.json != '':
            json_dict = json.loads(self.json)
            if 'submission_url' in json_dict and 'public_key' in json_dict:
                self.encrypted = True
            else:
                self.encrypted = False

    def _set_title(self):
        self.xml = smart_str(self.xml)
        text = re.sub(r'\s+', ' ', self.xml)
        matches = title_pattern.findall(text)
        title_xml = matches[0][:XFORM_TITLE_LENGTH]

        if len(matches) != 1:
            raise XLSFormError(t('There should be a single title.'), matches)

        if self.title and title_xml != self.title:
            title_xml = self.title[:XFORM_TITLE_LENGTH]
            title_xml = xml_escape(title_xml)
            self.xml = title_pattern.sub('<h:title>%s</h:title>' % title_xml, self.xml)

        self.title = title_xml

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
