from __future__ import annotations

from collections import defaultdict
from contextlib import contextmanager
from datetime import date, datetime
from typing import Generator, Literal, Optional, Union
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import redis.exceptions
import requests
from defusedxml import ElementTree as DET
from django.conf import settings
from django.core.cache.backends.base import InvalidCacheBackendError
from django.core.files import File
from django.core.files.base import ContentFile
from django.db.models import F, Sum
from django.db.models.functions import Coalesce
from django.db.models.query import QuerySet
from django.utils import timezone
from django.utils.translation import gettext_lazy as t
from django_redis import get_redis_connection
from rest_framework import status

from kobo.apps.openrosa.apps.logger.models import (
    Attachment,
    DailyXFormSubmissionCounter,
    Instance,
    MonthlyXFormSubmissionCounter,
    XForm,
)
from kobo.apps.openrosa.apps.logger.utils.instance import (
    add_validation_status_to_instance,
    delete_instances,
    remove_validation_status_from_instance,
    set_instance_validation_statuses,
)
from kobo.apps.openrosa.apps.main.models import MetaData, UserProfile
from kobo.apps.openrosa.libs.utils.logger_tools import create_instance, publish_xls_form
from kobo.apps.subsequences.utils import stream_with_extras
from kobo.apps.trackers.models import NLPUsageCounter
from kpi.constants import (
    PERM_CHANGE_SUBMISSIONS,
    PERM_DELETE_SUBMISSIONS,
    PERM_FROM_KC_ONLY,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VALIDATE_SUBMISSIONS,
    PERM_VIEW_SUBMISSIONS,
    SUBMISSION_FORMAT_TYPE_JSON,
    SUBMISSION_FORMAT_TYPE_XML,
)
from kpi.exceptions import (
    AttachmentNotFoundException,
    InvalidXFormException,
    InvalidXPathException,
    MissingXFormException,
    SubmissionIntegrityError,
    SubmissionNotFoundException,
    XPathNotFoundException,
)
from kpi.fields import KpiUidField
from kpi.interfaces.sync_backend_media import SyncBackendMediaInterface
from kpi.models.asset_file import AssetFile
from kpi.models.object_permission import ObjectPermission
from kpi.models.paired_data import PairedData
from kpi.utils.files import ExtendedContentFile
from kpi.utils.log import logging
from kpi.utils.mongo_helper import MongoHelper
from kpi.utils.object_permission import get_database_user
from kpi.utils.xml import fromstring_preserve_root_xmlns, xml_tostring

from ..exceptions import BadFormatException
from .base_backend import BaseDeploymentBackend
from .kc_access.utils import assign_applicable_kc_permissions, kc_transaction_atomic


