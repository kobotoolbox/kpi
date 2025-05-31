from __future__ import annotations

import csv
import json
import mimetypes
import os
import time
import unicodedata
from collections import defaultdict
from copy import deepcopy
from datetime import datetime
from typing import Optional
from xml.etree import ElementTree as ET
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import (
    Attachment,
    Instance,
    SurveyType,
    XForm,
)
from kobo.apps.openrosa.apps.logger.xform_instance_parser import (
    get_xform_media_question_xpaths,
    remove_uuid_prefix,
)
from kobo.apps.openrosa.apps.viewer.models import ParsedInstance
from kobo.apps.openrosa.libs.utils.logger_tools import dict2xform
from kobo.apps.openrosa.libs.utils.viewer_tools import get_mongo_userform_id
from kpi.deployment_backends.kc_access.storage import default_kobocat_storage
from kpi.deployment_backends.kc_access.utils import kc_transaction_atomic
from kpi.tests.utils.dicts import convert_hierarchical_keys_to_nested_dict


class Command(BaseCommand):

    help = 'Restore missing submissions in PostgreSQL from MongoDB'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._id_string = None
        self._chunks = None
        self._data_collectors = defaultdict(int)
        self._backup_path = None

    def add_arguments(self, parser):
        parser.add_argument(
            '--chunks',
            type=int,
            default=2000,
            help='Number of records to process per query',
        )

        parser.add_argument('--id-string', type=str, help='XForm id_string')

        parser.add_argument(
            '--root-uuid', type=str, help='Specific submission rootUuid'
        )

        parser.add_argument(
            '--min-submission-id',
            type=int,
            default=0,
            help='Minimum submission id to start from',
        )

        parser.add_argument(
            '--backup-path',
            type=str,
            default='/tmp/',
            help='Path to save deleted MongoDB documents',
        )

    def handle(self, *args, **kwargs):
        """
        Entry point for the management command.
        Iterates through MongoDB records and restores missing submissions
        into PostgreSQL if needed, based on attachment validation.
        """

        self._verbosity = kwargs.get('verbosity', 1)
        self._chunks = kwargs['chunks']
        self._id_string = kwargs.get('id_string')
        self._root_uuid = kwargs.get('root_uuid')
        self._backup_path = self._prepare_backup_path(
            kwargs.get('backup_path', '/tmp/')
        )
        last_submission_id = kwargs.get('min_submission_id', 0)

        xform = self._get_xform_or_raise()
        self._userform_id = get_mongo_userform_id(xform, xform.user.username)
        storage_base_dir = os.path.join(xform.user.username, 'attachments', xform.uuid)
        survey_type = SurveyType.objects.get(slug=self._id_string)

        total = self._count_documents_if_verbose(last_submission_id)

        cpt = 0
        while records := self._get_mongo_documents(last_submission_id):
            for record in records:
                cpt += 1
                last_submission_id = record['_id']
                self._process_record(
                    record,
                    cpt,
                    total,
                    xform,
                    survey_type,
                    storage_base_dir,
                )

    def _count_documents_if_verbose(self, min_submission_id: int) -> int:
        """
        Count documents in MongoDB for progress tracking if verbosity is high.
        """
        if self._verbosity >= 3:
            query = {
                '_userform_id': self._userform_id,
                '_id': {'$gt': min_submission_id},
            }
            if self._root_uuid:
                query['meta/rootUuid'] = self._root_uuid
            return settings.MONGO_DB.instances.count_documents(query)
        return 0

    def _create_instance(
        self, record: dict, xform: XForm, survey_type: SurveyType
    ) -> Instance:
        """
        Create a new Instance and associated ParsedInstance from MongoDB record.
        Based on MockDeploymentBackend::mock_submissions() to create XML from a JSON
        """
        self.stdout.write(
            f"\t Create Instance #{record['_id']}: {record['meta/rootUuid']}"
        )
        sub_copy = deepcopy(record)
        # Remove keys present in JSON but not useful for XML creation
        for key in [
            'meta/rootUuid',
            '_attachments',
            '_uuid',
            '_xform_id_string',
            '_notes',
            '_validation_status',
            '_status',
            '_userform_id',
            '_tags',
            '_geolocation',
        ]:
            sub_copy.pop(key, None)

        if sub_copy.get('_submitted_by'):
            if sub_copy['_submitted_by'] not in self._data_collectors:
                data_collector_id = list(
                    User.objects.values_list('pk', flat=True).filter(
                        username=sub_copy['_submitted_by']
                    )
                )[0]
                self._data_collectors[sub_copy['_submitted_by']] = data_collector_id
            submitted_by = self._data_collectors[sub_copy['_submitted_by']]
        else:
            submitted_by = None

        sub_copy.pop('_submitted_by', None)
        sub_copy.pop('_id', None)
        submission_time = sub_copy.pop('_submission_time', None)
        if submission_time:
            submission_time = datetime.strptime(
                submission_time, '%Y-%m-%dT%H:%M:%S'
            ).replace(tzinfo=ZoneInfo('UTC'))
        else:
            submission_time = timezone.now()

        sub_copy = convert_hierarchical_keys_to_nested_dict(sub_copy)
        xml_string = dict2xform(sub_copy, xform.id_string)

        instance = Instance(
            id=record['_id'],
            xml=xml_string,
            user_id=submitted_by,
            status='c_via_repostgres',
            xform_id=xform.pk,
            survey_type_id=survey_type.pk,
            date_created=submission_time,
        )
        instance._set_json()  # noqa
        instance._set_uuid()  # noqa
        instance._set_geom()  # noqa
        instance._populate_xml_hash()  # noqa
        instance._populate_root_uuid()  # noqa

        instances = Instance.objects.bulk_create([instance], ignore_conflicts=True)

        parsed_instance = ParsedInstance(instance=instance)
        parsed_instance._set_geopoint()  # noqa
        ParsedInstance.objects.bulk_create([parsed_instance], ignore_conflicts=True)

        return instances[0]

    def _get_attachments_basenames(self, instance: Instance, xform: XForm) -> list[str]:
        """
        Extract all media file names from the instance XML based on XForm media fields.

        Inspired by `logger_tool.py::get_soft_deleted_attachments()`, but without the
        part that soft-deletes old attachments.
        TODO: refactor to use the same code
        """
        media_question_xpaths = get_xform_media_question_xpaths(xform)
        if not media_question_xpaths:
            return []

        xml_parsed = ET.fromstring(instance.xml)
        basenames = []
        for xpath in media_question_xpaths:
            root, path = xpath.split('/', 1)
            questions = xml_parsed.findall(path)
            for question in questions:
                try:
                    basename = question.text
                except AttributeError:
                    self.stderr.write('XPath not found!')
                if basename:
                    basenames.append(basename)
        return basenames

    def _get_question_name_basenames(
        self, record: dict, instance: Instance, xform: XForm
    ) -> Optional[list[str]]:
        """
        Return list of media filenames from instance XML.
        """
        question_name_basenames = self._get_attachments_basenames(instance, xform)
        if not question_name_basenames:
            if self._verbosity >= 2:
                self.stdout.write(
                    f'\t No question names found for instance: {instance.pk}'
                )
            if record['_id'] != instance.pk:
                self._save_mongo_doc_to_storage(record, delete=True)
            return None

        return question_name_basenames

    def _get_mongo_documents(self, submission_id: int) -> list[dict]:
        """
        Retrieve the first X (based on the size of option --chunks) MongoDB documents
        starting from a given submission ID.
        """

        query = {
            '_userform_id': self._userform_id,
            '_id': {'$gt': submission_id},
        }
        if self._root_uuid:
            query['meta/rootUuid'] = self._root_uuid

        cursor = settings.MONGO_DB.instances.find(query)
        cursor.limit(self._chunks)
        cursor.sort('_id', 1)

        # Cast to a list to avoid CursorNotFound because it has been voided from the
        # server
        return list(cursor)

    def _get_valid_name_storage(self, filename: str) -> str:
        """
        Simulates the behavior of Django's S3 storage to clean the filename.
        Only applies Unicode normalization if the name doesn't already contain
        combining marks (to avoid issues on macOS).
        """
        contains_combining = any(unicodedata.category(c) == 'Mn' for c in filename)
        if not contains_combining:
            filename = unicodedata.normalize('NFC', filename)
        return default_kobocat_storage.get_valid_name(filename)

    def _get_xform_or_raise(self) -> XForm:
        """
        Retrieve the XForm for the given id_string or raise an error.
        """
        if not self._id_string:
            raise CommandError('⚠ You must provide an id_string')
        try:
            return XForm.objects.get(id_string=self._id_string)
        except XForm.DoesNotExist:
            raise CommandError(f'⚠ No XForm found with id_string={self._id_string}')

    def _log_error(self, record: dict, message: str) -> None:
        """
        Log an error message both to stderr and to a CSV file in the backup path.
        """
        local_path = self._backup_path + 'errors.csv'
        self.stderr.write(f'ERROR: {message}')
        with open(local_path, 'a') as csvfile:
            csvwriter = csv.writer(csvfile)
            csvwriter.writerow([record['_id'], record['_uuid'], message])

    def _prepare_backup_path(self, base_path: str) -> str:
        """
        Prepare directory where backups will be saved.
        """
        if not base_path.endswith('/'):
            base_path += '/'
        full_path = base_path + f'{str(int(time.time()))}/'
        os.makedirs(full_path, exist_ok=True)
        return full_path

    def _process_record(self, record, cpt, total, xform, survey_type, storage_base_dir):
        """
        Process an individual MongoDB record and rebuild attachments if needed.
        """
        root_uuid = remove_uuid_prefix(record['meta/rootUuid'])
        create_instance = False
        if self._verbosity >= 2:
            self.stdout.write(f'Processing record: {root_uuid} - {cpt}/{total}')

        try:
            instance = Instance.objects.get(xform_id=xform.pk, root_uuid=root_uuid)
        except Instance.DoesNotExist:
            create_instance = True

        with kc_transaction_atomic():
            if create_instance:
                instance = self._create_instance(record, xform, survey_type)

            if not (
                question_name_basenames := self._get_question_name_basenames(
                    record, instance, xform
                )
            ):
                return

            mongo_files = {
                os.path.basename(att['filename']): att['id']
                for att in record['_attachments']
            }

            # `valid_basenames` contains the basenames of the attachments submitted by
            # the client, converted to reflect how Django transforms the filenames
            # before saving them to storage.
            valid_basenames = [
                self._get_valid_name_storage(b) for b in question_name_basenames
            ]

            if sorted(valid_basenames) == sorted(list(mongo_files)):
                existing_attachments = Attachment.objects.filter(
                    pk__in=mongo_files.values(), instance_id=instance.pk
                ).count()
                if existing_attachments == len(valid_basenames):
                    if self._verbosity >= 2:
                        self.stdout.write(
                            '\t Attachments in MongoDB match instance XML'
                        )
                    return

            self._rebuild_attachments(
                instance,
                storage_base_dir,
                root_uuid,
                mongo_files,
                valid_basenames,
                question_name_basenames,
                record,
            )

    def _rebuild_attachments(
        self,
        instance,
        storage_base_dir,
        root_uuid,
        mongo_files,
        valid_basenames,
        question_name_basenames,
        record,
    ):
        """
        Rebuild attachment list for a given instance using files on storage.
        """

        storage_dir = os.path.join(storage_base_dir, root_uuid)
        storage_files = default_kobocat_storage.listdir(storage_dir)[1]
        attachments = []

        Attachment.objects.filter(instance_id=instance.pk).update(
            deleted_at=timezone.now()
        )

        for storage_file in storage_files:
            storage_file_wo_extension, _ = os.path.splitext(storage_file)
            if storage_file_wo_extension.endswith(
                (
                    '-large',
                    '-medium',
                    '-small',
                )
            ):
                # Skip thumbnails
                continue

            if storage_file in valid_basenames:
                mimetype, _ = mimetypes.guess_type(storage_file)
                attachment_kwargs = {'mimetype': mimetype or ''}
                if storage_file in mongo_files:
                    attachment_kwargs['id'] = mongo_files[storage_file]

                media_file_basename = question_name_basenames[
                    valid_basenames.index(storage_file)
                ]
                attachments.append(
                    Attachment(
                        instance_id=instance.id,
                        media_file=os.path.join(storage_dir, storage_file),
                        media_file_basename=media_file_basename,
                        deleted_at=None,
                        **attachment_kwargs,
                    )
                )

        new_attachment_basenames = [att.media_file_basename for att in attachments]
        if sorted(new_attachment_basenames) != sorted(question_name_basenames):
            missing = set(question_name_basenames) - set(new_attachment_basenames)
            total_ = len(question_name_basenames)
            self._log_error(
                record,
                f'Could not rebuild attachments, '
                f'{len(missing)} missing on {total_}: {missing}',
            )

        Attachment.objects.bulk_create(
            attachments,
            update_fields=['deleted_at', 'instance_id'],
            update_conflicts=True,
            unique_fields=['id'],
        )

        delete_mongo_doc = bool(record['_id'] != instance.pk)
        self._save_mongo_doc_to_storage(record, delete=delete_mongo_doc)
        instance.parsed_instance.update_mongo(asynchronous=False)
        if 'via_repostgres' not in instance.status:
            Instance.objects.filter(pk=instance.pk).update(status='u_via_repostgres')

    def _save_mongo_doc_to_storage(self, record: dict, delete: bool = False):
        """
        Save the MongoDB document to a JSON file in the backup path.
        Optionally delete the document from the database if specified.
        """

        local_path = self._backup_path + str(record['_id']) + '.json'
        with open(local_path, 'w') as f:
            f.write(json.dumps(record))

        if delete:
            self.stdout.write(f"\t Delete message {record['_id']}")
            settings.MONGO_DB.instances.delete_one({'_id': record['_id']})
