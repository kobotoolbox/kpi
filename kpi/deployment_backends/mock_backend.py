# coding: utf-8
import copy
import re
import time
import uuid
from datetime import datetime

import pytz
from django.urls import reverse
from rest_framework import status

from kpi.constants import (
    INSTANCE_FORMAT_TYPE_JSON,
    INSTANCE_FORMAT_TYPE_XML,
    PERM_CHANGE_SUBMISSIONS,
    PERM_DELETE_SUBMISSIONS,
    PERM_VALIDATE_SUBMISSIONS,
)
from kpi.interfaces.sync_backend_media import SyncBackendMediaInterface
from kpi.models.asset_file import AssetFile
from kpi.utils.iterators import to_int
from .base_backend import BaseDeploymentBackend


class MockDeploymentBackend(BaseDeploymentBackend):
    """
    Only used for unit testing and interface testing.
    """

    def bulk_assign_mapped_perms(self):
        pass

    def bulk_update_submissions(
        self, data: dict, user: 'auth.User'
    ) -> dict:

        submission_ids = self.validate_write_access_with_partial_perms(
            user=user,
            perm=PERM_CHANGE_SUBMISSIONS,
            submission_ids=data['submission_ids'],
            query=data['query'],
        )

        if not submission_ids:
            submission_ids = data['submission_ids']

        submissions = self.get_submissions(
            user=user,
            format_type=INSTANCE_FORMAT_TYPE_JSON,
            submission_ids=submission_ids
        )

        submission_ids = to_int(submission_ids)

        responses = []
        for submission in submissions:
            if submission[self.SUBMISSION_ID_FIELDNAME] in submission_ids:
                _uuid = uuid.uuid4()
                submission['deprecatedID'] = submission['instanceID']
                submission['instanceID'] = f'uuid:{_uuid}'
                for k, v in data['data'].items():
                    submission[k] = v

                # Mirror KobocatDeploymentBackend responses
                responses.append(
                    {
                        'uuid': _uuid,
                        'status_code': status.HTTP_201_CREATED,
                        'message': 'Successful submission'
                    }
                )

        self.mock_submissions(submissions)
        return self.__prepare_bulk_update_response(responses)

    def calculated_submission_count(self, user: 'auth.User', **kwargs) -> int:
        params = self.validate_submission_list_params(user,
                                                      validate_count=True,
                                                      **kwargs)
        instances = self.get_submissions(user=user, **params)
        return len(instances)

    def connect(self, active=False):
        self.store_data({
            'backend': 'mock',
            'identifier': 'mock://%s' % self.asset.uid,
            'active': active,
            'backend_response': {
                'downloadable': active,
                'has_kpi_hook': self.asset.has_active_hooks,
                'kpi_asset_uid': self.asset.uid
            }
        })

    def delete_submission(self, submission_id: int, user: 'auth.User') -> dict:
        """
        Delete a submission
        """

        self.validate_write_access_with_partial_perms(
            user=user,
            perm=PERM_DELETE_SUBMISSIONS,
            submission_ids=[submission_id],
        )

        submissions = self.get_data('submissions', [])
        iterator = submissions.copy()
        for submission in iterator:
            if int(submission[self.SUBMISSION_ID_FIELDNAME]) == int(
                submission_id
            ):
                submissions.remove(submission)
                self.mock_submissions(submissions)
                return {
                    'content_type': 'application/json',
                    'status': status.HTTP_204_NO_CONTENT,
                }

        return {
            'content_type': 'application/json',
            'status': status.HTTP_404_NOT_FOUND,
        }

    def delete_submissions(self, data: dict, user: 'auth.User') -> dict:
        """
        Bulk delete provided submissions authenticated by `user`'s API token.

        `data` should contains the submission ids or the query to get the subset
        of submissions to delete
        Example:
             {"submission_ids": [1, 2, 3]}
             or
             {"query": {"Question": "response"}
        """
        submission_ids = self.validate_write_access_with_partial_perms(
            user=user,
            perm=PERM_DELETE_SUBMISSIONS,
            submission_ids=data['submission_ids'],
            query=data['query'],
        )

        if not submission_ids:
            submission_ids = data['submission_ids']
        else:
            data['query'] = {}

        submissions = self.get_submissions(user,
                                           submission_ids=submission_ids,
                                           query=data['query'])

        if not submissions:
            return {
                'content_type': 'application/json',
                'status': status.HTTP_404_NOT_FOUND,
            }

        iterator = submissions.copy()
        for submission in iterator:
            if (
                data.get('confirm')
                or int(submission[self.SUBMISSION_ID_FIELDNAME]) in submission_ids
            ):
                submissions.remove(submission)

        self.mock_submissions(submissions)

        return {
            'content_type': 'application/json',
            'status': status.HTTP_204_NO_CONTENT,
        }

    def duplicate_submission(
        self, submission_id: int, user: 'auth.User'
    ) -> dict:
        # TODO: Make this operate on XML somehow and reuse code from
        # KobocatDeploymentBackend, to catch issues like #3054

        self.validate_write_access_with_partial_perms(
            user=user,
            perm=PERM_CHANGE_SUBMISSIONS,
            submission_ids=[submission_id],
        )

        all_submissions = self.get_data('submissions')
        duplicated_submission = copy.deepcopy(
            self.get_submission(submission_id, user=user)
        )
        next_id = (
            max((sub[self.SUBMISSION_ID_FIELDNAME] for sub in all_submissions))
            + 1
        )
        updated_time = datetime.now(tz=pytz.UTC).isoformat('T', 'milliseconds')
        duplicated_submission.update({
            '_id': next_id,
            'start': updated_time,
            'end': updated_time,
            'instanceID': f'uuid:{uuid.uuid4()}'
        })
        all_submissions.append(duplicated_submission)
        self.mock_submissions(all_submissions)

        return duplicated_submission

    def get_data_download_links(self):
        return {}

    def get_enketo_submission_url(
        self, submission_id: int, user: 'auth.User', params: dict = None
    ) -> dict:
        """
        Gets URL of the submission in a format FE can understand
        """

        self.validate_write_access_with_partial_perms(
            user=user,
            perm=PERM_CHANGE_SUBMISSIONS,
            submission_ids=[submission_id],
        )

        return {
            'content_type': 'application/json',
            'data': {
                'url': f'http://server.mock/enketo/{submission_id}'
            }
        }

    def get_enketo_survey_links(self):
        # `self` is a demo Enketo form, but there's no guarantee it'll be
        # around forever.
        return {
            'offline_url': 'https://enke.to/_/#self',
            'url': 'https://enke.to/::self',
            'iframe_url': 'https://enke.to/i/::self',
            'preview_url': 'https://enke.to/preview/::self',
            # 'preview_iframe_url': 'https://enke.to/preview/i/::self',
        }

    def get_submission_detail_url(self, submission_id: int) -> str:
        # This doesn't really need to be implemented.
        # We keep it to stay close to `KobocatDeploymentBackend`
        url = f'{self.submission_list_url}/{submission_id}'
        return url

    def get_submission_validation_status_url(self, submission_id: int) -> str:
        url = '{detail_url}validation_status/'.format(
            detail_url=self.get_submission_detail_url(submission_id)
        )
        return url

    def get_submissions(self,
                        user: 'auth.User',
                        format_type: str = INSTANCE_FORMAT_TYPE_JSON,
                        submission_ids: list = [],
                        **kwargs) -> list:
        """
        Retrieves submissions whose `user` is allowed to access
        The format `format_type` can be either:
        - 'json' (See `kpi.constants.INSTANCE_FORMAT_TYPE_JSON)
        - 'xml' (See `kpi.constants.INSTANCE_FORMAT_TYPE_XML)

        Results can be filtered on instance ids and/or MongoDB filters can be
        passed through `kwargs`
        TODO support Mongo Query and XML
        """

        submissions = self.get_data('submissions', [])
        kwargs['submission_ids'] = submission_ids
        params = self.validate_submission_list_params(user,
                                                      format_type=format_type,
                                                      **kwargs)
        permission_filters = params['permission_filters']

        if len(submission_ids) > 0:
            if format_type == INSTANCE_FORMAT_TYPE_XML:
                submission_ids = [str(submission_id) for submission_id in
                                  submission_ids]
                # ugly way to find matches, but it avoids to load each xml in memory  # noqa
                pattern = r'<{id_field}>({submission_ids})<\/{id_field}>'.format(
                    submission_ids='|'.join(submission_ids),
                    id_field=self.SUBMISSION_ID_FIELDNAME
                )
                submissions = [
                    submission
                    for submission in submissions
                    if re.search(pattern, submission)
                ]
            else:
                submission_ids = [
                    int(submission_id)
                    for submission_id in submission_ids
                ]

                submissions = [
                    submission
                    for submission in submissions
                    if submission.get(self.SUBMISSION_ID_FIELDNAME)
                    in submission_ids
                ]

        if permission_filters:
            submitted_by = [k.get('_submitted_by') for k in permission_filters]
            if format_type == INSTANCE_FORMAT_TYPE_XML:
                # TODO handle `submitted_by` too.
                raise NotImplementedError
            else:
                submissions = [
                    submission
                    for submission in submissions
                    if submission.get('_submitted_by') in submitted_by
                ]

        # Python-only attribute used by `kpi.views.v2.data.DataViewSet.list()`
        self.current_submissions_count = len(submissions)

        # TODO: support other query parameters?
        if 'limit' in params:
            submissions = submissions[:params['limit']]

        return submissions

    def get_validation_status(
        self, submission_id, user: 'auth.User', params: dict
    ) -> dict:

        submission = self.get_submission(submission_id, user)
        return {
            'content_type': 'application/json',
            'data': submission.get('_validation_status')
        }

    def mock_submissions(self, submissions: list):
        """
        Insert dummy submissions into deployment data
        """
        self.store_data({'submissions': submissions})
        self.asset.save(create_version=False)

    def redeploy(self, active: bool = None):
        """
        Replace (overwrite) the deployment, keeping the same identifier, and
        optionally changing whether the deployment is active
        """
        if active is None:
            active = self.active

        self.store_data({
            'active': active,
            'version': self.asset.version_id,
        })

        self.set_asset_uid()

    def set_active(self, active: bool):
        self.save_to_db({
            'active': bool(active),
        })

    def set_asset_uid(self, **kwargs) -> bool:
        backend_response = self.backend_response
        backend_response.update({
            'kpi_asset_uid': self.asset.uid,
        })
        self.store_data({
            'backend_response': backend_response
        })

    def set_has_kpi_hooks(self):
        """
        Store a boolean which indicates that KPI has active hooks (or not)
        and, if it is the case, it should receive notifications when new data
        comes in
        """
        has_active_hooks = self.asset.has_active_hooks
        self.store_data({
            'has_kpi_hooks': has_active_hooks,
        })

    def set_namespace(self, namespace):
        self.store_data({
            'namespace': namespace,
        })

    def set_validation_status(self,
                              submission_id: int,
                              user: 'auth.User',
                              data: dict,
                              method: str) -> dict:

        self.validate_write_access_with_partial_perms(
            user=user,
            perm=PERM_VALIDATE_SUBMISSIONS,
            submission_ids=[submission_id],
        )

        # use the owner to retrieve all the submissions to mock them again
        # after the update
        # FIXME Avoid looping on all submissions.
        submissions = self.get_submissions(user=self.asset.owner)
        validation_status = {}
        status_code = status.HTTP_204_NO_CONTENT

        if method != 'DELETE':
            validation_status = {
                'timestamp': int(time.time()),
                'uid': data['validation_status.uid'],
                'by_whom': user.username,
            }
            status_code = status.HTTP_200_OK

        for submission in submissions:
            if submission[self.SUBMISSION_ID_FIELDNAME] == int(submission_id):
                submission['_validation_status'] = validation_status
                self.mock_submissions(submissions)
                return {
                    'content_type': 'application/json',
                    'status': status_code,
                    'data': validation_status
                }

    def set_validation_statuses(self, user: 'auth.User', data: dict) -> dict:
        """
        Bulk update validation status for provided submissions.

        `data` should contains either the submission ids or the query to
        retrieve the subset of submissions chosen by then user.
        If none of them are provided, all the submissions are selected
        Examples:
            {"submission_ids": [1, 2, 3]}
            {"query":{"_validation_status.uid":"validation_status_not_approved"}
        
        NOTES: Mongo query is not supported yet 
        """

        submission_ids = self.validate_write_access_with_partial_perms(
            user=user,
            perm=PERM_VALIDATE_SUBMISSIONS,
            submission_ids=data['submission_ids'],
            query=data['query'],
        )

        # use the owner to retrieve all the submissions to mock them again
        # after the update
        # FIXME Avoid looping on all submissions.
        submissions = self.get_submissions(user=self.asset.owner)

        if not submission_ids:
            submission_ids = data['submission_ids']
        else:
            # Reset query because submission ids are provided from partial
            # perms validation
            data['query'] = {}

        user_submissions = self.get_submissions(
            user=user,
            submission_ids=submission_ids,
            query=data['query'],
        )
        # Retrieve user submission
        user_submission_ids = [
            user_submission[self.SUBMISSION_ID_FIELDNAME]
            for user_submission in user_submissions
        ]

        for submission in submissions:
            if submission[self.SUBMISSION_ID_FIELDNAME] in user_submission_ids:
                if not data['validation_status.uid']:
                    submission['_validation_status'] = {}
                else:
                    submission['_validation_status'] = {
                        'timestamp': int(time.time()),
                        'uid': data['validation_status.uid'],
                        'by_whom': user.username,
                    }

        self.mock_submissions(submissions)
        submissions_count = len(user_submission_ids)

        return {
            'content_type': 'application/json',
            'status': status.HTTP_200_OK,
            'data': {
                'detail': f'{submissions_count} submissions have been updated'
            }
        }

    @property
    def submission_list_url(self):
        # This doesn't really need to be implemented.
        # We keep it to stay close to `KobocatDeploymentBackend`
        view_name = 'submission-list'
        namespace = self.get_data('namespace', None)
        if namespace is not None:
            view_name = '{}:{}'.format(namespace, view_name)
        return reverse(view_name,
                       kwargs={'parent_lookup_asset': self.asset.uid})

    def sync_media_files(self, file_type: str = AssetFile.FORM_MEDIA):
        queryset = self._get_metadata_queryset(file_type=file_type)
        for obj in queryset:
            assert issubclass(obj.__class__, SyncBackendMediaInterface)

    def _submission_count(self):
        submissions = self.get_data('submissions', [])
        return len(submissions)

    @staticmethod
    def __prepare_bulk_update_response(kc_responses: list) -> dict:
        total_update_attempts = len(kc_responses)
        total_successes = total_update_attempts  # all will be successful
        return {
            'status': status.HTTP_200_OK,
            'data': {
                'count': total_update_attempts,
                'successes': total_successes,
                'failures': total_update_attempts - total_successes,
                'results': kc_responses,
            },
        }
