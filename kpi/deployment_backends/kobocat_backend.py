from __future__ import annotations

import io
import json
import re
from collections import defaultdict
from contextlib import contextmanager
from datetime import date, datetime
from typing import Generator, Optional, Union
from urllib.parse import urlparse
try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

import requests
import redis.exceptions
from defusedxml import ElementTree as DET
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.files import File
from django.db.models import Sum, F
from django.db.models.functions import Coalesce
from django.db.models.query import QuerySet
from django.utils import timezone
from django.utils.translation import gettext_lazy as t
from django_redis import get_redis_connection
from kobo_service_account.utils import get_request_headers
from rest_framework import status

from kobo.apps.subsequences.utils import stream_with_extras
from kobo.apps.trackers.models import NLPUsageCounter
from kpi.constants import (
    SUBMISSION_FORMAT_TYPE_JSON,
    SUBMISSION_FORMAT_TYPE_XML,
    PERM_FROM_KC_ONLY,
    PERM_CHANGE_SUBMISSIONS,
    PERM_DELETE_SUBMISSIONS,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VALIDATE_SUBMISSIONS,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.exceptions import (
    AttachmentNotFoundException,
    InvalidXFormException,
    KobocatCommunicationError,
    SubmissionIntegrityError,
    SubmissionNotFoundException,
    XPathNotFoundException,
)
from kpi.interfaces.sync_backend_media import SyncBackendMediaInterface
from kpi.models.asset_file import AssetFile
from kpi.models.object_permission import ObjectPermission
from kpi.models.paired_data import PairedData
from kpi.utils.django_orm_helper import UpdateJSONFieldAttributes
from kpi.utils.log import logging
from kpi.utils.mongo_helper import MongoHelper
from kpi.utils.object_permission import get_database_user
from kpi.utils.permissions import is_user_anonymous
from kpi.utils.xml import fromstring_preserve_root_xmlns, xml_tostring
from .base_backend import BaseDeploymentBackend
from .kc_access.shadow_models import (
    KobocatAttachment,
    KobocatDailyXFormSubmissionCounter,
    KobocatMonthlyXFormSubmissionCounter,
    KobocatUserProfile,
    KobocatXForm,
    ReadOnlyKobocatInstance,
)
from .kc_access.utils import (
    assign_applicable_kc_permissions,
    kc_transaction_atomic,
    last_submission_time
)
from ..exceptions import (
    BadFormatException,
    KobocatDeploymentException,
    KobocatDuplicateSubmissionException,
)


class KobocatDeploymentBackend(BaseDeploymentBackend):
    """
    Used to deploy a project into KoBoCAT. Stores the project identifiers in the
    `self.asset._deployment_data` models.JSONField (referred as "deployment data")
    """

    SYNCED_DATA_FILE_TYPES = {
        AssetFile.FORM_MEDIA: 'media',
        AssetFile.PAIRED_DATA: 'paired_data',
    }

    @property
    def attachment_storage_bytes(self):
        try:
            return self.xform.attachment_storage_bytes
        except InvalidXFormException:
            return 0

    def bulk_assign_mapped_perms(self):
        """
        Bulk assign all KoBoCAT permissions related to KPI permissions.
        Useful to assign permissions retroactively upon deployment.
        Beware: it only adds permissions, it does not remove or sync permissions.
        """
        users_with_perms = self.asset.get_users_with_perms(attach_perms=True)

        # if only the owner has permissions, no need to go further
        if len(users_with_perms) == 1 and \
            list(users_with_perms)[0].id == self.asset.owner_id:
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
        # Use the external URL here; the internal URL will be substituted
        # in when appropriate
        if not settings.KOBOCAT_URL or not settings.KOBOCAT_INTERNAL_URL:
            raise ImproperlyConfigured(
                'Both KOBOCAT_URL and KOBOCAT_INTERNAL_URL must be '
                'configured before using KobocatDeploymentBackend'
            )
        kc_server = settings.KOBOCAT_URL
        id_string = self.asset.uid

        url = self.normalize_internal_url('{}/api/v1/forms'.format(kc_server))
        xlsx_io = self.asset.to_xlsx_io(
            versioned=True, append={
                'settings': {
                    'id_string': id_string,
                    'form_title': self.asset.name,
                }
            }
        )

        # Payload contains `kpi_asset_uid` and `has_kpi_hook` for two reasons:
        # - KC `XForm`'s `id_string` can be different than `Asset`'s `uid`, then
        #   we can't rely on it to find its related `Asset`.
        # - Removing, renaming `has_kpi_hook` will force PostgreSQL to rewrite
        #   every record of `logger_xform`. It can be also used to filter
        #   queries as it is faster to query a boolean than string.
        payload = {
            'downloadable': active,
            'has_kpi_hook': self.asset.has_active_hooks,
            'kpi_asset_uid': self.asset.uid
        }
        files = {'xls_file': ('{}.xlsx'.format(id_string), xlsx_io)}
        json_response = self._kobocat_request(
            'POST', url, data=payload, files=files
        )
        # Store only path
        json_response['url'] = urlparse(json_response['url']).path
        self.store_data(
            {
                'backend': 'kobocat',
                'active': json_response['downloadable'],
                'backend_response': json_response,
                'version': self.asset.version_id,
            }
        )

    @staticmethod
    def nlp_tracking_data(asset_ids, start_date=None):
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
                .filter(
                    asset_id__in=asset_ids,
                    **filter_args
                ).aggregate(
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

    def submission_count_since_date(self, start_date=None):
        try:
            xform_id = self.xform_id
        except InvalidXFormException:
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
            total_submissions = KobocatDailyXFormSubmissionCounter.objects.only(
                'date', 'counter'
            ).filter(**filter_args).aggregate(count_sum=Coalesce(Sum('counter'), 0))
        except KobocatDailyXFormSubmissionCounter.DoesNotExist:
            return 0
        else:
            return total_submissions['count_sum']

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
        url = self.normalize_internal_url(self.backend_response['url'])
        try:
            self._kobocat_request('DELETE', url)
        except KobocatDeploymentException as e:
            if not hasattr(e, 'response'):
                raise

            if e.response.status_code == status.HTTP_404_NOT_FOUND:
                # The KC project is already gone!
                pass
            elif e.response.status_code in [
                status.HTTP_502_BAD_GATEWAY,
                status.HTTP_504_GATEWAY_TIMEOUT,
            ]:
                raise KobocatCommunicationError
            elif e.response.status_code == status.HTTP_401_UNAUTHORIZED:
                raise KobocatCommunicationError(
                    'Could not authenticate to KoBoCAT'
                )
            else:
                raise

        super().delete()

    def delete_submission(
        self, submission_id: int, user: settings.AUTH_USER_MODEL
    ) -> dict:
        """
        Delete a submission through KoBoCAT proxy

        It returns a dictionary which can used as Response object arguments
        """

        self.validate_access_with_partial_perms(
            user=user,
            perm=PERM_DELETE_SUBMISSIONS,
            submission_ids=[submission_id]
        )

        kc_url = self.get_submission_detail_url(submission_id)
        kc_request = requests.Request(method='DELETE', url=kc_url)
        kc_response = self.__kobocat_proxy_request(kc_request, user)

        return self.__prepare_as_drf_response_signature(kc_response)

    def delete_submissions(self, data: dict, user: settings.AUTH_USER_MODEL) -> dict:
        """
        Bulk delete provided submissions through KoBoCAT proxy,
        authenticated by `user`'s API token.

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

        kc_url = self.submission_list_url
        kc_request = requests.Request(method='DELETE', url=kc_url, json=data)
        kc_response = self.__kobocat_proxy_request(kc_request, user)

        drf_response = self.__prepare_as_drf_response_signature(kc_response)
        return drf_response

    def duplicate_submission(
        self, submission_id: int, user: 'settings.AUTH_USER_MODEL'
    ) -> dict:
        """
        Duplicates a single submission proxied through KoBoCAT. The submission
        with the given `submission_id` is duplicated and the `start`, `end` and
        `instanceID` parameters of the submission are reset before being posted
        to KoBoCAT.

        Returns a dict with message response from KoBoCAT and uuid of created
        submission if successful

        """

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
        attachment_objects = KobocatAttachment.objects.filter(
            instance_id=submission_id
        )
        attachments = (
            {a.media_file_basename: a.media_file for a in attachment_objects}
            if attachment_objects
            else None
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
        xml_parsed.find(self.SUBMISSION_CURRENT_UUID_XPATH).text = (
            uuid_formatted
        )

        kc_response = self.store_submission(
            user, xml_tostring(xml_parsed), _uuid, attachments
        )
        if kc_response.status_code == status.HTTP_201_CREATED:
            return next(self.get_submissions(user, query={'_uuid': _uuid}))
        else:
            raise KobocatDuplicateSubmissionException

    def edit_submission(
        self,
        xml_submission_file: File,
        user: settings.AUTH_USER_MODEL,
        attachments: dict = None,
    ):
        """
        Edit a submission through KoBoCAT proxy on behalf of `user`.
        Attachments can be uploaded by passing a dictionary (name, File object)

        The returned Response should be in XML (expected format by Enketo Express)
        """
        submission_xml = xml_submission_file.read()
        try:
            xml_root = fromstring_preserve_root_xmlns(submission_xml)
        except DET.ParseError:
            raise SubmissionIntegrityError(
                t('Your submission XML is malformed.')
            )
        try:
            deprecated_uuid = xml_root.find(
                self.SUBMISSION_DEPRECATED_UUID_XPATH
            ).text
            xform_uuid = xml_root.find(self.FORM_UUID_XPATH).text
        except AttributeError:
            raise SubmissionIntegrityError(
                t('Your submission XML is missing critical elements.')
            )
        # Remove UUID prefix
        deprecated_uuid = deprecated_uuid[len('uuid:'):]
        try:
            instance = ReadOnlyKobocatInstance.objects.get(
                uuid=deprecated_uuid,
                xform__uuid=xform_uuid,
                xform__kpi_asset_uid=self.asset.uid,
            )
        except ReadOnlyKobocatInstance.DoesNotExist:
            raise SubmissionIntegrityError(
                t(
                    'The submission you attempted to edit could not be found, '
                    'or you do not have access to it.'
                )
            )

        # Validate write access for users with partial permissions
        self.validate_access_with_partial_perms(
            user=user,
            perm=PERM_CHANGE_SUBMISSIONS,
            submission_ids=[instance.pk]
        )

        # Set the In-Memory file’s current position to 0 before passing it to
        # Request.
        xml_submission_file.seek(0)
        files = {'xml_submission_file': xml_submission_file}

        # Combine all files altogether
        if attachments:
            files.update(attachments)

        kc_request = requests.Request(
            method='POST', url=self.submission_url, files=files
        )
        kc_response = self.__kobocat_proxy_request(kc_request, user)
        return self.__prepare_as_drf_response_signature(
            kc_response, expected_response_format='xml'
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
    ) -> KobocatAttachment:
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
            element = submission_root.find(xpath)
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
            attachment = KobocatAttachment.objects.get(**filters)
        except KobocatAttachment.DoesNotExist:
            raise AttachmentNotFoundException

        return attachment

    def get_attachment_objects_from_dict(self, submission: dict) -> QuerySet:

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

        # ToDo What about adding the original basename and the question
        #  name in Mongo to avoid another DB query?
        return KobocatAttachment.objects.filter(
            instance_id=submission['_id']
        )

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
                    '$lte': f'{timeframe[1]}T23:59:59'
                }
            }

            query = MongoHelper.get_permission_filters_query(
                query, permission_filters
            )

            documents = settings.MONGO_DB.instances.aggregate([
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
                                        'format': "%Y-%m-%dT%H:%M:%S",
                                        'dateString': "$_submission_time"
                                    }
                                }
                            }
                        },
                        'count': {'$sum': 1}
                    }
                }
            ])
            return {doc['_id']: doc['count'] for doc in documents}

        # Trivial case, user has 'view_permissions'
        daily_counts = (
            KobocatDailyXFormSubmissionCounter.objects.values(
                'date', 'counter'
            ).filter(
                xform_id=self.xform_id,
                date__range=timeframe,
            )
        )
        return {
            str(count['date']): count['counter'] for count in daily_counts
        }

    def get_data_download_links(self):
        exports_base_url = '/'.join((
            settings.KOBOCAT_URL.rstrip('/'),
            self.asset.owner.username,
            'exports',
            self.backend_response['id_string']
        ))
        reports_base_url = '/'.join((
            settings.KOBOCAT_URL.rstrip('/'),
            self.asset.owner.username,
            'reports',
            self.backend_response['id_string']
        ))
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
                settings.KOBOCAT_URL.rstrip('/'),
                self.asset.owner.username
            ),
            'form_id': self.backend_response['id_string']
        }

        try:
            response = requests.post(
                f'{settings.ENKETO_URL}/{settings.ENKETO_SURVEY_ENDPOINT}',
                # bare tuple implies basic auth
                auth=(settings.ENKETO_API_KEY, ''),
                data=data
            )
            response.raise_for_status()
        except requests.exceptions.RequestException:
            # Don't 500 the entire asset view if Enketo is unreachable
            logging.error(
                'Failed to retrieve links from Enketo', exc_info=True)
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
            self.set_enketo_open_rosa_server(
                require_auth=True, enketo_id=enketo_id
            )

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
            return ReadOnlyKobocatInstance.objects.filter(xform_id=self.xform_id)
        except InvalidXFormException:
            return None

    def get_submission_detail_url(self, submission_id: int) -> str:
        url = f'{self.submission_list_url}/{submission_id}'
        return url

    def get_submission_validation_status_url(self, submission_id: int) -> str:
        url = '{detail_url}/validation_status'.format(
            detail_url=self.get_submission_detail_url(submission_id)
        )
        return url

    def get_submissions(
        self,
        user: settings.AUTH_USER_MODEL,
        format_type: str = SUBMISSION_FORMAT_TYPE_JSON,
        submission_ids: list = [],
        request: Optional['rest_framework.request.Request'] = None,
        **mongo_query_params
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

        mongo_query_params['submission_ids'] = submission_ids
        params = self.validate_submission_list_params(user,
                                                      format_type=format_type,
                                                      **mongo_query_params)

        if format_type == SUBMISSION_FORMAT_TYPE_JSON:
            submissions = self.__get_submissions_in_json(request, **params)
        elif format_type == SUBMISSION_FORMAT_TYPE_XML:
            submissions = self.__get_submissions_in_xml(**params)
        else:
            raise BadFormatException(
                "The format {} is not supported".format(format_type)
            )
        return submissions

    def get_validation_status(
        self, submission_id: int, user: settings.AUTH_USER_MODEL
    ) -> dict:
        url = self.get_submission_validation_status_url(submission_id)
        kc_request = requests.Request(method='GET', url=url)
        kc_response = self.__kobocat_proxy_request(kc_request, user)

        return self.__prepare_as_drf_response_signature(kc_response)

    @staticmethod
    def internal_to_external_url(url):
        """
        Replace the value of `settings.KOBOCAT_INTERNAL_URL` with that of
        `settings.KOBOCAT_URL` when it appears at the beginning of
        `url`
        """
        return re.sub(
            pattern='^{}'.format(re.escape(settings.KOBOCAT_INTERNAL_URL)),
            repl=settings.KOBOCAT_URL,
            string=url
        )

    @property
    def mongo_userform_id(self):
        return '{}_{}'.format(self.asset.owner.username, self.xform_id_string)

    def redeploy(self, active=None):
        """
        Replace (overwrite) the deployment, keeping the same identifier, and
        optionally changing whether the deployment is active.
        CAUTION: Does not save deployment data to the database!
        """
        if active is None:
            active = self.active
        url = self.normalize_internal_url(self.backend_response['url'])
        id_string = self.backend_response['id_string']
        xlsx_io = self.asset.to_xlsx_io(
            versioned=True, append={
                'settings': {
                    'id_string': id_string,
                    'form_title': self.asset.name,
                }
            }
        )
        payload = {
            'downloadable': active,
            'title': self.asset.name,
            'has_kpi_hook': self.asset.has_active_hooks
        }
        files = {'xls_file': ('{}.xlsx'.format(id_string), xlsx_io)}
        json_response = self._kobocat_request(
            'PATCH', url, data=payload, files=files
        )
        self.store_data({
            'active': json_response['downloadable'],
            'backend_response': json_response,
            'version': self.asset.version_id,
        })

        self.set_asset_uid()

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
        enketo_redis_client = get_redis_connection('enketo_redis_main')

        try:
            enketo_redis_client.rename(
                src=f'or:{domain_name}/{previous_owner_username},{asset_uid}',
                dst=f'or:{domain_name}/{self.asset.owner.username},{asset_uid}'
            )
        except redis.exceptions.ResponseError:
            # original does not exist, weird but don't raise a 500 for that
            pass

    def set_active(self, active):
        """
        `PATCH` active boolean of the survey.
        Store results in deployment data
        """
        # self.store_data is an alias for
        # self.asset._deployment_data.update(...)
        url = self.normalize_internal_url(
            self.backend_response['url'])
        payload = {
            'downloadable': bool(active)
        }
        json_response = self._kobocat_request('PATCH', url, data=payload)
        assert json_response['downloadable'] == bool(active)

        self.save_to_db({
            'active': json_response['downloadable'],
            'backend_response': json_response,
        })

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
            force or
            self.backend_response.get('kpi_asset_uid', None) is None
        )
        if is_synchronized:
            return False

        url = self.normalize_internal_url(self.backend_response['url'])
        payload = {
            'kpi_asset_uid': self.asset.uid
        }
        json_response = self._kobocat_request('PATCH', url, data=payload)
        is_set = json_response['kpi_asset_uid'] == self.asset.uid
        assert is_set
        self.store_data({
            'backend_response': json_response,
        })
        return True

    def set_enketo_open_rosa_server(
        self, require_auth: bool, enketo_id: str = None
    ):
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

    def set_has_kpi_hooks(self):
        """
        `PATCH` `has_kpi_hooks` boolean of related KoBoCAT XForm.
        It lets KoBoCAT know whether it needs to notify KPI
        each time a submission comes in.

        Store results in deployment data
        """
        has_active_hooks = self.asset.has_active_hooks
        url = self.normalize_internal_url(
            self.backend_response['url'])
        payload = {
            'has_kpi_hooks': has_active_hooks,
            'kpi_asset_uid': self.asset.uid
        }

        try:
            json_response = self._kobocat_request('PATCH', url, data=payload)
        except KobocatDeploymentException as e:
            if (
                has_active_hooks is False
                and hasattr(e, 'response')
                and e.response.status_code == status.HTTP_404_NOT_FOUND
            ):
                # It's okay if we're trying to unset the active hooks flag and
                # the KoBoCAT project is already gone. See #2497
                pass
            else:
                raise
        else:
            assert json_response['has_kpi_hooks'] == has_active_hooks
            self.store_data({
                'backend_response': json_response,
            })

    def set_validation_status(
        self,
        submission_id: int,
        user: settings.AUTH_USER_MODEL,
        data: dict,
        method: str,
    ) -> dict:
        """
        Update validation status through KoBoCAT proxy,
        authenticated by `user`'s API token.
        If `method` is `DELETE`, the status is reset to `None`

        It returns a dictionary which can used as Response object arguments
        """

        self.validate_access_with_partial_perms(
            user=user,
            perm=PERM_VALIDATE_SUBMISSIONS,
            submission_ids=[submission_id],
        )

        kc_request_params = {
            'method': method,
            'url': self.get_submission_validation_status_url(submission_id),
        }

        if method == 'PATCH':
            kc_request_params.update({'json': data})

        kc_request = requests.Request(**kc_request_params)
        kc_response = self.__kobocat_proxy_request(kc_request, user)
        return self.__prepare_as_drf_response_signature(kc_response)

    def set_validation_statuses(
        self, user: settings.AUTH_USER_MODEL, data: dict
    ) -> dict:
        """
        Bulk update validation status for provided submissions through
        KoBoCAT proxy, authenticated by `user`'s API token.

        `data` should contains either the submission ids or the query to
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
        # Otherwise, they have have full access.
        if submission_ids:
            # Remove query from `data` because all the submission ids have been
            # already retrieved
            data.pop('query', None)
            data['submission_ids'] = submission_ids

        # `PATCH` KC even if KPI receives `DELETE`
        url = self.submission_list_url
        kc_request = requests.Request(method='PATCH', url=url, json=data)
        kc_response = self.__kobocat_proxy_request(kc_request, user)
        return self.__prepare_as_drf_response_signature(kc_response)

    def store_submission(
        self, user, xml_submission, submission_uuid, attachments=None
    ):
        file_tuple = (submission_uuid, io.StringIO(xml_submission))
        files = {'xml_submission_file': file_tuple}
        if attachments:
            files.update(attachments)
        kc_request = requests.Request(
            method='POST', url=self.submission_url, files=files
        )
        kc_response = self.__kobocat_proxy_request(kc_request, user=user)
        return kc_response

    @property
    def submission_count(self):
        try:
            return self.xform.num_of_submissions
        except InvalidXFormException:
            return 0

    @property
    def submission_list_url(self):
        url = '{kc_base}/api/v1/data/{formid}'.format(
            kc_base=settings.KOBOCAT_INTERNAL_URL,
            formid=self.backend_response['formid']
        )
        return url

    @property
    def submission_model(self):
        return ReadOnlyKobocatInstance

    @property
    def submission_url(self) -> str:
        # Use internal host to secure calls to KoBoCAT API,
        # kobo-service-account can restrict requests per hosts.
        url = '{kc_base}/submission'.format(
            kc_base=settings.KOBOCAT_INTERNAL_URL,
        )
        return url

    def sync_media_files(self, file_type: str = AssetFile.FORM_MEDIA):

        url = self.normalize_internal_url(self.backend_response['url'])
        response = self._kobocat_request('GET', url)
        kc_files = defaultdict(dict)

        # Build a list of KoBoCAT metadata to compare with KPI
        for metadata in response.get('metadata', []):
            if metadata['data_type'] == self.SYNCED_DATA_FILE_TYPES[file_type]:
                kc_files[metadata['data_value']] = {
                    'pk': metadata['id'],
                    'url': metadata['url'],
                    'md5': metadata['file_hash'],
                    'from_kpi': metadata['from_kpi'],
                }

        kc_filenames = kc_files.keys()

        queryset = self._get_metadata_queryset(file_type=file_type)

        for media_file in queryset:

            backend_media_id = media_file.backend_media_id

            # File does not exist in KC
            if backend_media_id not in kc_filenames:
                if media_file.deleted_at is None:
                    # New file
                    self.__save_kc_metadata(media_file)
                else:
                    # Orphan, delete it
                    media_file.delete(force=True)
                continue

            # Existing file
            if backend_media_id in kc_filenames:
                kc_file = kc_files[backend_media_id]
                if media_file.deleted_at is None:
                    # If md5 differs, we need to re-upload it.
                    if media_file.md5_hash != kc_file['md5']:
                        if media_file.file_type == AssetFile.PAIRED_DATA:
                            self.__update_kc_metadata_hash(
                                media_file, kc_file['pk']
                            )
                        else:
                            self.__delete_kc_metadata(kc_file)
                            self.__save_kc_metadata(media_file)
                elif kc_file['from_kpi']:
                    self.__delete_kc_metadata(kc_file, media_file)
                else:
                    # Remote file has been uploaded directly to KC. We
                    # cannot delete it, but we need to vacuum KPI.
                    media_file.delete(force=True)
                    # Skip deletion of key corresponding to `backend_media_id`
                    # in `kc_files` to avoid unique constraint failure in case
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

                # Remove current filename from `kc_files`.
                # All files which will remain in this dict (after this loop)
                # will be considered obsolete and will be deleted
                del kc_files[backend_media_id]

        # Remove KC orphan files previously uploaded through KPI
        for kc_file in kc_files.values():
            if kc_file['from_kpi']:
                self.__delete_kc_metadata(kc_file)

    @property
    def xform(self):
        if not hasattr(self, '_xform'):
            pk = self.backend_response['formid']
            xform = (
                KobocatXForm.objects.filter(pk=pk)
                .only(
                    'user__username',
                    'id_string',
                    'num_of_submissions',
                    'attachment_storage_bytes',
                    'require_auth',
                )
                .select_related(
                    'user'
                )  # Avoid extra query to validate username below
                .first()
            )

            if not (
                xform
                and xform.user.username == self.asset.owner.username
                and xform.id_string == self.xform_id_string
            ):
                raise InvalidXFormException(
                    'Deployment links to an unexpected KoBoCAT XForm')
            setattr(self, '_xform', xform)

        return self._xform

    @property
    def xform_id(self):
        return self.xform.pk

    @property
    def xform_id_string(self):
        return self.get_data('backend_response.id_string')

    @property
    def timestamp(self):
        try:
            return self.backend_response['date_modified']
        except KeyError:
            return None

    @staticmethod
    @contextmanager
    def suspend_submissions(user_ids: list[int]):
        KobocatUserProfile.objects.filter(
            user_id__in=user_ids
        ).update(
            metadata=UpdateJSONFieldAttributes(
                'metadata',
                updates={'submissions_suspended': True},
            ),
        )
        try:
            yield
        finally:
            KobocatUserProfile.objects.filter(
                user_id__in=user_ids
            ).update(
                metadata=UpdateJSONFieldAttributes(
                    'metadata',
                    updates={'submissions_suspended': False},
                ),
            )

    def transfer_submissions_ownership(
        self, previous_owner_username: str
    ) -> bool:

        results = settings.MONGO_DB.instances.update_many(
            {'_userform_id': f'{previous_owner_username}_{self.xform_id_string}'},
            {
                '$set': {
                    '_userform_id': self.mongo_userform_id
                }
            },
        )

        return (
            results.matched_count == 0 or
            (
                results.matched_count > 0
                and results.matched_count == results.modified_count
            )
        )

    def transfer_counters_ownership(self, new_owner: 'auth.User'):

        NLPUsageCounter.objects.filter(
            asset=self.asset, user=self.asset.owner
        ).update(user=new_owner)
        KobocatDailyXFormSubmissionCounter.objects.filter(
            xform=self.xform, user_id=self.asset.owner.pk
        ).update(user=new_owner)
        KobocatMonthlyXFormSubmissionCounter.objects.filter(
            xform=self.xform, user_id=self.asset.owner.pk
        ).update(user=new_owner)

        KobocatUserProfile.objects.filter(user_id=self.asset.owner.pk).update(
            attachment_storage_bytes=F('attachment_storage_bytes')
            - self.xform.attachment_storage_bytes
        )
        KobocatUserProfile.objects.filter(user_id=self.asset.owner.pk).update(
            attachment_storage_bytes=F('attachment_storage_bytes')
            + self.xform.attachment_storage_bytes
        )

    def _kobocat_request(self, method, url, expect_formid=True, **kwargs):
        """
        Make a POST or PATCH request and return parsed JSON. Keyword arguments,
        e.g. `data` and `files`, are passed through to `requests.request()`.

        If `expect_formid` is False, it bypasses the presence of 'formid'
        property in KoBoCAT response and returns the KoBoCAT response whatever
        it is.

        `kwargs` contains arguments to be passed to KoBoCAT request.
        """

        expected_status_codes = {
            'GET': 200,
            'POST': 201,
            'PATCH': 200,
            'DELETE': 204,
        }

        try:
            expected_status_code = expected_status_codes[method]
        except KeyError:
            raise NotImplementedError(
                'This backend does not implement the {} method'.format(method)
            )

        # Make the request to KC
        try:
            kc_request = requests.Request(method=method, url=url, **kwargs)
            response = self.__kobocat_proxy_request(kc_request,
                                                    user=self.asset.owner)

        except requests.exceptions.RequestException as e:
            # Failed to access the KC API
            # TODO: clarify that the user cannot correct this
            raise KobocatDeploymentException(detail=str(e))

        # If it's a no-content success, return immediately
        if response.status_code == expected_status_code == 204:
            return {}

        # Parse the response
        try:
            json_response = response.json()
        except ValueError as e:
            # Unparseable KC API output
            # TODO: clarify that the user cannot correct this
            raise KobocatDeploymentException(
                detail=str(e), response=response)

        # Check for failure
        if (
            response.status_code != expected_status_code
            or json_response.get('type') == 'alert-error'
            or (expect_formid and 'formid' not in json_response)
        ):
            if 'text' in json_response:
                # KC API refused us for a specified reason, likely invalid
                # input Raise a 400 error that includes the reason
                e = KobocatDeploymentException(detail=json_response['text'])
                e.status_code = status.HTTP_400_BAD_REQUEST
                raise e
            else:
                # Unspecified failure; raise 500
                raise KobocatDeploymentException(
                    detail='Unexpected KoBoCAT error {}: {}'.format(
                        response.status_code, response.content),
                    response=response
                )

        return json_response

    def _last_submission_time(self):
        id_string = self.backend_response['id_string']
        return last_submission_time(
            xform_id_string=id_string, user_id=self.asset.owner.pk)

    @property
    def _open_rosa_server_storage(self):
        return default_kobocat_storage

    def __delete_kc_metadata(
        self, kc_file_: dict, file_: Union[AssetFile, PairedData] = None
    ):
        """
        A simple utility to delete metadata in KoBoCAT through proxy.
        If related KPI file is provided (i.e. `file_`), it is deleted too.
        """
        # Delete file in KC

        delete_url = self.normalize_internal_url(kc_file_['url'])
        self._kobocat_request('DELETE', url=delete_url, expect_formid=False)

        if file_ is None:
            return

        # Delete file in KPI if requested
        file_.delete(force=True)

    def __get_submissions_in_json(
        self,
        request: Optional['rest_framework.request.Request'] = None,
        **params
    ) -> Generator[dict, None, None]:
        """
        Retrieve submissions directly from Mongo.
        Submissions can be filtered with `params`.
        """
        # Apply a default sort of _id to prevent unpredictable natural sort
        if not params.get('sort'):
            params['sort'] = {'_id': 1}
        mongo_cursor, total_count = MongoHelper.get_instances(
            self.mongo_userform_id, **params)

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

    def __get_submissions_in_xml(
        self,
        **params
    ) -> Generator[str, None, None]:
        """
        Retrieve submissions directly from PostgreSQL.
        Submissions can be filtered with `params`.
        """

        mongo_filters = ['query', 'permission_filters']
        use_mongo = any(mongo_filter in mongo_filters for mongo_filter in params
                        if params.get(mongo_filter) is not None)

        if use_mongo:
            # We use Mongo to retrieve matching instances.
            params['fields'] = ['_id']
            # Force `sort` by `_id` for Mongo
            # See FIXME about sort in `BaseDeploymentBackend.validate_submission_list_params()`
            params['sort'] = {'_id': 1}
            submissions, count = MongoHelper.get_instances(
                self.mongo_userform_id, **params
            )
            submission_ids = [
                submission.get('_id')
                for submission in submissions
            ]
            self.current_submission_count = count

        queryset = ReadOnlyKobocatInstance.objects.filter(
            xform_id=self.xform_id,
        )

        if len(submission_ids) > 0 or use_mongo:
            queryset = queryset.filter(id__in=submission_ids)

        # Python-only attribute used by `kpi.views.v2.data.DataViewSet.list()`
        if not use_mongo:
            self.current_submission_count = queryset.count()

        # Force Sort by id
        # See FIXME about sort in `BaseDeploymentBackend.validate_submission_list_params()`
        queryset = queryset.order_by('id')

        # When using Mongo, data is already paginated,
        # no need to do it with PostgreSQL too.
        if not use_mongo:
            offset = params.get('start')
            limit = offset + params.get('limit')
            queryset = queryset[offset:limit]

        return (lazy_instance.xml for lazy_instance in queryset)

    @staticmethod
    def __kobocat_proxy_request(kc_request, user=None):
        """
        Send `kc_request`, which must specify `method` and `url` at a minimum.
        If the incoming request to be proxied is authenticated,
        logged-in user's API token will be added to `kc_request.headers`

        :param kc_request: requests.models.Request
        :param user: User
        :return: requests.models.Response
        """
        if not is_user_anonymous(user):
            kc_request.headers.update(get_request_headers(user.username))

        session = requests.Session()
        return session.send(kc_request.prepare())

    @staticmethod
    def __prepare_as_drf_response_signature(
        requests_response, expected_response_format='json'
    ):
        """
        Prepares a dict from `Requests` response.
        Useful to get response from KoBoCAT and use it as a dict or pass it to
        DRF Response
        """

        prepared_drf_response = {}

        # `requests_response` may not have `headers` attribute
        content_type = requests_response.headers.get('Content-Type')
        content_language = requests_response.headers.get('Content-Language')
        if content_type:
            prepared_drf_response['content_type'] = content_type
        if content_language:
            prepared_drf_response['headers'] = {
                'Content-Language': content_language
            }

        prepared_drf_response['status'] = requests_response.status_code

        try:
            prepared_drf_response['data'] = json.loads(
                requests_response.content)
        except ValueError as e:
            if (
                not requests_response.status_code == status.HTTP_204_NO_CONTENT
                and expected_response_format == 'json'
            ):
                prepared_drf_response['data'] = {
                    'detail': t(
                        'KoBoCAT returned an unexpected response: {}'.format(
                            str(e))
                    )
                }

        return prepared_drf_response

    @staticmethod
    def prepare_bulk_update_response(kc_responses: list) -> dict:
        """
        Formatting the response to allow for partial successes to be seen
        more explicitly.

        Args:
            kc_responses (list): A list containing dictionaries with keys of
            `_uuid` from the newly generated uuid and `response`, the response
            object received from KoBoCAT

        Returns:
            dict: formatted dict to be passed to a Response object and sent to
            the client
        """

        OPEN_ROSA_XML_MESSAGE = '{http://openrosa.org/http/response}message'

        # Unfortunately, the response message from OpenRosa is in XML format,
        # so it needs to be parsed before extracting the text
        results = []
        for response in kc_responses:
            message = t('Something went wrong')
            try:
                xml_parsed = fromstring_preserve_root_xmlns(
                    response['response'].content
                )
            except DET.ParseError:
                pass
            else:
                message_el = xml_parsed.find(OPEN_ROSA_XML_MESSAGE)
                if message_el is not None and message_el.text.strip():
                    message = message_el.text

            results.append(
                {
                    'uuid': response['uuid'],
                    'status_code': response['response'].status_code,
                    'message': message,
                }
            )

        total_update_attempts = len(results)
        total_successes = [result['status_code'] for result in results].count(
            status.HTTP_201_CREATED
        )

        return {
            'status': status.HTTP_200_OK
            if total_successes > 0
            # FIXME: If KoboCAT returns something unexpected, like a 404 or a
            # 500, then 400 is not the right response to send to the client
            else status.HTTP_400_BAD_REQUEST,
            'data': {
                'count': total_update_attempts,
                'successes': total_successes,
                'failures': total_update_attempts - total_successes,
                'results': results,
            },
        }

    def __save_kc_metadata(self, file_: SyncBackendMediaInterface):
        """
        Prepares request and data corresponding to the kind of media file
        (i.e. FileStorage or remote URL) to `POST` to KC through proxy.
        """
        server = settings.KOBOCAT_INTERNAL_URL
        metadata_url = f'{server}/api/v1/metadata'

        kwargs = {
            'data': {
                'data_value': file_.backend_media_id,
                'xform': self.xform_id,
                'data_type': self.SYNCED_DATA_FILE_TYPES[file_.file_type],
                'from_kpi': True,
                'data_filename': file_.filename,
                'data_file_type': file_.mimetype,
                'file_hash': file_.md5_hash,
            }
        }

        if not file_.is_remote_url:
            kwargs['files'] = {
                'data_file': (
                    file_.filename,
                    file_.content.file,
                    file_.mimetype,
                )
            }

        self._kobocat_request(
            'POST', url=metadata_url, expect_formid=False, **kwargs
        )

        file_.synced_with_backend = True
        file_.save(update_fields=['synced_with_backend'])

    def __update_kc_metadata_hash(
        self, file_: SyncBackendMediaInterface, kc_metadata_id: int
    ):
        """
        Update metadata hash in KC
        """
        server = settings.KOBOCAT_INTERNAL_URL
        metadata_detail_url = f'{server}/api/v1/metadata/{kc_metadata_id}'
        data = {'file_hash': file_.md5_hash}
        self._kobocat_request(
            'PATCH', url=metadata_detail_url, expect_formid=False, data=data
        )

        file_.synced_with_backend = True
        file_.save(update_fields=['synced_with_backend'])
