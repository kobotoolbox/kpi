# coding: utf-8
import os.path
from io import BytesIO

import requests
from django.contrib.auth import authenticate
from django.core.files.uploadedfile import UploadedFile
from django.test import RequestFactory
from django_digest.test import Client as DigestClient
from httmock import urlmatch, HTTMock

from kobo.apps.openrosa.apps.api.viewsets.xform_list_api import XFormListApi
from kobo.apps.openrosa.apps.logger.models import Instance, XForm
from kobo.apps.openrosa.apps.main.models import MetaData
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.libs.utils.briefcase_client import BriefcaseClient
from kobo.apps.openrosa.libs.utils.storage import rmdir
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as storage,
)


def formList(*args, **kwargs):  # noqa
    view = XFormListApi.as_view({'get': 'list'})
    response = view(*args, **kwargs)
    response.render()
    return response

def xformsDownload(*args, **kwargs):  # noqa
    view = XFormListApi.as_view({'get': 'retrieve'})
    response = view(*args, **kwargs)
    response.render()
    return response

def xformsManifest(*args, **kwargs):  # noqa
    view = XFormListApi.as_view({'get': 'manifest'})
    response = view(*args, **kwargs)
    response.render()
    return response

def xformsMedia(*args, **kwargs):  # noqa
    view = XFormListApi.as_view({'get': 'media'})
    response = view(*args, **kwargs)
    return response


@urlmatch(netloc=r'(.*\.)?testserver$')
def form_list_xml(url, request, **kwargs):
    response = requests.Response()
    factory = RequestFactory()
    req = factory.get(url.path)
    req.user = authenticate(username='bob', password='bob')
    id_string = 'transportation_2011_07_25'
    # Retrieve XForm pk for user bob.
    # SQLite resets PK to 1 every time the table is truncated (i.e. after
    # each test is over) whereas PostgreSQL keeps the last sequence value
    # which makes `xform_id` differ all the time.
    xform_id = (
        XForm.objects.values_list('id', flat=True)
        .filter(user__username='bob')
        .last()
    )
    if url.path.endswith('formList'):
        res = formList(req)
    elif url.path.endswith('form.xml'):
        res = xformsDownload(req, pk=xform_id)
    elif url.path.find('xformsManifest') > -1:
        res = xformsManifest(req, pk=xform_id)
    elif url.path.find('xformsMedia') > -1:
        filename = url.path[url.path.rfind('/') + 1:]
        metadata_id, _ = os.path.splitext(filename)
        res = xformsMedia(
            req, pk=xform_id, metadata=metadata_id
        )
        response._content = get_streaming_content(res)
    else:
        res = formList(req)
    response.status_code = 200
    if not response._content:
        response._content = res.content
    return response


def get_streaming_content(res):
    tmp = BytesIO()
    for chunk in res.streaming_content:
        tmp.write(chunk)
    content = tmp.getvalue()
    tmp.close()
    return content


@urlmatch(netloc=r'(.*\.)?testserver$')
def instances_xml(url, request, **kwargs):
    response = requests.Response()
    client = DigestClient()
    client.set_authorization('bob', 'bob', 'Digest')
    res = client.get('%s?%s' % (url.path, url.query))
    if res.status_code == 302:
        res = client.get(res['Location'])
        response.encoding = res.get('content-type')
        response._content = get_streaming_content(res)
    else:
        response._content = res.content
    response.status_code = 200
    return response


class TestBriefcaseClient(TestBase):

    def setUp(self):
        TestBase.setUp(self)
        self._publish_transportation_form()
        self._submit_transport_instance_w_attachment()
        src = os.path.join(self.this_directory, "fixtures",
                           "transportation", "screenshot.png")
        uf = UploadedFile(file=open(src, 'rb'), content_type='image/png')
        count = MetaData.objects.count()
        MetaData.media_upload(self.xform, uf)
        self.assertEqual(MetaData.objects.count(), count + 1)
        self._logout()
        self._create_user_and_login('deno', 'deno')

        self.bc = BriefcaseClient(
            username='bob', password='bob',
            url=self.base_url,
            user=self.user
        )

    def test_download_xform_xml(self):
        """
        Download xform via briefcase api
        """
        with HTTMock(form_list_xml):
            self.bc.download_xforms()

        is_local = storage.__class__.__name__ == 'FileSystemStorage'

        forms_folder_path = os.path.join('deno',
                                         'briefcase',
                                         'forms',
                                         self.xform.id_string)
        forms_path = os.path.join(forms_folder_path,
                                  '%s.xml' % self.xform.id_string)
        form_media_path = os.path.join(forms_folder_path, 'form-media')
        media_path = os.path.join(form_media_path, 'screenshot.png')

        if is_local:
            does_root_folder_exist = storage.exists(forms_folder_path)
            does_media_folder_exist = storage.exists(form_media_path)
        else:
            # `django-storage.exists()` does not work with folders on AWS
            sub_folders, files = storage.listdir(forms_folder_path)
            does_root_folder_exist = bool(sub_folders or files)
            does_media_folder_exist = 'form-media' in sub_folders

        self.assertTrue(does_root_folder_exist)
        self.assertTrue(storage.exists(forms_path))
        self.assertTrue(does_media_folder_exist)
        self.assertTrue(storage.exists(media_path))

        """
        Download instance xml
        """
        with HTTMock(instances_xml):
            self.bc.download_instances(self.xform.id_string)

        instance_folder_path = os.path.join(forms_folder_path, 'instances')
        if is_local:
            does_instances_folder_exist = storage.exists(instance_folder_path)
        else:
            sub_folders, _ = storage.listdir(forms_folder_path)
            does_instances_folder_exist = 'instances' in sub_folders

        self.assertTrue(does_instances_folder_exist)

        instance = Instance.objects.all()[0]
        instance_path = os.path.join(
            instance_folder_path, 'uuid%s' % instance.uuid, 'submission.xml')
        self.assertTrue(storage.exists(instance_path))
        media_file = "1335783522563.jpg"
        media_path = os.path.join(
            instance_folder_path, 'uuid%s' % instance.uuid, media_file)
        self.assertTrue(storage.exists(media_path))

    def test_push(self):
        with HTTMock(form_list_xml):
            self.bc.download_xforms()
        with HTTMock(instances_xml):
            self.bc.download_instances(self.xform.id_string)

        XForm.objects.all().delete()
        xforms = XForm.objects.filter(
            user=self.user, id_string=self.xform.id_string)
        self.assertTrue(xforms.count() == 0)
        instances = Instance.objects.filter(
            xform__user=self.user, xform__id_string=self.xform.id_string)
        self.assertTrue(instances.count() == 0)
        self.bc.push()
        xforms = XForm.objects.filter(
            user=self.user, id_string=self.xform.id_string)
        self.assertTrue(xforms.count() == 1)
        instances = Instance.objects.filter(
            xform__user=self.user, xform__id_string=self.xform.id_string)
        self.assertTrue(instances.count() == 1)

    def tearDown(self):
        # remove media files
        for username in ['bob', 'deno']:
            rmdir(username)
