# coding: utf-8
import os

from django.core.files.base import ContentFile
from django.urls import reverse

from kobo.apps.openrosa import koboform
from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.openrosa.apps.logger.views import (
    download_xlsform,
    download_jsonform,
)
from kobo.apps.openrosa.libs.utils.logger_tools import publish_xml_form
from kobo.apps.openrosa.libs.utils.user_auth import http_auth_string
from .test_base import TestBase


class TestFormShow(TestBase):

    def setUp(self):
        TestBase.setUp(self)
        self._create_user_and_login()
        self._publish_transportation_form()

    def test_dl_xlsx_xlsform(self):
        self._publish_xlsx_file()
        response = self.client.get(reverse(download_xlsform, kwargs={
            'username': self.user.username,
            'id_string': 'exp_one'
        }))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response['Content-Disposition'],
            "attachment; filename=exp_one.xlsx")

    def test_dl_xls_redirect_to_login_to_anon_if_public(self):
        self.xform.shared = True
        self.xform.save()
        response = self.anon.get(reverse(download_xlsform, kwargs={
            'username': self.user.username,
            'id_string': self.xform.id_string
        }))

        redirect_to = koboform.login_url()
        self.assertEqual(response.url, redirect_to)
        self.assertEqual(response.status_code, 302)

    def test_dl_xls_for_basic_auth(self):
        extra = {
            'HTTP_AUTHORIZATION':
            http_auth_string(self.login_username, self.login_password)
        }
        response = self.anon.get(reverse(download_xlsform, kwargs={
            'username': self.user.username,
            'id_string': self.xform.id_string
        }), **extra)
        self.assertEqual(response.status_code, 200)

    def test_dl_json_to_anon_if_public(self):
        self.xform.shared = True
        self.xform.save()
        response = self.anon.get(reverse(download_jsonform, kwargs={
            'username': self.user.username,
            'id_string': self.xform.id_string
        }))
        self.assertEqual(response.status_code, 200)

    def test_dl_jsonp_to_anon_if_public(self):
        self.xform.shared = True
        self.xform.save()
        callback = 'jsonpCallback'
        response = self.anon.get(reverse(download_jsonform, kwargs={
            'username': self.user.username,
            'id_string': self.xform.id_string
        }), {'callback': callback})
        self.assertEqual(response.status_code, 200)
        content = response.content.decode()
        self.assertEqual(content.startswith(callback + '('), True)
        self.assertEqual(content.endswith(')'), True)

    def test_dl_json_for_basic_auth(self):
        extra = {
            'HTTP_AUTHORIZATION':
            http_auth_string(self.login_username, self.login_password)
        }
        response = self.anon.get(reverse(download_jsonform, kwargs={
            'username': self.user.username,
            'id_string': self.xform.id_string
        }), **extra)
        self.assertEqual(response.status_code, 200)

    def test_dl_json_for_cors_options(self):
        response = self.anon.options(reverse(download_jsonform, kwargs={
            'username': self.user.username,
            'id_string': self.xform.id_string
        }))
        allowed_headers = ['Accept', 'Origin', 'X-Requested-With',
                           'Authorization']
        control_headers = response['Access-Control-Allow-Headers']
        provided_headers = [h.strip() for h in control_headers.split(',')]
        self.assertListEqual(allowed_headers, provided_headers)
        self.assertEqual(response['Access-Control-Allow-Methods'], 'GET')
        self.assertEqual(response['Access-Control-Allow-Origin'], '*')

    def test_publish_xml_xlsform_download(self):
        count = XForm.objects.count()
        path = os.path.join(
            self.this_directory,
            '..',
            '..',
            'api',
            'tests',
            'fixtures',
            'forms',
            'contributions',
            'contributions.xml',
        )
        f = open(path, 'rb')
        xml_file = ContentFile(f.read())
        f.close()
        xml_file.name = 'contributions.xml'
        self.xform = publish_xml_form(xml_file, self.user)
        self.assertTrue(XForm.objects.count() > count)
        response = self.client.get(reverse(download_xlsform, kwargs={
            'username': self.user.username,
            'id_string': 'contributions'
        }))
        self.assertContains(
            response, 'No XLS file for your form ', status_code=404
        )