class OpenRosaDeploymentBackend(BaseDeploymentBackend):
    """
    Deploy a project to OpenRosa server
    """

    SYNCED_DATA_FILE_TYPES = {
        AssetFile.FORM_MEDIA: 'media',
        AssetFile.PAIRED_DATA: 'paired_data',
    }

    def __init__(self, asset):
        super().__init__(asset)
        self._xform = None

    @property
    def attachment_storage_bytes(self):
        try:
            return self.xform.attachment_storage_bytes
        except (InvalidXFormException, MissingXFormException):
            return 0

    def bulk_assign_mapped_perms(self):
        """
        Bulk assign all KoBoCAT permissions related to KPI permissions.
        Useful to assign permissions retroactively upon deployment.
        Beware: it only adds permissions, it does not remove or sync permissions.
        """
        users_with_perms = self.asset.get_users_with_perms(attach_perms=True)

        # if only the owner has permissions, no need to go further
        if (
            len(users_with_perms) == 1
            and list(users_with_perms)[0].id == self.asset.owner_id
        ):
            return

        with kc_transaction_atomic():
            for user, perms in users_with_perms.items():
                if user.id == self.asset.owner_id:
                    continue
                assign_applicable_kc_permissions(self.asset, user, perms)

    def calculated_submission_count(
        self, user: settings.AUTH_USER_MODEL, **kwargs
    ) -> int:
        params = self.validate_submission_list_params(
            user, validate_count=True, **kwargs
        )
        return MongoHelper.get_count(self.mongo_userform_id, **params)

    def connect(self, active=False):
        """
        `POST` initial survey content to KoBoCAT and create a new project.
        Store results in deployment data.
        CAUTION: Does not save deployment data to the database!
        """
        xlsx_io = self.asset.to_xlsx_io(
            versioned=True,
            append={
                'settings': {
                    'id_string': self.asset.uid,
                    'form_title': self.asset.name,
                }
            },
        )
        xlsx_file = ContentFile(xlsx_io.read(), name=f'{self.asset.uid}.xlsx')

        self._xform = publish_xls_form(xlsx_file, self.asset.owner)
        self._xform.downloadable = active
        self._xform.kpi_asset_uid = self.asset.uid
        self._xform.save(update_fields=['downloadable', 'kpi_asset_uid'])

        self.store_data(
            {
                'backend': self._backend_identifier,
                'active': active,
                'backend_response': {
                    'formid': self._xform.pk,
                    'uuid': self._xform.uuid,
                    'id_string': self._xform.id_string,
                    'kpi_asset_uid': self.asset.uid,
                    'hash': self._xform.prefixed_hash,
                },
                'version': self.asset.version_id,
            }
        )

    @property
    def form_uuid(self):
        try:
            return self.backend_response['uuid']
        except KeyError:
            logging.warning('OpenRosa backend response has no `uuid`', exc_info=True)
            return None

    @staticmethod
    def format_openrosa_datetime(dt: Optional[datetime] = None) -> str:
        """
        Format a given datetime object or generate a new timestamp matching the
        OpenRosa datetime formatting
        """
        if dt is None:
            dt = datetime.now(tz=ZoneInfo('UTC'))

        # Awkward check, but it's prescribed by
        # https://docs.python.org/3/library/datetime.html#determining-if-an-object-is-aware-or-naive
        if dt.tzinfo is None or dt.tzinfo.utcoffset(None) is None:
            raise ValueError('An offset-aware datetime is required')
        return dt.isoformat('T', 'milliseconds')

    def delete(self):
        """
        WARNING! Deletes all submitted data!
        """
        try:
            self.xform.delete()
        except (MissingXFormException, InvalidXFormException):
            pass

        super().delete()

    def delete_submission(
        self, submission_id: int, user: settings.AUTH_USER_MODEL
    ) -> dict:
        """
        Delete a submission

        It returns a dictionary which can used as Response object arguments
        """

        self.validate_access_with_partial_perms(
            user=user, perm=PERM_DELETE_SUBMISSIONS, submission_ids=[submission_id]
        )

        count, _ = Instance.objects.filter(pk=submission_id).delete()
        return count

    def delete_submissions(
        self, data: dict, user: settings.AUTH_USER_MODEL, **kwargs
    ) -> dict:
        """
        Bulk delete provided submissions.

        `data` should contain the submission ids or the query to get the subset
        of submissions to delete
        Example:
             {"submission_ids": [1, 2, 3]}
             or
             {"query": {"Question": "response"}
        """
        submission_ids = self.validate_access_with_partial_perms(
            user=user,
            perm=PERM_DELETE_SUBMISSIONS,
            submission_ids=data['submission_ids'],
            query=data['query'],
        )

        # If `submission_ids` is not empty, user has partial permissions.
        # Otherwise, they have full access.
        if submission_ids:
            # Remove query from `data` because all the submission ids have been
            # already retrieved
            data.pop('query', None)
            data['submission_ids'] = submission_ids

        return delete_instances(self.xform, data)

    def duplicate_submission(
        self,
        submission_id: int,
        request: 'rest_framework.request.Request',
    ) -> dict:
        """
        Duplicates a single submission. The submission with the given
        `submission_id` is duplicated, and the `start`, `end` and
        `instanceID` parameters of the submission are reset before being
        saved to the instance.

        Returns the duplicated submission (if successful)
        """

        user = request.user
        self.validate_access_with_partial_perms(
            user=user,
            perm=PERM_CHANGE_SUBMISSIONS,
            submission_ids=[submission_id],
        )

        submission = self.get_submission(
            submission_id,
            user=user,
            format_type=SUBMISSION_FORMAT_TYPE_XML,
        )

        # Get attachments for the duplicated submission if there are any
        attachments = []
        if attachment_objects := Attachment.objects.filter(instance_id=submission_id):
            attachments = (
                ExtendedContentFile(a.media_file.read(), name=a.media_file_basename)
                for a in attachment_objects
            )

        # parse XML string to ET object
        xml_parsed = fromstring_preserve_root_xmlns(submission)

        # attempt to update XML fields for duplicate submission. Note that
        # `start` and `end` are not guaranteed to be included in the XML object
        _uuid, uuid_formatted = self.generate_new_instance_id()
        date_formatted = self.format_openrosa_datetime()
        for date_field in ('start', 'end'):
            element = xml_parsed.find(date_field)
            # Even if the element is found, `bool(element)` is `False`. How
            # very un-Pythonic!
            if element is not None:
                element.text = date_formatted
        # Rely on `meta/instanceID` being present. If it's absent, something is
        # fishy enough to warrant raising an exception instead of continuing
        # silently
        xml_parsed.find(self.SUBMISSION_CURRENT_UUID_XPATH).text = uuid_formatted

        # create_instance uses `username` argument to identify the XForm object
        # (when nothing else worked). `_submitted_by` is populated by `request.user`
        instance = create_instance(
            username=self.asset.owner.username,
            xml_file=ContentFile(xml_tostring(xml_parsed)),
            media_files=attachments,
            uuid=_uuid,
            request=request,
        )

        return self._rewrite_json_attachment_urls(
            self.get_submission(submission_id=instance.pk, user=user), request
        )

    def edit_submission(
        self,
        xml_submission_file: File,
        request: 'rest_framework.request.Request',
        attachments: dict = None,
    ):
        """
        Edit a submission through KoBoCAT proxy on behalf of `user`.
        Attachments can be uploaded by passing a dictionary (name, File object)

        The returned Response should be in XML (expected format by Enketo Express)
        """
        user = request.user
        submission_xml = xml_submission_file.read()
        try:
            xml_root = fromstring_preserve_root_xmlns(submission_xml)
        except DET.ParseError:
            raise SubmissionIntegrityError(t('Your submission XML is malformed.'))
        try:
            deprecated_uuid = xml_root.find(self.SUBMISSION_DEPRECATED_UUID_XPATH).text
            xform_uuid = xml_root.find(self.FORM_UUID_XPATH).text
        except AttributeError:
            raise SubmissionIntegrityError(
                t('Your submission XML is missing critical elements.')
            )
        # Remove UUID prefix
        deprecated_uuid = deprecated_uuid[len('uuid:'):]

        try:
            instance = Instance.objects.get(
                uuid=deprecated_uuid,
                xform__uuid=xform_uuid,
                xform__kpi_asset_uid=self.asset.uid,
            )
        except Instance.DoesNotExist:
            raise SubmissionIntegrityError(
                t(
                    'The submission you attempted to edit could not be found, '
                    'or you do not have access to it.'
                )
            )

        # Validate write access for users with partial permissions
        submission_ids = self.validate_access_with_partial_perms(
            user=user, perm=PERM_CHANGE_SUBMISSIONS, submission_ids=[instance.pk]
        )

        if submission_ids:
            # If `submission_ids` is not empty, it indicates the user has partial
            # permissions and has successfully passed validation. Therefore, set the
            # `has_partial_perms` attribute on `request.user` to grant the necessary
            # permissions when invoking `logger_tool.py::_has_edit_xform_permission()`.
            user.has_partial_perms = True

        # Set the In-Memory file’s current position to 0 before passing it to
        # Request.
        xml_submission_file.seek(0)

        # create_instance uses `username` argument to identify the XForm object
        # (when nothing else worked). `_submitted_by` is populated by `request.user`
        return create_instance(
            username=user.username,
            xml_file=xml_submission_file,
            media_files=attachments,
            request=request,
        )

    @property
    def enketo_id(self):
        if not (enketo_id := self.get_data('enketo_id')):
            self.get_enketo_survey_links()
            enketo_id = self.get_data('enketo_id')
        return enketo_id

    @staticmethod
    def normalize_internal_url(url: str) -> str:
        """
        Normalize url to ensure KOBOCAT_INTERNAL_URL is used
        """
        parsed_url = urlparse(url)
        return f'{settings.KOBOCAT_INTERNAL_URL}{parsed_url.path}'

    def get_attachment(
        self,
        submission_id_or_uuid: Union[int, str],
        user: settings.AUTH_USER_MODEL,
        attachment_id: Optional[int] = None,
        xpath: Optional[str] = None,
    ) -> Attachment:
        """
        Return an object which can be retrieved by its primary key or by XPath.
        An exception is raised when the submission or the attachment is not found.
        """
        submission_id = None
        submission_uuid = None
        try:
            submission_id = int(submission_id_or_uuid)
        except ValueError:
            submission_uuid = submission_id_or_uuid
        if submission_uuid:
            # `_uuid` is the legacy identifier that changes (per OpenRosa spec)
            # after every edit; `meta/rootUuid` remains consistent across
            # edits. prefer the latter when fetching by UUID.
            candidates = list(
                self.get_submissions(
                    user,
                    query={
                        '$or': [
                            {'meta/rootUuid': submission_uuid},
                            {'_uuid': submission_uuid},
                        ]
                    },
                    fields=['_id', 'meta/rootUuid', '_uuid'],
                )
            )
            if not candidates:
                raise SubmissionNotFoundException
            for submission in candidates:
                if submission.get('meta/rootUuid') == submission_uuid:
                    submission_id = submission['_id']
                    break
            else:
                # no submissions with matching `meta/rootUuid` were found;
                # get the "first" result, despite there being no order
                # specified, just for consistency with previous code
                submission_id = candidates[0]['_id']

        submission_xml = self.get_submission(
            submission_id, user, format_type=SUBMISSION_FORMAT_TYPE_XML
        )
        if not submission_xml:
            raise SubmissionNotFoundException

        if xpath:
            submission_root = fromstring_preserve_root_xmlns(submission_xml)
            try:
                element = submission_root.find(xpath)
            except KeyError:
                raise InvalidXPathException

            if element is None:
                raise XPathNotFoundException
            attachment_filename = element.text
            filters = {
                'media_file_basename': attachment_filename,
            }
        else:
            filters = {
                'pk': attachment_id,
            }

        filters['instance__id'] = submission_id
        # Ensure the attachment actually belongs to this project!
        filters['instance__xform_id'] = self.xform_id

        try:
            attachment = Attachment.objects.get(**filters)
        except Attachment.DoesNotExist:
            raise AttachmentNotFoundException

        return attachment

    def get_attachment_objects_from_dict(
        self, submission: dict
    ) -> Union[QuerySet, list]:

        # First test that there are attachments to avoid a call to the DB for
        # nothing
        if not submission.get('_attachments'):
            return []

        # Get filenames from DB because Mongo does not contain the
        # original basename.
        # EE excepts the original basename before Django renames it and
        # stores it in Mongo
        # E.g.:
        # - XML filename: Screenshot 2022-01-19 222028-13_45_57.jpg
        # - Mongo: Screenshot_2022-01-19_222028-13_45_57.jpg

        return Attachment.objects.filter(instance_id=submission['_id'])

    def get_daily_counts(
        self, user: settings.AUTH_USER_MODEL, timeframe: tuple[date, date]
    ) -> dict:

        user = get_database_user(user)

        if user != self.asset.owner and self.asset.has_perm(
            user, PERM_PARTIAL_SUBMISSIONS
        ):
            # We cannot use cached values from daily counter when user has
            # partial permissions. We need to use MongoDB aggregation engine
            # to retrieve the correct value according to user's permissions.
            permission_filters = self.asset.get_filters_for_partial_perm(
                user.pk, perm=PERM_VIEW_SUBMISSIONS
            )

            if not permission_filters:
                return {}

            query = {
                '_userform_id': self.mongo_userform_id,
                '_submission_time': {
                    '$gte': f'{timeframe[0]}',
                    '$lte': f'{timeframe[1]}T23:59:59',
                },
            }

            query = MongoHelper.get_permission_filters_query(query, permission_filters)

            documents = settings.MONGO_DB.instances.aggregate(
                [
                    {
                        '$match': query,
                    },
                    {
                        '$group': {
                            '_id': {
                                '$dateToString': {
                                    'format': '%Y-%m-%d',
                                    'date': {
                                        '$dateFromString': {
                                            'format': '%Y-%m-%dT%H:%M:%S',
                                            'dateString': '$_submission_time',
                                        }
                                    },
                                }
                            },
                            'count': {'$sum': 1},
                        }
                    },
                ]
            )
            return {doc['_id']: doc['count'] for doc in documents}

        # Trivial case, user has 'view_permissions'
        daily_counts = DailyXFormSubmissionCounter.objects.values(
            'date', 'counter'
        ).filter(
            xform_id=self.xform_id,
            date__range=timeframe,
        )
        return {str(count['date']): count['counter'] for count in daily_counts}

    def get_data_download_links(self):
        exports_base_url = '/'.join(
            (
                settings.KOBOCAT_URL.rstrip('/'),
                self.asset.owner.username,
                'exports',
                self.xform.id_string,
            )
        )
        reports_base_url = '/'.join(
            (
                settings.KOBOCAT_URL.rstrip('/'),
                self.asset.owner.username,
                'reports',
                self.xform.id_string,
            )
        )
        links = {
            # To be displayed in iframes
            'xls_legacy': '/'.join((exports_base_url, 'xls/')),
            'csv_legacy': '/'.join((exports_base_url, 'csv/')),
            'zip_legacy': '/'.join((exports_base_url, 'zip/')),
            'kml_legacy': '/'.join((exports_base_url, 'kml/')),
            # For GET requests that return files directly
            'xls': '/'.join((reports_base_url, 'export.xlsx')),
            'csv': '/'.join((reports_base_url, 'export.csv')),
        }
        return links

    def get_enketo_survey_links(self):
        if not self.get_data('backend_response'):
            return {}

        data = {
            'server_url': '{}/{}'.format(
                settings.KOBOCAT_URL.rstrip('/'), self.asset.owner.username
            ),
            'form_id': self.xform.id_string,
        }

        try:
            response = requests.post(
                f'{settings.ENKETO_URL}/{settings.ENKETO_SURVEY_ENDPOINT}',
                # bare tuple implies basic auth
                auth=(settings.ENKETO_API_KEY, ''),
                data=data,
            )
            response.raise_for_status()
        except requests.exceptions.RequestException:
            # Don't 500 the entire asset view if Enketo is unreachable
            logging.error('Failed to retrieve links from Enketo', exc_info=True)
            return {}
        try:
            links = response.json()
        except ValueError:
            logging.error('Received invalid JSON from Enketo', exc_info=True)
            return {}

        try:
            enketo_id = links.pop('enketo_id')
        except KeyError:
            logging.error(
                'Invalid response from Enketo: `enketo_id` is not found',
                exc_info=True,
            )
            return {}

        stored_enketo_id = self.get_data('enketo_id')
        if stored_enketo_id != enketo_id:
            if stored_enketo_id:
                logging.warning(
                    f'Enketo ID has changed from {stored_enketo_id} to {enketo_id}'
                )
            self.save_to_db({'enketo_id': enketo_id})

        if self.xform.require_auth:
            # Unfortunately, EE creates unique ID based on OpenRosa server URL.
            # Thus, we need to always generated the ID with the same URL
            # (i.e.: with username) to be retro-compatible and then,
            # overwrite the OpenRosa server URL again.
            self.set_enketo_open_rosa_server(require_auth=True, enketo_id=enketo_id)

        for discard in ('enketo_id', 'code', 'preview_iframe_url'):
            try:
                del links[discard]
            except KeyError:
                pass
        return links

    def get_orphan_postgres_submissions(self) -> Optional[QuerySet, bool]:
        """
        Return a queryset of all submissions still present in PostgreSQL
        database related to `self.xform`.
        Return False if one submission still exists in MongoDB at
        least.
        Otherwise, if `self.xform` does not exist (anymore), return None
        """
        all_submissions = self.get_submissions(
            user=self.asset.owner,
            fields=['_id'],
            skip_count=True,
        )
        try:
            next(all_submissions)
        except StopIteration:
            pass
        else:
            return False

        try:
            return Instance.objects.filter(xform_id=self.xform_id)
        except (InvalidXFormException, MissingXFormException):
            return None

    def get_submissions(
        self,
        user: settings.AUTH_USER_MODEL,
        format_type: str = SUBMISSION_FORMAT_TYPE_JSON,
        submission_ids: list = None,
        request: Optional['rest_framework.request.Request'] = None,
        **mongo_query_params,
    ) -> Union[Generator[dict, None, None], list]:
        """
        Retrieve submissions that `user` is allowed to access.

        The format `format_type` can be either:
        - 'json' (See `kpi.constants.SUBMISSION_FORMAT_TYPE_JSON`)
        - 'xml' (See `kpi.constants.SUBMISSION_FORMAT_TYPE_XML`)

        Results can be filtered by submission ids. Moreover MongoDB filters can
        be passed through `query` to narrow down the results.

        If `user` has no access to these submissions or no matches are found,
        an empty generator is returned.

        If `format_type` is 'json', a generator of dictionaries is returned.
        Otherwise, if `format_type` is 'xml', a generator of strings is returned.

        If `request` is provided, submission attachments url are rewritten to
        point to KPI (instead of KoBoCAT).
        See `BaseDeploymentBackend._rewrite_json_attachment_urls()`
        """

        mongo_query_params['submission_ids'] = submission_ids if submission_ids else []
        params = self.validate_submission_list_params(
            user, format_type=format_type, **mongo_query_params
        )

        if format_type == SUBMISSION_FORMAT_TYPE_JSON:
            submissions = self.__get_submissions_in_json(request, **params)
        elif format_type == SUBMISSION_FORMAT_TYPE_XML:
            submissions = self.__get_submissions_in_xml(**params)
        else:
            raise BadFormatException(
                'The format {} is not supported'.format(format_type)
            )
        return submissions

    def get_validation_status(
        self, submission_id: int, user: settings.AUTH_USER_MODEL
    ) -> dict:
        submission = self.get_submission(
            submission_id, user, fields=['_validation_status']
        )

        # TODO simplify response when KobocatDeploymentBackend
        #  and MockDeploymentBackend are gone
        if not submission:
            return {
                'content_type': 'application/json',
                'status': status.HTTP_404_NOT_FOUND,
                'data': {'detail': f'No submission found with ID: {submission_id}'},
            }

        return {
            'data': submission['_validation_status'],
            'content_type': 'application/json',
            'status': status.HTTP_200_OK,
        }

    @property
    def mongo_userform_id(self):
        return (
            self.xform.mongo_uuid
            or f'{self.asset.owner.username}_{self.xform_id_string}'
        )

    @staticmethod
    def nlp_tracking_data(
        asset_ids: list[int], start_date: Optional[datetime.date] = None
    ):
        """
        Get the NLP tracking data since a specified date
        If no date is provided, get all-time data
        """
        filter_args = {}
        if start_date:
            filter_args = {'date__gte': start_date}
        try:
            nlp_tracking = (
                NLPUsageCounter.objects.only('total_asr_seconds', 'total_mt_characters')
                .filter(asset_id__in=asset_ids, **filter_args)
                .aggregate(
                    total_nlp_asr_seconds=Coalesce(Sum('total_asr_seconds'), 0),
                    total_nlp_mt_characters=Coalesce(Sum('total_mt_characters'), 0),
                )
            )
        except NLPUsageCounter.DoesNotExist:
            return {
                'total_nlp_asr_seconds': 0,
                'total_nlp_mt_characters': 0,
            }
        else:
            return nlp_tracking

    def redeploy(self, active=None):
        """
        Replace (overwrite) the deployment, and
        optionally changing whether the deployment is active.
        CAUTION: Does not save deployment data to the database!
        """
        if active is None:
            active = self.active

        id_string = self.xform.id_string
        xlsx_io = self.asset.to_xlsx_io(
            versioned=True,
            append={
                'settings': {
                    'id_string': id_string,
                    'form_title': self.asset.name,
                }
            },
        )
        xlsx_file = ContentFile(xlsx_io.read(), name=f'{self.asset.uid}.xlsx')

        with kc_transaction_atomic():
            XForm.objects.filter(pk=self.xform.id).update(
                downloadable=active,
                title=self.asset.name,
            )
            self.xform.downloadable = active
            self.xform.title = self.asset.name

            publish_xls_form(xlsx_file, self.asset.owner, self.xform.id_string)

        # Do not call `save_to_db()`, asset (and its deployment) is saved right
        # after calling this method in `DeployableMixin.deploy()`
        self.store_data(
            {
                'backend': self._backend_identifier,
                'active': active,
                'backend_response': {
                    'formid': self.xform.pk,
                    'uuid': self.xform.uuid,
                    'id_string': self.xform.id_string,
                    'kpi_asset_uid': self.asset.uid,
                    'hash': self._xform.prefixed_hash,
                },
                'version': self.asset.version_id,
            }
        )

    def remove_from_kc_only_flag(
        self, specific_user: Union[int, settings.AUTH_USER_MODEL] = None
    ):
        """
        Removes `from_kc_only` flag for ALL USERS unless `specific_user` is
        provided

        Args:
            specific_user (int, User): User object or pk
        """
        # This flag lets us know that permission assignments in KPI exist
        # only because they were copied from KoBoCAT (by `sync_from_kobocat`).
        # As soon as permissions are assigned through KPI, this flag must be
        # removed
        #
        # This method is here instead of `ObjectPermissionMixin` because
        # it's specific to KoBoCat as backend.

        # TODO: Remove this method after kobotoolbox/kobocat#642

        filters = {
            'permission__codename': PERM_FROM_KC_ONLY,
            'asset_id': self.asset.id,
        }
        if specific_user is not None:
            try:
                user_id = specific_user.pk
            except AttributeError:
                user_id = specific_user
            filters['user_id'] = user_id

        ObjectPermission.objects.filter(**filters).delete()

    def rename_enketo_id_key(self, previous_owner_username: str):
        parsed_url = urlparse(settings.KOBOCAT_URL)
        domain_name = parsed_url.netloc
        asset_uid = self.asset.uid
        try:
            enketo_redis_client = get_redis_connection('enketo_redis_main')
            enketo_redis_client.rename(
                src=f'or:{domain_name}/{previous_owner_username},{asset_uid}',
                dst=f'or:{domain_name}/{self.asset.owner.username},{asset_uid}',
            )
        except InvalidCacheBackendError:
            # TODO: This handles the case when the cache is disabled and
            # get_redis_connection fails, though we may need better error handling here
            pass
        except redis.exceptions.ResponseError:
            # original does not exist, weird but don't raise a 500 for that
            pass

    @staticmethod
    def prepare_bulk_update_response(backend_results: list[dict]) -> dict:
        """
        Formatting the response to allow for partial successes to be seen
        more explicitly.
        """

        results = []
        cpt_successes = 0
        for backend_result in backend_results:
            uuid = backend_result['uuid']
            if message := backend_result['error']:
                status_code = status.HTTP_400_BAD_REQUEST
            else:
                cpt_successes += 1
                message = t('Successful submission')
                status_code = status.HTTP_201_CREATED

            results.append(
                {
                    'uuid': uuid,
                    'status_code': status_code,
                    'message': message,
                }
            )

        total_update_attempts = len(results)
        total_successes = cpt_successes

        return {
            'status': (
                status.HTTP_200_OK
                if total_successes > 0
                else status.HTTP_400_BAD_REQUEST
            ),
            'data': {
                'count': total_update_attempts,
                'successes': total_successes,
                'failures': total_update_attempts - total_successes,
                'results': results,
            },
        }

    def set_active(self, active):
        """
        Set deployment as active or not.
        Store results in deployment data
        """
        # Use `queryset.update()` over `model.save()` because we don't need to
        # run the logic of the `model.save()` method and we don't need signals
        # to be called.
        XForm.objects.filter(pk=self.xform_id).update(downloadable=active)
        self.xform.downloadable = active
        self.save_to_db({'active': active})

    def set_asset_uid(self, force: bool = False) -> bool:
        """
        Link KoBoCAT `XForm` back to its corresponding KPI `Asset` by
        populating the `kpi_asset_uid` field (use KoBoCAT proxy to PATCH XForm).
        Useful when a form is created from the legacy upload form.
        Store results in deployment data.

        It returns `True` only if `XForm.kpi_asset_uid` field is updated
        during this call, otherwise `False`.
        """
        is_synchronized = not (
            force or self.backend_response.get('kpi_asset_uid', None) is None
        )
        if is_synchronized:
            return False

        # Use `queryset.update()` over `model.save()` because we don't need to
        # run the logic of the `model.save()` method and we don't need signals
        # to be called.
        XForm.objects.filter(pk=self.xform_id).update(kpi_asset_uid=self.asset.uid)
        self.xform.kpi_asset_uid = self.asset.uid
        self.backend_response['kpi_asset_uid'] = self.asset.uid
        self.store_data({'backend_response': self.backend_response})
        return True

    def set_enketo_open_rosa_server(self, require_auth: bool, enketo_id: str = None):
        # Kobocat handles Open Rosa requests with different accesses.
        #  - Authenticated access, https://[kc]
        #  - Anonymous access, https://[kc]/username
        # Enketo generates its unique ID based on the server URL.
        # Thus, if the project requires authentication, we need to update Redis
        # directly to keep the same ID and let Enketo submit data to correct
        # endpoint
        if not enketo_id:
            enketo_id = self.enketo_id

        server_url = settings.KOBOCAT_URL.rstrip('/')
        if not require_auth:
            server_url = f'{server_url}/{self.asset.owner.username}'

        enketo_redis_client = get_redis_connection('enketo_redis_main')
        enketo_redis_client.hset(
            f'id:{enketo_id}',
            'openRosaServer',
            server_url,
        )

    def set_mongo_uuid(self):
        """
        Set the `mongo_uuid` for the associated XForm if it's not already set.
        """
        if not self.xform.mongo_uuid:
            self.xform.mongo_uuid = KpiUidField.generate_unique_id()
            self.xform.save(update_fields=['mongo_uuid'])

    def set_validation_status(
        self,
        submission_id: int,
        user: settings.AUTH_USER_MODEL,
        data: dict,
        method: str = Literal['DELETE', 'PATCH'],
    ) -> dict:
        """
        Update validation status.
        If `method` is `DELETE`, the status is reset to `None`

        It returns a dictionary which can used as Response object arguments
        """

        self.validate_access_with_partial_perms(
            user=user,
            perm=PERM_VALIDATE_SUBMISSIONS,
            submission_ids=[submission_id],
        )

        try:
            instance = Instance.objects.only('validation_status', 'date_modified').get(
                pk=submission_id
            )
        except Instance.DoesNotExist:
            return {
                'content_type': 'application/json',
                'status': status.HTTP_404_NOT_FOUND,
                'data': {'detail': f'No submission found with ID: {submission_id}'},
            }

        if method == 'DELETE':
            if remove_validation_status_from_instance(instance):
                return {
                    'content_type': 'application/json',
                    'status': status.HTTP_204_NO_CONTENT,
                }
            else:
                return {
                    'content_type': 'application/json',
                    'status': status.HTTP_500_INTERNAL_SERVER_ERROR,
                    'data': {'detail': 'Could not update MongoDB'},
                }

        validation_status_uid = data.get('validation_status.uid')

        if not add_validation_status_to_instance(
            user.username, validation_status_uid, instance
        ):
            return {
                'content_type': 'application/json',
                'status': status.HTTP_400_BAD_REQUEST,
                'data': {
                    'detail': f'Invalid validation status: `{validation_status_uid}`'
                },
            }
        return {
            'data': instance.validation_status,
            'content_type': 'application/json',
            'status': status.HTTP_200_OK,
        }

    def set_validation_statuses(
        self, user: settings.AUTH_USER_MODEL, data: dict
    ) -> dict:
        """
        Bulk update validation status.

        `data` should contain either the submission ids or the query to
        retrieve the subset of submissions chosen by then user.
        If none of them are provided, all the submissions are selected
        Examples:
            {"submission_ids": [1, 2, 3]}
            {"query":{"_validation_status.uid":"validation_status_not_approved"}
        """
        submission_ids = self.validate_access_with_partial_perms(
            user=user,
            perm=PERM_VALIDATE_SUBMISSIONS,
            submission_ids=data['submission_ids'],
            query=data['query'],
        )

        # If `submission_ids` is not empty, user has partial permissions.
        # Otherwise, they have full access.
        if submission_ids:
            # Remove query from `data` because all the submission ids have been
            # already retrieved
            data.pop('query', None)
            data['submission_ids'] = submission_ids

        # TODO handle errors
        update_instances = set_instance_validation_statuses(
            self.xform, data, user.username
        )

        return {
            'data': {'detail': f'{update_instances} submissions have been updated'},
            'content_type': 'application/json',
            'status': status.HTTP_200_OK,
        }

    def store_submission(
        self, user, xml_submission, submission_uuid, attachments=None, **kwargs
    ):
        media_files = []
        if attachments:
            media_files = (media_file for media_file in attachments.values())

        # create_instance uses `username` argument to identify the XForm object
        # (when nothing else worked). `_submitted_by` is populated by `request.user`
        return create_instance(
            username=self.asset.owner.username,
            xml_file=ContentFile(xml_submission),
            media_files=media_files,
            uuid=submission_uuid,
            request=kwargs.get('request'),
        )

    @property
    def submission_count(self):
        try:
            return self.xform.num_of_submissions
        except (InvalidXFormException, MissingXFormException):
            return 0

    def submission_count_since_date(self, start_date=None):
        try:
            xform_id = self.xform_id
        except (InvalidXFormException, MissingXFormException):
            return 0

        today = timezone.now().date()
        filter_args = {
            'xform_id': xform_id,
        }
        if start_date:
            filter_args['date__range'] = [start_date, today]
        try:
            # Note: this is replicating the functionality that was formerly in
            # `current_month_submission_count`. `current_month_submission_count`
            # didn't account for partial permissions, and this doesn't either
            total_submissions = (
                DailyXFormSubmissionCounter.objects.only('date', 'counter')
                .filter(**filter_args)
                .aggregate(count_sum=Coalesce(Sum('counter'), 0))
            )
        except DailyXFormSubmissionCounter.DoesNotExist:
            return 0
        else:
            return total_submissions['count_sum']

    @property
    def submission_model(self):
        return Instance

    @property
    def submission_url(self) -> str:
        # Use internal host to secure calls to KoboCAT API,
        # kobo-service-account can restrict requests per hosts.
        url = '{kc_base}/submission'.format(
            kc_base=settings.KOBOCAT_INTERNAL_URL,
        )
        return url

    def sync_media_files(self, file_type: str = AssetFile.FORM_MEDIA):

        metadata_files = defaultdict(dict)

        # Build a list of KoboCAT metadata to compare with KPI
        for metadata in MetaData.objects.filter(
            xform_id=self.xform_id,
            data_type=self.SYNCED_DATA_FILE_TYPES[file_type],
        ).values():
            metadata_files[metadata['data_value']] = {
                'pk': metadata['id'],
                'md5': metadata['file_hash'],
                'from_kpi': metadata['from_kpi'],
            }
        metadata_filenames = metadata_files.keys()

        queryset = self._get_metadata_queryset(file_type=file_type)

        for media_file in queryset:

            backend_media_id = media_file.backend_media_id

            # File does not exist in KC
            if backend_media_id not in metadata_filenames:
                if media_file.deleted_at is None:
                    # New file
                    self._save_openrosa_metadata(media_file)
                else:
                    # Orphan, delete it
                    media_file.delete(force=True)
                continue

            # Existing file
            if backend_media_id in metadata_filenames:
                metadata_file = metadata_files[backend_media_id]
                if media_file.deleted_at is None:
                    # If md5 differs, we need to re-upload it.
                    if media_file.md5_hash != metadata_file['md5']:
                        if media_file.file_type == AssetFile.PAIRED_DATA:
                            self._update_kc_metadata_hash(
                                media_file, metadata_file['pk']
                            )
                        else:
                            self._delete_openrosa_metadata(metadata_file)
                            self._save_openrosa_metadata(media_file)
                elif metadata_file['from_kpi']:
                    self._delete_openrosa_metadata(metadata_file, media_file)
                else:
                    # Remote file has been uploaded directly to KC. We
                    # cannot delete it, but we need to vacuum KPI.
                    media_file.delete(force=True)
                    # Skip deletion of key corresponding to `backend_media_id`
                    # in `metadata_files` to avoid unique constraint failure in case
                    # user deleted
                    # and re-uploaded the same file in a row between
                    # two deployments
                    # Example:
                    # - User uploads file1.jpg (pk == 1)
                    # - User deletes file1.jpg (pk == 1)
                    # - User re-uploads file1.jpg (pk == 2)
                    # Next time, 'file1.jpg' is encountered in this loop,
                    # it would try to re-upload to KC if its hash differs
                    # from KC version and would fail because 'file1.jpg'
                    # already exists in KC db.
                    continue

                # Remove current filename from `metadata_files`.
                # All files which will remain in this dict (after this loop)
                # will be considered obsolete and will be deleted
                del metadata_files[backend_media_id]

        # Remove KoboCAT orphan files previously uploaded through KPI
        for metadata_file in metadata_files.values():
            if metadata_file['from_kpi']:
                self._delete_openrosa_metadata(metadata_file)

    @property
    def xform(self):

        if self._xform is not None:
            return self._xform

        pk = self.backend_response['formid']
        xform = (
            XForm.objects.filter(pk=pk)
            .only(
                'user__username',
                'id_string',
                'num_of_submissions',
                'attachment_storage_bytes',
                'require_auth',
                'uuid',
                'mongo_uuid',
            )
            .select_related('user')  # Avoid extra query to validate username below
            .first()
        )

        if not xform:
            raise MissingXFormException

        if not (
            xform.user.username == self.asset.owner.username
            and xform.id_string == self.xform_id_string
        ):
            raise InvalidXFormException
        self._xform = xform
        return self._xform

    @property
    def xform_id(self):
        return self.xform.pk

    @property
    def xform_id_string(self):
        return self.get_data('backend_response.id_string')

    @staticmethod
    @contextmanager
    def suspend_submissions(user_ids: list[int]):
        UserProfile.objects.filter(user_id__in=user_ids).update(
            submissions_suspended=True
        )
        try:
            yield
        finally:
            UserProfile.objects.filter(user_id__in=user_ids).update(
                submissions_suspended=False
            )

    def transfer_submissions_ownership(self, previous_owner_username: str) -> bool:

        results = settings.MONGO_DB.instances.update_many(
            {'_userform_id': f'{previous_owner_username}_{self.xform_id_string}'},
            {'$set': {'_userform_id': self.mongo_userform_id}},
        )

        return results.matched_count == 0 or (
            results.matched_count > 0
            and results.matched_count == results.modified_count
        )

    def transfer_counters_ownership(self, new_owner: 'kobo_auth.User'):

        NLPUsageCounter.objects.filter(asset=self.asset, user=self.asset.owner).update(
            user=new_owner
        )
        DailyXFormSubmissionCounter.objects.filter(
            xform=self.xform, user_id=self.asset.owner.pk
        ).update(user=new_owner)
        MonthlyXFormSubmissionCounter.objects.filter(
            xform=self.xform, user_id=self.asset.owner.pk
        ).update(user=new_owner)

        UserProfile.objects.filter(user_id=self.asset.owner.pk).update(
            attachment_storage_bytes=F('attachment_storage_bytes')
            - self.xform.attachment_storage_bytes
        )
        UserProfile.objects.filter(user_id=new_owner.pk).update(
            attachment_storage_bytes=F('attachment_storage_bytes')
            + self.xform.attachment_storage_bytes
        )

    @property
    def _backend_identifier(self):
        return 'openrosa'

    def _delete_openrosa_metadata(
        self, metadata_file_: dict, file_: Union[AssetFile, PairedData] = None
    ):
        """
        A simple utility to delete metadata in KoBoCAT.
        If related KPI file is provided (i.e. `file_`), it is deleted too.
        """
        # Delete MetaData object and its related file (on storage)
        try:
            metadata = MetaData.objects.get(pk=metadata_file_['pk'])
        except MetaData.DoesNotExist:
            pass
        else:
            # Need to call signals
            metadata.delete()

        if file_ is None:
            return

        # Delete file in KPI if requested
        file_.delete(force=True)

    def _last_submission_time(self):
        return self.xform.last_submission_time

    def _save_openrosa_metadata(self, file_: SyncBackendMediaInterface):
        """
        Create a MetaData object usable for (KoboCAT) v1 API, related to
        AssetFile `file_`.
        """
        metadata = {
            'data_value': file_.backend_media_id,
            'xform_id': self.xform_id,
            'data_type': self.SYNCED_DATA_FILE_TYPES[file_.file_type],
            'from_kpi': True,
            'data_filename': file_.filename,
            'data_file_type': file_.mimetype,
            'file_hash': file_.md5_hash,
        }

        if not file_.is_remote_url:
            # Ensure file has not been read before
            file_.content.seek(0)
            file_content = file_.content.read()
            file_.content.seek(0)
            metadata['data_file'] = ContentFile(file_content, file_.filename)

        MetaData.objects.create(**metadata)

        file_.synced_with_backend = True
        file_.save(update_fields=['synced_with_backend'])

    def _update_kc_metadata_hash(
        self, file_: SyncBackendMediaInterface, metadata_id: int
    ):
        """
        Update metadata object hash
        """
        data = {'file_hash': file_.md5_hash}
        # MetaData has no signals, use `filter().update()` instead of `.get()`
        # and `.save(update_fields='...')`
        MetaData.objects.filter(pk=metadata_id).update(**data)
        file_.synced_with_backend = True
        file_.save(update_fields=['synced_with_backend'])

    def __get_submissions_in_json(
        self, request: Optional['rest_framework.request.Request'] = None, **params
    ) -> Generator[dict, None, None]:
        """
        Retrieve submissions directly from Mongo.
        Submissions can be filtered with `params`.
        """
        # Apply a default sort of _id to prevent unpredictable natural sort
        if not params.get('sort'):
            params['sort'] = {'_id': 1}
        mongo_cursor, total_count = MongoHelper.get_instances(
            self.mongo_userform_id, **params
        )

        # Python-only attribute used by `kpi.views.v2.data.DataViewSet.list()`
        self.current_submission_count = total_count

        add_supplemental_details_to_query = self.asset.has_advanced_features

        fields = params.get('fields', [])
        if len(fields) > 0 and '_uuid' not in fields:
            # skip the query if submission '_uuid' is not even q'd from mongo
            add_supplemental_details_to_query = False

        if add_supplemental_details_to_query:
            mongo_cursor = stream_with_extras(mongo_cursor, self.asset)

        return (
            self._rewrite_json_attachment_urls(
                MongoHelper.to_readable_dict(submission),
                request,
            )
            for submission in mongo_cursor
        )

    def __get_submissions_in_xml(self, **params) -> Generator[str, None, None]:
        """
        Retrieve submissions directly from PostgreSQL.
        Submissions can be filtered with `params`.
        """

        mongo_filters = ['query', 'permission_filters']
        use_mongo = any(
            mongo_filter in mongo_filters
            for mongo_filter in params
            if params.get(mongo_filter) is not None
        )

        if use_mongo:
            # We use Mongo to retrieve matching instances.
            params['fields'] = ['_id']
            # Force `sort` by `_id` for Mongo
            # See FIXME about sort in `BaseDeploymentBackend.validate_submission_list_params()`  # noqa: E501
            params['sort'] = {'_id': 1}
            submissions, count = MongoHelper.get_instances(
                self.mongo_userform_id, **params
            )
            submission_ids = [submission.get('_id') for submission in submissions]
            self.current_submission_count = count

        queryset = Instance.objects.filter(xform_id=self.xform_id)

        if len(submission_ids) > 0 or use_mongo:
            queryset = queryset.filter(id__in=submission_ids)

        # Python-only attribute used by `kpi.views.v2.data.DataViewSet.list()`
        if not use_mongo:
            self.current_submission_count = queryset.count()

        # Force Sort by id
        # See FIXME about sort in `BaseDeploymentBackend.validate_submission_list_params()`  # noqa: E501
        queryset = queryset.order_by('id')

        # When using Mongo, data is already paginated,
        # no need to do it with PostgreSQL too.
        if not use_mongo:
            offset = params.get('start')
            limit = offset + params.get('limit')
            queryset = queryset[offset:limit]

        return (lazy_instance.xml for lazy_instance in queryset)
