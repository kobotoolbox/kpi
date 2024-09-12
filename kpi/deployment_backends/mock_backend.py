from __future__ import annotations

import io
import os
from typing import Optional
from uuid import uuid4

from defusedxml import ElementTree as DET
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.utils.dateparse import parse_datetime

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.exceptions import InstanceIdMissingError
from kobo.apps.openrosa.libs.utils.logger_tools import (
    dict2xform,
    create_instance,
)
from kpi.constants import PERM_ADD_SUBMISSIONS, SUBMISSION_FORMAT_TYPE_JSON
from kpi.tests.utils.dicts import nested_dict_from_keys
from .openrosa_backend import OpenRosaDeploymentBackend
from ..utils.files import ExtendedContentFile


class MockDeploymentBackend(OpenRosaDeploymentBackend):

    @property
    def enketo_id(self):
        return 'self'

    def get_enketo_survey_links(self):
        return {
            'offline_url': f'https://example.org/_/#{self.enketo_id}',
            'url': f'https://example.org/::#{self.enketo_id}',
            'iframe_url': f'https://example.org/i/::#{self.enketo_id}',
            'preview_url': f'https://example.org/preview/::#{self.enketo_id}',
        }

    def get_submissions(
        self,
        user: settings.AUTH_USER_MODEL,
        format_type: str = SUBMISSION_FORMAT_TYPE_JSON,
        submission_ids: list = None,
        request: Optional['rest_framework.request.Request'] = None,
        **mongo_query_params
    ) -> list:
        # Overload parent to cast generator to a list. Many tests are expecting
        # a list
        return list(super().get_submissions(
            user, format_type, submission_ids, request, **mongo_query_params
        ))

    def mock_submissions(
        self, submissions, create_uuids: bool = True
    ):
        """
        Simulate client (i.e.: Enketo or Collect) data submission.

        Read test data and convert it to proper XML to be saved as a real
        Instance object.
        """

        class FakeRequest:
            pass

        request = FakeRequest()
        owner_username = self.asset.owner.username

        for submission in submissions:
            sub_copy = nested_dict_from_keys(submission)

            if create_uuids:
                if 'formhub/uuid' not in submission:
                    sub_copy['formhub'] = {'uuid': self.xform.uuid}

                if 'meta/instanceID' not in submission:
                    try:
                        uuid_ = submission['_uuid']
                    except KeyError:
                        uuid_ = str(uuid4())
                else:
                    uuid_ = submission['meta/instanceID'].replace('uuid:', '')

                sub_copy['meta'] = {'instanceID':  f'uuid:{uuid_}'}
                submission['_uuid'] = uuid_

            assign_perm = False
            try:
                submitted_by = sub_copy['_submitted_by']
            except KeyError:
                request.user = self.asset.owner
                submitted_by = self.asset.owner.username
            else:
                if not submitted_by:
                    request.user = AnonymousUser()
                    submitted_by = ''
                elif owner_username != submitted_by:
                    request.user = User.objects.get(username=submitted_by)
                else:
                    request.user = self.asset.owner

                if not self.asset.has_perm(request.user, PERM_ADD_SUBMISSIONS):
                    # We want `request.user` to be able to add submissions
                    # (temporarily) to match `_submitted_by` value while saving
                    # in DB
                    self.asset.assign_perm(request.user, PERM_ADD_SUBMISSIONS)
                    assign_perm = True

            media_files = self._get_media_files(sub_copy)

            xml_string = dict2xform(sub_copy, self.xform.id_string)
            xml_file = io.StringIO(xml_string)

            instance = create_instance(
                owner_username,
                xml_file,
                media_files,
                date_created_override=parse_datetime(
                    submission.get('_submission_time', '')  # Returns None if empty
                ),
                request=request,
            )

            # Inject (or update) real PKs in submission…
            submission['_id'] = instance.pk

            # … and attachments
            if '_attachments' in submission:
                for idx, attachment in enumerate(instance.attachments.all()):
                    submission['_attachments'][idx]['id'] = attachment.pk

            if assign_perm:
                self.asset.remove_perm(request.user, PERM_ADD_SUBMISSIONS)

    def set_namespace(self, namespace):
        self.store_data(
            {
                'namespace': namespace,
            }
        )

    @property
    def _backend_identifier(self):
        return 'mock'

    def _get_media_files(self, submission):

        try:
            attachments = submission['_attachments']
        except KeyError:
            return []

        for attachment in attachments:
            filename = attachment['filename']

            if filename == 'path/to/image.png':
                continue

            basename = os.path.basename(filename)
            file_ = os.path.join(
                settings.BASE_DIR,
                'kpi',
                'fixtures',
                'attachments',
                basename
            )
            if not os.path.isfile(file_):
                raise Exception(
                    f'File `filename` does not exist! Use `path/to/image.png` if'
                    f' you need a fake attachment, or use one of file names '
                    f'inside `kpi/fixtures/attachments for real attachment'
                )

            with open(file_, 'rb') as f:
                yield ExtendedContentFile(f.read(), name=basename)
