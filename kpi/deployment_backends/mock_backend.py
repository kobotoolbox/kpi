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
    PERM_ADD_SUBMISSIONS,
    PERM_CHANGE_SUBMISSIONS,
    PERM_DELETE_SUBMISSIONS,
    PERM_VALIDATE_SUBMISSIONS,
)
from kpi.utils.iterators import to_int
from .base_backend import BaseDeploymentBackend


class MockDeploymentBackend(BaseDeploymentBackend):
    """
    Only used for unit testing and interface testing.
    """

    def bulk_assign_mapped_perms(self):
        pass

    def bulk_update_submissions(
        self, data: dict, requesting_user: 'auth.User'
    ) -> dict:

        submission_ids = self.validate_write_access_with_partial_perms(
            user=requesting_user,
            perm=PERM_CHANGE_SUBMISSIONS,
            submission_ids=data['submission_ids'],
            query=data['query'],
        )

        if not submission_ids:
            submission_ids = data['submission_ids']

        submissions = self.get_submissions(
            requesting_user_id=requesting_user.pk,
            format_type=INSTANCE_FORMAT_TYPE_JSON,
            instance_ids=submission_ids
        )

        submission_ids = to_int(submission_ids)

        responses = []
        for submission in submissions:
            if submission[self.INSTANCE_ID_FIELDNAME] in submission_ids:
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

    def calculated_submission_count(self, requesting_user_id, **kwargs):
        params = self.validate_submission_list_params(requesting_user_id,
                                                      validate_count=True,
                                                      **kwargs)
        instances = self.get_submissions(requesting_user_id, **params)
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

    def delete_submission(self, pk: int, user: 'auth.User') -> dict:
        """
        Delete a submission
        """

        self.validate_write_access_with_partial_perms(
            user=user,
            perm=PERM_DELETE_SUBMISSIONS,
            submission_ids=[pk],
        )

        submissions = self.get_data('submissions', [])
        iterator = submissions.copy()
        for submission in iterator:
            if int(submission[self.INSTANCE_ID_FIELDNAME]) == int(pk):
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
                                           instance_ids=submission_ids,
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
                or int(submission[self.INSTANCE_ID_FIELDNAME]) in submission_ids
            ):
                submissions.remove(submission)

        self.mock_submissions(submissions)

        return {
            'content_type': 'application/json',
            'status': status.HTTP_204_NO_CONTENT,
        }

    def duplicate_submission(
        self, requesting_user: 'auth.User', instance_id: int
    ) -> dict:
        # TODO: Make this operate on XML somehow and reuse code from
        # KobocatDeploymentBackend, to catch issues like #3054

        self.validate_write_access_with_partial_perms(
            user=requesting_user,
            perm=PERM_CHANGE_SUBMISSIONS,
            submission_ids=[instance_id],
        )

        all_submissions = self.get_data('submissions')
        duplicated_submission = copy.deepcopy(
            self.get_submission(instance_id, requesting_user)
        )
        next_id = (
            max((sub[self.INSTANCE_ID_FIELDNAME] for sub in all_submissions))
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

    def get_submission_detail_url(self, submission_pk):
        # This doesn't really need to be implemented.
        # We keep it to stay close to `KobocatDeploymentBackend`
        url = '{list_url}{pk}/'.format(
            list_url=self.submission_list_url,
            pk=submission_pk
        )
        return url

    def get_enketo_submission_url(
        self, submission_pk: int, user: 'auth.User', params: dict = None
    ) -> dict:
        """
        Gets URL of the submission in a format FE can understand
        """

        self.validate_write_access_with_partial_perms(
            user=user,
            perm=PERM_CHANGE_SUBMISSIONS,
            submission_ids=[submission_pk],
        )

        return {
            'content_type': 'application/json',
            'data': {
                'url': f'http://server.mock/enketo/{submission_pk}'
            }
        }

    def get_submission_validation_status_url(self, submission_pk):
        # This doesn't really need to be implemented.
        # We keep it to stay close to `KobocatDeploymentBackend`
        url = '{detail_url}validation_status/'.format(
            detail_url=self.get_submission_detail_url(submission_pk)
        )
        return url

    def get_submissions(self, requesting_user_id,
                        format_type=INSTANCE_FORMAT_TYPE_JSON,
                        instance_ids=[], **kwargs):
        """
        Retrieves submissions on `format_type`.
        It can be filtered on instances ids.

        TODO support Mongo Query and XML

        Args:
            requesting_user_id (int)
            format_type (str): INSTANCE_FORMAT_TYPE_JSON|INSTANCE_FORMAT_TYPE_XML
            instance_ids (list): Instance ids to retrieve
            kwargs (dict): Filters to pass to MongoDB. See
                https://docs.mongodb.com/manual/reference/operator/query/

        Returns:
            (dict|str|`None`): Depending of `format_type`, it can return:
                - Mongo JSON representation as a dict
                - Instances' XML as string
                - `None` if no results
        """

        submissions = self.get_data("submissions", [])
        kwargs['instance_ids'] = instance_ids
        params = self.validate_submission_list_params(requesting_user_id,
                                                      format_type=format_type,
                                                      **kwargs)
        permission_filters = params['permission_filters']

        if len(instance_ids) > 0:
            if format_type == INSTANCE_FORMAT_TYPE_XML:
                instance_ids = [str(instance_id) for instance_id in
                                instance_ids]
                # ugly way to find matches, but it avoids to load each xml in memory
                pattern = r'<{id_field}>({instance_ids})<\/{id_field}>'.format(
                    instance_ids='|'.join(instance_ids),
                    id_field=self.INSTANCE_ID_FIELDNAME
                )
                submissions = [
                    submission
                    for submission in submissions
                    if re.search(pattern, submission)
                ]
            else:
                instance_ids = [
                    int(instance_id)
                    for instance_id in instance_ids
                ]

                submissions = [
                    submission
                    for submission in submissions
                    if submission.get(self.INSTANCE_ID_FIELDNAME)
                    in instance_ids
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

    def get_validation_status(self, submission_pk, params, user):

        submission = self.get_submission(submission_pk, user.id)
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

    def redeploy(self, active=None):
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

    def set_active(self, active):
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
                              submission_pk: int,
                              data: dict,
                              user: 'auth.User',
                              method: str) -> dict:

        self.validate_write_access_with_partial_perms(
            user=user,
            perm=PERM_VALIDATE_SUBMISSIONS,
            submission_ids=[submission_pk],
        )

        # use the owner to retrieve all the submissions to mock them again
        # after the update
        # FIXME Avoid looping on all submissions.
        submissions = self.get_submissions(requesting_user_id=self.asset.owner)
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
            if submission[self.INSTANCE_ID_FIELDNAME] == int(submission_pk):
                submission['_validation_status'] = validation_status
                self.mock_submissions(submissions)
                return {
                    'content_type': 'application/json',
                    'status': status_code,
                    'data': validation_status
                }

    def set_validation_statuses(self, data: dict, user: 'auth.User') -> dict:
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
        submissions = self.get_submissions(requesting_user_id=self.asset.owner)

        if not submission_ids:
            submission_ids = data['submission_ids']
        else:
            # Reset query because submission ids are provided from partial
            # perms validation
            data['query'] = {}

        user_submissions = self.get_submissions(
            requesting_user_id=user,
            instance_ids=submission_ids,
            query=data['query'],
        )
        # Retrieve user submission
        user_submission_ids = [
            user_submission[self.INSTANCE_ID_FIELDNAME]
            for user_submission in user_submissions
        ]

        for submission in submissions:
            if submission[self.INSTANCE_ID_FIELDNAME] in user_submission_ids:
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
                       kwargs={"parent_lookup_asset": self.asset.uid})

    def _mock_submission(self, submission):
        """
        @TODO may be useless because of mock_submissions.
        Remove if it's not used anymore anywhere else.
        :param submission:
        """
        submissions = self.get_data('submissions', [])
        submissions.append(submission)
        self.store_data({
            'submissions': submissions,
        })

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
