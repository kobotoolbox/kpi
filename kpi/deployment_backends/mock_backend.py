# coding: utf-8
import copy
import re
import uuid
from datetime import datetime

import pytz
from django.urls import reverse
from rest_framework import status

from kpi.constants import INSTANCE_FORMAT_TYPE_JSON, INSTANCE_FORMAT_TYPE_XML
from kpi.exceptions import KobocatBulkUpdateSubmissionsException
from .base_backend import BaseDeploymentBackend


class MockDeploymentBackend(BaseDeploymentBackend):
    """
    Only used for unit testing and interface testing.

    defines the interface for a deployment backend.

    # TODO. Stop using protected property `_deployment_data`.
    """

    def bulk_assign_mapped_perms(self):
        pass

    def connect(self, active=False):
        self.store_data({
                'backend': 'mock',
                'identifier': 'mock://%s' % self.asset.uid,
                'active': active,
            })

    def redeploy(self, active=None):
        """
        Replace (overwrite) the deployment, keeping the same identifier, and
        optionally changing whether the deployment is active
        """
        if active is None:
            active = self.active
        self.set_active(active)

    def set_active(self, active):
        self.store_data({
                'active': bool(active),
            })

    def set_namespace(self, namespace):
        self.store_data({
            'namespace': namespace,
        })

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

    @property
    def submission_list_url(self):
        # This doesn't really need to be implemented.
        # We keep it to stay close to `KobocatDeploymentBackend`
        view_name = 'submission-list'
        namespace = self.asset._deployment_data.get('namespace', None)
        if namespace is not None:
            view_name = '{}:{}'.format(namespace, view_name)
        return reverse(view_name, kwargs={"parent_lookup_asset": self.asset.uid})

    def get_submission_detail_url(self, submission_pk):
        # This doesn't really need to be implemented.
        # We keep it to stay close to `KobocatDeploymentBackend`
        url = '{list_url}{pk}/'.format(
            list_url=self.submission_list_url,
            pk=submission_pk
        )
        return url

    def get_submission_edit_url(self, submission_pk, user, params=None):
        """
        Gets edit URL of the submission in a format FE can understand

        :param submission_pk: int
        :param user: User
        :param params: dict
        :return: dict
        """

        return {
            "data": {
                "url": "http://server.mock/enketo/{}".format(submission_pk)
            }
        }

    def get_submission_validation_status_url(self, submission_pk):
        # This doesn't really need to be implemented.
        # We keep it to stay close to `KobocatDeploymentBackend`
        url = '{detail_url}validation_status/'.format(
            detail_url=self.get_submission_detail_url(submission_pk)
        )
        return url

    def delete_submission(self, pk, user):
        """
        Deletes submission
        :param pk: int
        :param user: User
        :return: JSON
        """
        # No need to delete data, just fake it
        return {
            "content_type": "application/json",
            "status": status.HTTP_204_NO_CONTENT,
        }

    def get_data_download_links(self):
        return {}

    def _submission_count(self):
        submissions = self.asset._deployment_data.get('submissions', [])
        return len(submissions)

    def _mock_submission(self, submission):
        """
        @TODO may be useless because of mock_submissions. Remove if it's not used anymore anywhere else.
        :param submission:
        """
        submissions = self.asset._deployment_data.get('submissions', [])
        submissions.append(submission)
        self.store_data({
            'submissions': submissions,
            })

    def mock_submissions(self, submissions):
        """
        Insert dummy submissions into `asset._deployment_data`
        :param submissions: list
        """
        self.store_data({"submissions": submissions})
        self.asset.save(create_version=False)

    def get_submissions(self, requesting_user_id,
                        format_type=INSTANCE_FORMAT_TYPE_JSON,
                        instance_ids=[], **kwargs):
        """
        Retrieves submissions on `format_type`.
        It can be filtered on instances ids.

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

        submissions = self.asset._deployment_data.get("submissions", [])
        kwargs['instance_ids'] = instance_ids
        params = self.validate_submission_list_params(requesting_user_id,
                                                      format_type=format_type,
                                                      **kwargs)
        permission_filters = params['permission_filters']

        if len(instance_ids) > 0:
            if format_type == INSTANCE_FORMAT_TYPE_XML:
                instance_ids = [str(instance_id) for instance_id in instance_ids]
                # ugly way to find matches, but it avoids to load each xml in memory.
                pattern = r'<{id_field}>({instance_ids})<\/{id_field}>'.format(
                    instance_ids='|'.join(instance_ids),
                    id_field=self.INSTANCE_ID_FIELDNAME
                )
                submissions = [submission for submission in submissions
                               if re.search(pattern, submission)]
            else:
                instance_ids = [int(instance_id) for instance_id in instance_ids]
                submissions = [submission for submission in submissions
                               if submission.get(self.INSTANCE_ID_FIELDNAME)
                               in instance_ids]

        if permission_filters:
            submitted_by = [k.get('_submitted_by') for k in permission_filters]
            if format_type == INSTANCE_FORMAT_TYPE_XML:
                # TODO handle `submitted_by` too.
                raise NotImplementedError
            else:
                submissions = [submission for submission in submissions
                               if submission.get('_submitted_by') in submitted_by]

        # Python-only attribute used by `kpi.views.v2.data.DataViewSet.list()`
        self.current_submissions_count = len(submissions)

        # TODO: support other query parameters?
        if 'limit' in params:
            submissions = submissions[:params['limit']]

        return submissions

    def duplicate_submission(
        self, requesting_user_id: int, instance_id: int, **kwargs: dict
    ) -> dict:
        # TODO: Make this operate on XML somehow and reuse code from
        # KobocatDeploymentBackend, to catch issues like #3054
        all_submissions = self.asset._deployment_data['submissions']
        submission = next(
            filter(lambda sub: sub['_id'] == instance_id, all_submissions)
        )
        next_id = max((sub['_id'] for sub in all_submissions)) + 1
        updated_time = datetime.now(tz=pytz.UTC).isoformat('T', 'milliseconds')
        updated_fields = {
                '_id': next_id,
                'start': updated_time,
                'end': updated_time,
                'instanceID': f'uuid:{uuid.uuid4()}'
                }

        return {**submission, **updated_fields}

    def get_validation_status(self, submission_pk, params, user):
        submission = self.get_submission(submission_pk, user.id,
                                         INSTANCE_FORMAT_TYPE_JSON)
        return {
            "data": submission.get("_validation_status")
        }

    def set_validation_status(self, submission_pk, data, user, method):
        pass

    def set_validation_statuses(self, data, user, method):
        pass

    @staticmethod
    def __prepare_bulk_update_payload(request_data: dict) -> dict:
        # For some reason DRF puts the strings into a list so this just takes
        # them back out again to more accurately reflect the behaviour of the
        # non-mocked methods
        for k,v in request_data['data'].items():
            request_data['data'][k] = v[0]

        request_data['submission_ids'] = list(
            set(map(int, request_data['submission_ids']))
        )

        return request_data

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

    def bulk_update_submissions(
        self, request_data: dict, requesting_user_id: int
    ) -> dict:
        payload = self.__prepare_bulk_update_payload(request_data)
        all_submissions = copy.copy(self.asset._deployment_data['submissions'])
        instance_ids = payload.pop('submission_ids')

        responses = []
        for submission in all_submissions:
            if submission['_id'] in instance_ids:
                _uuid = uuid.uuid4()
                submission['deprecatedID'] = submission['instanceID']
                submission['instanceID'] = f'uuid:{_uuid}'
                for k, v in payload['data'].items():
                    submission[k] = v
                responses.append(
                    {
                        'uuid': _uuid,
                        'response': {},
                    }
                )

        return self.__prepare_bulk_update_response(responses)

    def set_has_kpi_hooks(self):
        """
        Store results in self.asset._deployment_data
        """
        has_active_hooks = self.asset.has_active_hooks
        self.store_data({
            "has_kpi_hooks": has_active_hooks,
        })

    def calculated_submission_count(self, requesting_user_id, **kwargs):
        params = self.validate_submission_list_params(requesting_user_id,
                                                      validate_count=True,
                                                      **kwargs)
        instances = self.get_submissions(requesting_user_id, **params)
        return len(instances)
