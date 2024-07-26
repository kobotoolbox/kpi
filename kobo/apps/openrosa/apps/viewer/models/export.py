# coding: utf-8
import os
from tempfile import NamedTemporaryFile

from django.db import models
from django.utils.translation import gettext as t

from kobo.apps.openrosa.apps.logger.models import XForm
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)


class Export(models.Model):
    class ExportTypeError(Exception):
        def __str__(self):
            return t("Invalid export type specified")

    XLS_EXPORT = 'xls'
    CSV_EXPORT = 'csv'
    KML_EXPORT = 'kml'
    ZIP_EXPORT = 'zip'

    EXPORT_MIMES = {
        'xls': 'vnd.ms-excel',
        'xlsx': 'vnd.openxmlformats',
        'csv': 'csv',
        'zip': 'zip',
        'kml': 'vnd.google-earth.kml+xml'
    }

    EXPORT_TYPES = [
        (XLS_EXPORT, 'Excel'),
        (CSV_EXPORT, 'CSV'),
        (ZIP_EXPORT, 'ZIP'),
        (KML_EXPORT, 'kml'),
    ]

    EXPORT_TYPE_DICT = dict(export_type for export_type in EXPORT_TYPES)

    PENDING = 0
    SUCCESSFUL = 1
    FAILED = 2

    # max no. of export files a user can keep
    MAX_EXPORTS = 10

    xform = models.ForeignKey(XForm, on_delete=models.CASCADE)
    created_on = models.DateTimeField(auto_now_add=True)
    filename = models.CharField(max_length=255, null=True, blank=True)
    # need to save an the filedir since when an xform is deleted, it cascades
    # its exports which then try to delete their files and try to access the
    # deleted xform - bad things happen
    filedir = models.CharField(max_length=255, null=True, blank=True)
    export_type = models.CharField(
        max_length=10, choices=EXPORT_TYPES, default=XLS_EXPORT
    )
    task_id = models.CharField(max_length=255, null=True, blank=True)
    # time of last submission when this export was created
    time_of_last_submission = models.DateTimeField(null=True, default=None)
    # status
    internal_status = models.SmallIntegerField(default=PENDING)
    export_url = models.URLField(null=True, default=None)

    class Meta:
        app_label = "viewer"
        unique_together = (("xform", "filename"),)

    def save(self, *args, **kwargs):
        if not self.pk and self.xform:
            # if new, check if we've hit our limit for exports for this form,
            # if so, delete oldest
            # TODO: let user know that last export will be deleted
            num_existing_exports = Export.objects.filter(
                xform=self.xform, export_type=self.export_type
            ).count()

            if num_existing_exports >= self.MAX_EXPORTS:
                Export._delete_oldest_export(self.xform, self.export_type)

            # update time_of_last_submission with
            # xform.time_of_last_submission_update
            self.time_of_last_submission = self.xform.\
                time_of_last_submission_update()
        if self.filename:
            self.internal_status = Export.SUCCESSFUL
        super().save(*args, **kwargs)

    @classmethod
    def _delete_oldest_export(cls, xform, export_type):
        oldest_export = Export.objects.filter(
            xform=xform, export_type=export_type).order_by('created_on')[0]
        oldest_export.delete()

    @property
    def is_pending(self):
        return self.status == Export.PENDING

    @property
    def is_successful(self):
        return self.status == Export.SUCCESSFUL

    @property
    def status(self):
        if self.filename:
            # need to have this since existing models will have their
            # internal_status set to PENDING - the default
            return Export.SUCCESSFUL
        elif self.internal_status == Export.FAILED:
            return Export.FAILED
        else:
            return Export.PENDING

    def set_filename(self, filename):
        self.filename = filename
        self.internal_status = Export.SUCCESSFUL
        self._update_filedir()

    def _update_filedir(self):
        assert self.filename
        self.filedir = os.path.join(
            self.xform.user.username,
            'exports',
            self.xform.id_string,
            self.export_type,
        )

    @property
    def filepath(self):
        if self.filedir and self.filename:
            return os.path.join(self.filedir, self.filename)
        return None

    @property
    def full_filepath(self):
        if self.filepath:
            try:
                return default_storage.path(self.filepath)
            except NotImplementedError:
                # read file from s3
                name, ext = os.path.splitext(self.filepath)
                tmp = NamedTemporaryFile(suffix=ext, delete=False)
                f = default_storage.open(self.filepath)
                tmp.write(f.read())
                tmp.close()
                return tmp.name
        return None

    @classmethod
    def exports_outdated(cls, xform, export_type):
        # get newest export for xform
        try:
            latest_export = Export.objects.filter(
                xform=xform, export_type=export_type,
                internal_status__in=[Export.SUCCESSFUL, Export.PENDING])\
                .latest('created_on')
        except cls.DoesNotExist:
            return True
        else:
            xform.refresh_from_db(fields=['date_modified'])
            xform_last_submission_time = xform.time_of_last_submission_update()
            export_last_submission_time = latest_export.time_of_last_submission
            if export_last_submission_time is None:
                return True

            if export_last_submission_time < xform.date_modified:
                return True
            elif xform_last_submission_time is not None:
                return export_last_submission_time < xform_last_submission_time
            else:
                # return true if we can't determine the status, to force
                # auto-generation
                return True

    @classmethod
    def is_filename_unique(cls, xform, filename):
        return Export.objects.filter(
            xform=xform, filename=filename).count() == 0
