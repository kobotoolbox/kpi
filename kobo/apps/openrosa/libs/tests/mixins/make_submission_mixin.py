# coding: utf-8
import os
import re
import uuid
from tempfile import NamedTemporaryFile
from typing import Union

from django.contrib.auth import authenticate
from django_digest.test import DigestAuth
from rest_framework import status
from rest_framework.test import APIRequestFactory

from kobo.apps.openrosa.apps.api.viewsets.xform_submission_api import XFormSubmissionApi
from kobo.apps.openrosa.apps.logger.models import Instance, XForm
from kobo.apps.openrosa.libs.utils.logger_tools import safe_create_instance


class MakeSubmissionMixin:

    @property
    def submission_view(self):
        if not hasattr(self, '_submission_view'):
            setattr(
                self,
                '_submission_view',
                XFormSubmissionApi.as_view({'head': 'create', 'post': 'create'}),
            )
        return self._submission_view

    def _add_uuid_to_submission_xml(self, path, xform):
        with open(path, 'rb') as _file:
            split_xml = re.split(r'(<transport>)', _file.read().decode())

        split_xml.insert(1, f'<formhub><uuid>{xform.uuid}</uuid></formhub>')

        with NamedTemporaryFile(delete=False, mode='w') as tmp_file:
            tmp_file.write(''.join(split_xml))
            path = tmp_file.name

        return path

    def _add_submission_uuid_to_submission_xml(self, path):
        with open(path, 'rb') as _file:
            xml_content = _file.read().decode()

        # Find the closing tag of the root element (e.g., </new_repeats>)
        closing_tag_index = xml_content.rfind(f'</{self.xform.id_string}>')

        if closing_tag_index == -1:
            raise ValueError('Root element closing tag not found')

        # Construct the meta element with a new UUID
        meta_element = f'<meta><instanceID>uuid:{str(uuid.uuid4())}</instanceID></meta>'

        # Insert the meta element before the closing tag of the root element
        xml_content = (
            xml_content[:closing_tag_index]
            + meta_element  # noqa: W503
            + xml_content[closing_tag_index:]   # noqa: W503
        )

        # Write the updated XML content to a temporary file and return the path
        with NamedTemporaryFile(delete=False, mode='w') as tmp_file:
            tmp_file.write(xml_content)
            path = tmp_file.name

        return path

    def _make_submission(
        self,
        path: str,
        username: str = None,
        add_uuid: bool = False,
        forced_submission_time: bool = None,
        auth: Union[DigestAuth, bool] = None,
        media_file: 'io.BufferedReader' = None,
        assert_success: bool = True,
        use_api: bool = True,
    ):
        """
        Pass `auth=False` for an anonymous request, or omit `auth` to perform
        the submission as 'bob'.

        if `use_api` is False, it adds submission directly without POSTing to
        the API. It is useful for edits which are not allowed anymore through
        the API.
        """
        if add_uuid:
            path = self._add_uuid_to_submission_xml(path, self.xform)

        if not use_api:

            class FakeRequest:
                pass

            request = FakeRequest()
            request.user = self.user

            with open(path, 'rb') as xml_submission_file:

                error, instance = safe_create_instance(
                    username=username,
                    xml_file=xml_submission_file,
                    media_files=[media_file],
                    request=request,
                )

            if assert_success:
                assert error is None and isinstance(instance, Instance)

        else:

            # store temporary file with dynamic uuid
            self.factory = APIRequestFactory()

            if auth is None:
                auth = DigestAuth('bob', 'bob')

            with open(path, 'rb') as f:
                post_data = {'xml_submission_file': f}

                if media_file is not None:
                    post_data['media_file'] = media_file

                if username is None:
                    username = self.user.username

                url_prefix = f'{username}/' if username else ''
                url = f'/{url_prefix}submission'
                request = self.factory.post(url, post_data)
                if auth:
                    request.user = authenticate(
                        username=auth.username, password=auth.password
                    )
                self.response = None  # Reset in case error in viewset below
                self.response = self.submission_view(request, username=username)

                if auth and self.response.status_code == 401:
                    f.seek(0)
                    if media_file is not None:
                        media_file.seek(0)

                    request = self.factory.post(url, post_data)
                    request.META.update(auth(request.META, self.response))
                    self.response = self.submission_view(request, username=username)

                if assert_success:
                    assert self.response.status_code in [
                        status.HTTP_200_OK,
                        status.HTTP_201_CREATED,
                        status.HTTP_202_ACCEPTED,
                    ]

        if forced_submission_time:
            instance = Instance.objects.order_by('-pk').all()[0]
            instance.date_created = forced_submission_time
            instance.save()
            instance.parsed_instance.save()

        # remove temporary file if stored
        if add_uuid:
            os.unlink(path)

    def _make_submission_w_attachment(self, path, attachment_path):

        with open(attachment_path, 'rb') as media_file:
            self._make_submission(path, self.user.username, media_file=media_file)

    def _make_submissions(
        self,
        username: str = None,
        auth: DigestAuth = None,
        module_directory: str = None,
    ):
        """
        Make test fixture submissions to current xform.

        Submissions are saved under `username` if provided.
        By default, user "bob" is used to submit data, other credentials can be
        used by providing a different authentication `auth`.
        Module directory can also be specified to use fixtures from another
        directory than the default one (main app)
        """

        if not module_directory:
            module_directory = self.this_directory

        paths = [os.path.join(
            module_directory, 'fixtures', 'transportation',
            'instances', s, s + '.xml') for s in self.surveys]

        for path in paths:
            self._make_submission(path, username, auth=auth)

        post_count = len(self.surveys)

        self.assertEqual(Instance.objects.count(), post_count)
        self.assertEqual(self.xform.instances.count(), post_count)
        xform = XForm.objects.get(pk=self.xform.pk)
        self.assertEqual(xform.num_of_submissions, post_count)
        self.assertEqual(xform.user.profile.num_of_submissions, post_count)
