import os
import re

from ddt import data, ddt
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.utils.http import urlencode
from django_digest.test import DigestAuth
from rest_framework import status
from rest_framework.reverse import reverse

from kobo.apps.data_collectors.models import DataCollector, DataCollectorGroup
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.api.tests.viewsets.test_abstract_viewset import (
    TestAbstractViewSet,
)
from kobo.apps.openrosa.apps.api.viewsets.xform_list_api import XFormListApi
from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.openrosa.libs.permissions import assign_perm
from kobo.apps.organizations.models import Organization
from kpi.constants import PERM_ADD_SUBMISSIONS, PERM_MANAGE_ASSET, PERM_VIEW_ASSET
from kpi.models import Asset

EMPTY_LIST_CONTENT = '<?xml version="1.0" encoding="utf-8"?>\n<xforms xmlns="http://openrosa.org/xforms/xformsList"></xforms>'  # noqa


class TestXFormListApiBase(TestAbstractViewSet):

    def setUp(self):
        super().setUp()
        self.view = XFormListApi.as_view({
            'get': 'list'
        })
        self.publish_xls_form()

    def _load_metadata(self, xform=None):
        data_value = 'screenshot.png'
        data_type = 'media'
        fixture_dir = os.path.join(
            settings.OPENROSA_APP_DIR,
            'apps',
            'main',
            'tests',
            'fixtures',
            'transportation',
        )
        path = os.path.join(fixture_dir, data_value)
        xform = xform or self.xform

        self._add_form_metadata(xform, data_type, data_value, path)


class TestXFormListApiWithoutAuthRequired(TestXFormListApiBase):

    """
    Tests should point to `https://kc/<username>/*`

    Since May 2025 (version 2.025.02i), retrieving XForms that allow anonymous
    submissions no longer depends solely on the username provided in the URL. Instead,
    it requires that the user matching the given username also has the `manage_asset`
    permission in KPI.

    Previously, OpenRosa was agnostic to KPI assets, but this change introduces
    a tighter integration between form access and KPI permissions.

    To reflect this behaviour correctly, this test class now relies on the full KPI
    asset deployment mechanism (added in `setUp`) to ensure that the expected
    permissions are applied, and the tests remain valid.
    """

    def setUp(self):
        super().setUp()
        self.xform_without_auth = self.xform
        self.xform_without_auth.require_auth = False
        self.xform_without_auth.save(update_fields=['require_auth'])

        data = {
            'owner': self.user.username,
            'public': False,
            'public_data': False,
            'description': 'transportation_with_attachment',
            'downloadable': True,
            'encrypted': False,
            'id_string': 'transportation_with_attachment',
            'title': 'transportation_with_attachment',
        }

        path = os.path.join(
            settings.OPENROSA_APP_DIR,
            'apps',
            'main',
            'tests',
            'fixtures',
            'transportation',
            'transportation_with_attachment.xls',
        )
        self.publish_xls_form(data=data, path=path)
        self.assertNotEqual(self.xform.pk, self.xform_without_auth.pk)
        self.assertEqual(XForm.objects.all().count(), 2)
        self.assertEqual(XForm.objects.filter(require_auth=False).count(), 1)

    def test_anonymous_xform_list_excludes_forms_of_inactive_users(self):
        request = self.factory.get('/')
        response = self.view(request, username=self.user.username)
        assert response.status_code == status.HTTP_200_OK
        assert response.data[0]['formID'] == 'transportation_2011_07_25'

        self.user.is_active = False
        self.user.save()
        request = self.factory.get('/')
        response = self.view(request, username=self.user.username)
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_get_xform_list_as_anonymous_user(self):

        request = self.factory.get('/')
        response = self.view(request, username=self.user.username)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        path = os.path.join(
            os.path.dirname(__file__), '..', 'fixtures', 'formList.xml'
        )
        # Response should contain only xform
        with open(path, 'r') as f:
            form_list_xml = f.read().strip()
            data = {
                'hash': self.xform_without_auth.md5_hash,
                'pk': self.xform_without_auth.pk,
            }
            content = response.render().content
            self.assertEqual(content.decode(), form_list_xml % data)
            self.assertTrue(response.has_header('X-OpenRosa-Version'))
            self.assertTrue(response.has_header('X-OpenRosa-Accept-Content-Length'))
            self.assertTrue(response.has_header('Date'))
            self.assertEqual(response['Content-Type'], 'text/xml; charset=utf-8')

    def test_get_xform_list_as_owner(self):

        """
        Same test as `test_get_xform_list_as_anonymous_user()` except
        we want the user to be authenticated right away. Do not use Digest, but
        session auth.
        User should only see their projects that allow data submission without
        authentication (like anonymous user)
        """

        # Use session auth
        response = self.client.get(
            reverse('form-list', kwargs={'username': self.user.username})
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        path = os.path.join(
            os.path.dirname(__file__), '..', 'fixtures', 'formList.xml'
        )
        # Response should contain only xform
        with open(path, 'r') as f:
            form_list_xml = f.read().strip()
            data = {
                'hash': self.xform_without_auth.md5_hash,
                'pk': self.xform_without_auth.pk,
            }
            content = response.render().content
            self.assertEqual(content.decode(), form_list_xml % data)
            self.assertTrue(response.has_header('X-OpenRosa-Version'))
            self.assertTrue(response.has_header('X-OpenRosa-Accept-Content-Length'))
            self.assertTrue(response.has_header('Date'))
            self.assertEqual(response['Content-Type'], 'text/xml; charset=utf-8')

    def test_retrieve_xform_manifest_as_owner(self):

        self._load_metadata(self.xform_without_auth)
        self.view = XFormListApi.as_view({
            'get': 'manifest'
        })
        request = self.factory.get('/')
        response = self.view(request, pk=self.xform_without_auth.pk)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        response = self.view(
            request, pk=self.xform_without_auth.pk, username=self.user.username
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        manifest_xml = (
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<manifest xmlns="http://openrosa.org/xforms/xformsManifest">'
            '   <mediaFile>'
            '        <filename>screenshot.png</filename>'
            '        <hash>%(hash)s</hash>'
            '        <downloadUrl>http://testserver/bob/xformsMedia/%(xform)s/%(pk)s.png</downloadUrl>'
            '    </mediaFile>'
            '</manifest>'
        )

        manifest_xml = re.sub(r'> +<', '><', manifest_xml).strip()

        data = {
            'hash': self.metadata.md5_hash,
            'pk': self.metadata.pk,
            'xform': self.xform_without_auth.pk,
        }

        content = response.render().content.decode().strip()
        self.assertEqual(content, manifest_xml % data)
        self.assertTrue(response.has_header('X-OpenRosa-Version'))
        self.assertTrue(
            response.has_header('X-OpenRosa-Accept-Content-Length'))
        self.assertTrue(response.has_header('Date'))
        self.assertEqual(response['Content-Type'], 'text/xml; charset=utf-8')

    def test_retrieve_xform_media_as_anonymous_user(self):

        self._load_metadata(self.xform_without_auth)
        self.view = XFormListApi.as_view({
            'get': 'media'
        })
        request = self.factory.get('/')
        response = self.view(
            request,
            pk=self.xform_without_auth.pk,
            metadata=self.metadata.pk,
            format='png',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response = self.view(
            request,
            pk=self.xform_without_auth.pk,
            username=self.user.username,
            metadata=self.metadata.pk,
            format='png',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_get_manager_xform_list_as_anonymous_user(self):

        manager = User.objects.create_user(username='manager', password='manager')
        asset = Asset.objects.create(
            content={'survey': [{'type': 'text', 'label': 'q1'}]},
            owner=self.user,
        )
        asset.deploy(active=True, backend='mock')
        # Allow anonymous user to submit data
        asset.assign_perm(AnonymousUser(), PERM_ADD_SUBMISSIONS)

        # Retrieve manager's formList as an anonymous user, no XForms should be present
        response = self.client.get(reverse('form-list', kwargs={'username': 'manager'}))
        assert response.status_code == status.HTTP_200_OK

        expected_empty_xforms_list = (
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<xforms xmlns="http://openrosa.org/xforms/xformsList"></xforms>'
        )
        assert response.content.decode() == expected_empty_xforms_list

        # Give "manager" the permission to manage the project
        asset.assign_perm(manager, PERM_MANAGE_ASSET)

        # Retrieve manager's formList as an anonymous user
        response = self.client.get(reverse('form-list', kwargs={'username': 'manager'}))
        xml_response = response.content.decode()
        # Make sure, there is only one XForm in response
        assert xml_response.count('<formID>') == 1
        assert f'<formID>{asset.uid}</formID>' in xml_response

        # Retrieve owner's formList as an anonymous user, just to validate the response
        # is different
        response = self.client.get(reverse('form-list', kwargs={'username': 'bob'}))
        xml_response = response.content.decode()
        # Make sure all bob's projects are present in formList
        assert xml_response.count('<formID>') == 2
        assert f'<formID>{asset.uid}</formID>' in xml_response


class TestXFormListApiWithAuthRequired(TestXFormListApiBase):

    """
    Tests should point to `https://kc/*`
    """

    def test_authenticated_xform_list_excludes_forms_of_inactive_users(self):
        request = self.factory.get('/')
        response = self.view(request)
        alice_data = {
            'username': 'alice',
            'password1': 'alicealice',
            'password2': 'alicealice',
            'email': 'alice@localhost.com',
        }
        alice_profile = self._create_user_profile(alice_data)
        assign_perm(PERM_ADD_SUBMISSIONS, alice_profile.user, self.xform.asset)
        auth = DigestAuth('alice', 'alicealice')
        request.META.update(auth(request.META, response))
        response = self.view(request)
        assert response.status_code == status.HTTP_200_OK
        assert response.data[0]['formID'] == 'transportation_2011_07_25'

        self.user.is_active = False
        self.user.save()
        response = self.view(request)
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_head_xform_list(self):
        request = self.factory.head('/')
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        auth = DigestAuth('bob', 'bobbob')
        request.META.update(auth(request.META, response))
        response = self.view(request)
        self.validate_openrosa_head_response(response)

    def test_get_xform_list(self):
        request = self.factory.get('/')
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        auth = DigestAuth('bob', 'bobbob')
        request.META.update(auth(request.META, response))
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        path = os.path.join(
            os.path.dirname(__file__),
            '..',
            'fixtures',
            'formList_w_require_auth.xml',
        )

        with open(path, 'r') as f:
            form_list_xml = f.read().strip()
            data = {'hash': self.xform.md5_hash, 'pk': self.xform.pk}
            content = response.render().content
            self.assertEqual(content.decode(), form_list_xml % data)
            self.assertTrue(response.has_header('X-OpenRosa-Version'))
            self.assertTrue(
                response.has_header('X-OpenRosa-Accept-Content-Length'))
            self.assertTrue(response.has_header('Date'))
            self.assertEqual(response['Content-Type'],
                             'text/xml; charset=utf-8')

    def test_get_xform_list_inactive_form(self):
        self.xform.downloadable = False
        self.xform.save()
        request = self.factory.get('/')
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        auth = DigestAuth('bob', 'bobbob')
        request.META.update(auth(request.META, response))
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        xml = '<?xml version="1.0" encoding="utf-8"?>\n<xforms '
        xml += 'xmlns="http://openrosa.org/xforms/xformsList"></xforms>'
        content = response.render().content.decode()
        self.assertEqual(content, xml)
        self.assertTrue(response.has_header('X-OpenRosa-Version'))
        self.assertTrue(
            response.has_header('X-OpenRosa-Accept-Content-Length'))
        self.assertTrue(response.has_header('Date'))
        self.assertEqual(response['Content-Type'],
                         'text/xml; charset=utf-8')

    def test_get_xform_list_as_anonymous_user(self):
        request = self.factory.get('/')
        # Get formList without username requires auth unconditionally
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_xform_list_other_user_with_no_role(self):
        request = self.factory.get('/')
        response = self.view(request)
        alice_data = {
            'username': 'alice',
            'password1': 'alicealice',
            'password2': 'alicealice',
            'email': 'alice@localhost.com',
        }
        alice_profile = self._create_user_profile(alice_data)

        self.assertFalse(
            alice_profile.user.has_perms([PERM_VIEW_ASSET], self.xform.asset)
        )

        auth = DigestAuth('alice', 'alicealice')
        request.META.update(auth(request.META, response))
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        content = response.render().content.decode()
        self.assertNotIn(self.xform.id_string, content)
        self.assertEqual(
            content, '<?xml version="1.0" encoding="utf-8"?>\n<xforms '
            'xmlns="http://openrosa.org/xforms/xformsList"></xforms>')
        self.assertTrue(response.has_header('X-OpenRosa-Version'))
        self.assertTrue(
            response.has_header('X-OpenRosa-Accept-Content-Length'))
        self.assertTrue(response.has_header('Date'))
        self.assertEqual(response['Content-Type'], 'text/xml; charset=utf-8')

    def test_get_xform_list_other_user_with_readonly_role(self):
        request = self.factory.get('/')
        response = self.view(request)
        alice_data = {
            'username': 'alice',
            'password1': 'alicealice',
            'password2': 'alicealice',
            'email': 'alice@localhost.com',
        }
        alice_profile = self._create_user_profile(alice_data)

        assign_perm(PERM_VIEW_ASSET, alice_profile.user, self.xform.asset)
        self.assertTrue(
            alice_profile.user.has_perms([PERM_VIEW_ASSET], self.xform.asset)
        )

        auth = DigestAuth('alice', 'alicealice')
        request.META.update(auth(request.META, response))
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        content = response.render().content.decode()
        self.assertNotIn(self.xform.id_string, content)
        self.assertEqual(
            content, '<?xml version="1.0" encoding="utf-8"?>\n<xforms '
            'xmlns="http://openrosa.org/xforms/xformsList"></xforms>')
        self.assertTrue(response.has_header('X-OpenRosa-Version'))
        self.assertTrue(
            response.has_header('X-OpenRosa-Accept-Content-Length'))
        self.assertTrue(response.has_header('Date'))
        self.assertEqual(response['Content-Type'], 'text/xml; charset=utf-8')

    def test_get_xform_list_other_user_with_dataentry_role(self):
        request = self.factory.get('/')
        response = self.view(request)
        alice_data = {
            'username': 'alice',
            'password1': 'alicealice',
            'password2': 'alicealice',
            'email': 'alice@localhost.com',
        }
        alice_profile = self._create_user_profile(alice_data)

        assign_perm(PERM_ADD_SUBMISSIONS, alice_profile.user, self.xform.asset)
        self.assertTrue(
            alice_profile.user.has_perms([PERM_ADD_SUBMISSIONS], self.xform.asset)
        )

        auth = DigestAuth('alice', 'alicealice')
        request.META.update(auth(request.META, response))
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        path = os.path.join(
            os.path.dirname(__file__),
            '..',
            'fixtures',
            'formList_w_require_auth.xml',
        )

        with open(path, 'r') as f:
            form_list_xml = f.read().strip()
            data = {'hash': self.xform.md5_hash, 'pk': self.xform.pk}
            content = response.render().content
            self.assertEqual(content.decode(), form_list_xml % data)
            self.assertTrue(response.has_header('X-OpenRosa-Version'))
            self.assertTrue(
                response.has_header('X-OpenRosa-Accept-Content-Length'))
            self.assertTrue(response.has_header('Date'))
            self.assertEqual(response['Content-Type'],
                             'text/xml; charset=utf-8')

    def test_get_xform_list_with_formid_parameter(self):
        """
        Test `formList` with `?formID=[id_string]` filter
        """
        # Test unrecognized `formID`
        request = self.factory.get('/', {'formID': 'unrecognizedID'})
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        auth = DigestAuth('bob', 'bobbob')
        request.META.update(auth(request.META, response))
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

        # Test a valid `formID`
        request = self.factory.get('/', {'formID': self.xform.id_string})
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        auth = DigestAuth('bob', 'bobbob')
        request.META.update(auth(request.META, response))
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        path = os.path.join(
            os.path.dirname(__file__),
            '..',
            'fixtures',
            'formList_w_require_auth.xml',
        )

        with open(path) as f:
            form_list_xml = f.read().strip()
            data = {'hash': self.xform.md5_hash, 'pk': self.xform.pk}
            content = response.render().content.decode()
            self.assertEqual(content, form_list_xml % data)

    def test_retrieve_xform_xml(self):
        self.view = XFormListApi.as_view({
            'get': 'retrieve'
        })
        request = self.factory.head('/')
        response = self.view(request, pk=self.xform.pk)
        auth = DigestAuth('bob', 'bobbob')
        request = self.factory.get('/')
        request.META.update(auth(request.META, response))
        response = self.view(request, pk=self.xform.pk)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertEqual(response['Content-Type'],
                         'text/xml; charset=utf-8')
        self.assertTrue(response.has_header('X-OpenRosa-Version'))
        self.assertTrue(
            response.has_header('X-OpenRosa-Accept-Content-Length'))
        self.assertTrue(response.has_header('Date'))

        path = os.path.join(
            os.path.dirname(__file__),
            '..', 'fixtures', 'Transportation Form.xml')

        with open(path) as f:
            form_xml = f.read().strip()
            data = {'form_uuid': self.xform.uuid}
            content = response.render().content.decode().strip()
            self.assertEqual(content, form_xml % data)

    def test_retrieve_xform_manifest(self):
        self._load_metadata(self.xform)
        self.view = XFormListApi.as_view({
            'get': 'manifest'
        })
        request = self.factory.head('/')
        response = self.view(request, pk=self.xform.pk)
        auth = DigestAuth('bob', 'bobbob')
        request = self.factory.get('/')
        request.META.update(auth(request.META, response))
        response = self.view(request, pk=self.xform.pk)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        manifest_xml = (
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<manifest xmlns="http://openrosa.org/xforms/xformsManifest">'
            '   <mediaFile>'
            '        <filename>screenshot.png</filename>'
            '        <hash>%(hash)s</hash>'
            '        <downloadUrl>http://testserver/xformsMedia/%(xform)s/%(pk)s.png</downloadUrl>'
            '    </mediaFile>'
            '</manifest>'
        )

        manifest_xml = re.sub(r'> +<', '><', manifest_xml).strip()

        data = {
            'hash': self.metadata.md5_hash,
            'pk': self.metadata.pk,
            'xform': self.xform.pk,
        }
        content = response.render().content.decode().strip()
        self.assertEqual(content, manifest_xml % data)
        self.assertTrue(response.has_header('X-OpenRosa-Version'))
        self.assertTrue(
            response.has_header('X-OpenRosa-Accept-Content-Length'))
        self.assertTrue(response.has_header('Date'))
        self.assertEqual(response['Content-Type'], 'text/xml; charset=utf-8')

    def test_retrieve_xform_manifest_as_anonymous(self):
        self._load_metadata(self.xform)
        self.view = XFormListApi.as_view({
            'get': 'manifest'
        })
        request = self.factory.get('/')
        response = self.view(request, pk=self.xform.pk, username=self.user.username)
        # The project (self.xform) requires auth by default. Anonymous user cannot
        # access it. It is also true for the project manifest, thus anonymous
        # should receive a 404.
        # See `TestXFormListApiWithoutAuthRequired.test_retrieve_xform_manifest()`
        self.assertEqual(response.status_code, 404)

    def test_head_xform_manifest(self):
        self._load_metadata(self.xform)
        self.view = XFormListApi.as_view({
            'get': 'manifest'
        })
        request = self.factory.head('/')
        response = self.view(request, pk=self.xform.pk)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        auth = DigestAuth('bob', 'bobbob')
        request.META.update(auth(request.META, response))
        response = self.view(request, pk=self.xform.pk)
        self.validate_openrosa_head_response(response)

    def test_head_xform_media(self):
        self._load_metadata(self.xform)
        self.view = XFormListApi.as_view({
            'get': 'media'
        })
        request = self.factory.head('/')
        response = self.view(request, pk=self.xform.pk,
                             metadata=self.metadata.pk, format='png')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        auth = DigestAuth('bob', 'bobbob')
        request.META.update(auth(request.META, response))
        response = self.view(request, pk=self.xform.pk,
                             metadata=self.metadata.pk, format='png')
        self.validate_openrosa_head_response(response)

    def test_retrieve_xform_media(self):
        self._load_metadata(self.xform)
        self.view = XFormListApi.as_view({'get': 'media'})
        request = self.factory.head('/')
        response = self.view(request, pk=self.xform.pk,
                             metadata=self.metadata.pk, format='png')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        auth = DigestAuth('bob', 'bobbob')
        request = self.factory.get('/')
        request.META.update(auth(request.META, response))
        response = self.view(request, pk=self.xform.pk,
                             metadata=self.metadata.pk, format='png')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_retrieve_xform_media_as_anonymous(self):
        self._load_metadata(self.xform)
        self.view = XFormListApi.as_view({
            'get': 'media'
        })
        request = self.factory.get('/')
        response = self.view(
            request, pk=self.xform.pk, metadata=self.metadata.pk, format='png'
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class TestXFormListAsOrgAdminApiBase(TestXFormListApiBase):
    """
    This class is almost a copy/paste from TestXFormListApiWithAuthRequired at
    the exception the user is Alice, an admin of Bob's org.
    No explicit permission assignment should be present in DB, but Alice should still
    have access to org projects.
    """

    def setUp(self):
        super().setUp()

        assert self.xform.user.username == 'bob'
        bob_organization: Organization = self.xform.user.organization
        bob_organization.mmo_override = True
        bob_organization.save()

        alice_data = {
            'username': 'alice',
            'password1': 'alicealice',
            'password2': 'alicealice',
            'email': 'alice@localhost.com',
        }
        alice_profile = self._create_user_profile(alice_data)
        alice = alice_profile.user
        bob_organization.add_user(alice, is_admin=True)

    def test_head_xform_list(self):
        request = self.factory.head('/')
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        auth = DigestAuth('alice', 'alicealice')
        request.META.update(auth(request.META, response))
        response = self.view(request)
        self.validate_openrosa_head_response(response)

    def test_get_xform_list(self):
        """
        Alice has no explicit assigned permissions on any project.
        Form list should be empty
        """
        request = self.factory.get('/')
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        auth = DigestAuth('alice', 'alicealice')
        request.META.update(auth(request.META, response))
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        content = response.render().content
        expected_content = b'<?xml version="1.0" encoding="utf-8"?>\n<xforms xmlns="http://openrosa.org/xforms/xformsList"></xforms>'  # noqa
        self.assertEqual(content, expected_content)
        self.assertTrue(response.has_header('X-OpenRosa-Version'))
        self.assertTrue(response.has_header('X-OpenRosa-Accept-Content-Length'))
        self.assertTrue(response.has_header('Date'))
        self.assertEqual(response['Content-Type'], 'text/xml; charset=utf-8')

    def test_get_xform_list_with_formid_parameter(self):
        """
        Test `formList` with `?formID=[id_string]` filter

        Alice is an admin of Bob's org. They should be able to see any org projects.
        """
        # Test a valid `formID`
        request = self.factory.get('/', {'formID': self.xform.id_string})
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        auth = DigestAuth('alice', 'alicealice')
        request.META.update(auth(request.META, response))
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        path = os.path.join(
            os.path.dirname(__file__),
            '..',
            'fixtures',
            'formList_w_require_auth.xml',
        )

        with open(path) as f:
            form_list_xml = f.read().strip()
            data = {'hash': self.xform.md5_hash, 'pk': self.xform.pk}
            content = response.render().content.decode()
            self.assertEqual(content, form_list_xml % data)

    def test_retrieve_xform_xml(self):
        self.view = XFormListApi.as_view({'get': 'retrieve'})
        request = self.factory.head('/')
        response = self.view(request, pk=self.xform.pk)
        auth = DigestAuth('alice', 'alicealice')
        request = self.factory.get('/')
        request.META.update(auth(request.META, response))
        response = self.view(request, pk=self.xform.pk)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertEqual(response['Content-Type'], 'text/xml; charset=utf-8')
        self.assertTrue(response.has_header('X-OpenRosa-Version'))
        self.assertTrue(response.has_header('X-OpenRosa-Accept-Content-Length'))
        self.assertTrue(response.has_header('Date'))

        path = os.path.join(
            os.path.dirname(__file__),
            '..',
            'fixtures',
            'Transportation Form.xml',
        )

        with open(path) as f:
            form_xml = f.read().strip()
            data = {'form_uuid': self.xform.uuid}
            content = response.render().content.decode().strip()
            self.assertEqual(content, form_xml % data)

    def test_retrieve_xform_manifest(self):
        self._load_metadata(self.xform)
        self.view = XFormListApi.as_view({'get': 'manifest'})
        request = self.factory.head('/')
        response = self.view(request, pk=self.xform.pk)
        auth = DigestAuth('alice', 'alicealice')
        request = self.factory.get('/')
        request.META.update(auth(request.META, response))
        response = self.view(request, pk=self.xform.pk)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        manifest_xml = (
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<manifest xmlns="http://openrosa.org/xforms/xformsManifest">'
            '   <mediaFile>'
            '        <filename>screenshot.png</filename>'
            '        <hash>%(hash)s</hash>'
            '        <downloadUrl>http://testserver/xformsMedia/%(xform)s/%(pk)s.png</downloadUrl>'  # noqa
            '    </mediaFile>'
            '</manifest>'
        )

        manifest_xml = re.sub(r'> +<', '><', manifest_xml).strip()

        data = {
            'hash': self.metadata.md5_hash,
            'pk': self.metadata.pk,
            'xform': self.xform.pk,
        }
        content = response.render().content.decode().strip()
        self.assertEqual(content, manifest_xml % data)
        self.assertTrue(response.has_header('X-OpenRosa-Version'))
        self.assertTrue(response.has_header('X-OpenRosa-Accept-Content-Length'))
        self.assertTrue(response.has_header('Date'))
        self.assertEqual(response['Content-Type'], 'text/xml; charset=utf-8')

    def test_head_xform_manifest(self):
        self._load_metadata(self.xform)
        self.view = XFormListApi.as_view({'get': 'manifest'})
        request = self.factory.head('/')
        response = self.view(request, pk=self.xform.pk)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        auth = DigestAuth('alice', 'alicealice')
        request.META.update(auth(request.META, response))
        response = self.view(request, pk=self.xform.pk)
        self.validate_openrosa_head_response(response)

    def test_head_xform_media(self):
        self._load_metadata(self.xform)
        self.view = XFormListApi.as_view({'get': 'media'})
        request = self.factory.head('/')
        response = self.view(
            request, pk=self.xform.pk, metadata=self.metadata.pk, format='png'
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        auth = DigestAuth('alice', 'alicealice')
        request.META.update(auth(request.META, response))
        response = self.view(
            request, pk=self.xform.pk, metadata=self.metadata.pk, format='png'
        )
        self.validate_openrosa_head_response(response)

    def test_retrieve_xform_media(self):
        self._load_metadata(self.xform)
        self.view = XFormListApi.as_view({'get': 'media'})
        request = self.factory.head('/')
        response = self.view(
            request, pk=self.xform.pk, metadata=self.metadata.pk, format='png'
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        auth = DigestAuth('alice', 'alicealice')
        request = self.factory.get('/')
        request.META.update(auth(request.META, response))
        response = self.view(
            request, pk=self.xform.pk, metadata=self.metadata.pk, format='png'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)


@ddt
class TestXFormListApiAsDataCollector(TestXFormListApiBase):
    def setUp(self):
        super().setUp()
        dcg = DataCollectorGroup.objects.create(name='DCG_0')
        dc = DataCollector.objects.create(name='DC_00', group=dcg)
        self.xform_without_auth = self.xform
        self.xform_without_auth.require_auth = False
        self.xform_without_auth.save(update_fields=['require_auth'])

        data = {
            'owner': self.user.username,
            'public': False,
            'public_data': False,
            'description': 'transportation_with_attachment',
            'downloadable': True,
            'encrypted': False,
            'id_string': 'transportation_with_attachment',
            'title': 'transportation_with_attachment',
        }

        path = os.path.join(
            settings.OPENROSA_APP_DIR,
            'apps',
            'main',
            'tests',
            'fixtures',
            'transportation',
            'transportation_with_attachment.xls',
        )
        self.publish_xls_form(data=data, path=path)
        self.assertNotEqual(self.xform.pk, self.xform_without_auth.pk)
        self.assertEqual(XForm.objects.all().count(), 2)
        self.assertEqual(XForm.objects.filter(require_auth=False).count(), 1)
        dcg.assets.add(self.xform.asset)
        dcg.assets.add(self.xform_without_auth.asset)
        self.data_collector = dc
        # a data collector without access to anything
        self.data_collector_no_assets = DataCollector.objects.create(name='DC_noassets')
        self.maxDiff = None

    def get_test_token(self, token_type):
        if token_type == 'valid':
            return self.data_collector.token
        elif token_type == 'invalid':
            return 'badtoken'
        else:
            return self.data_collector_no_assets.token

    @data('valid', 'invalid', 'no_assets')
    def test_get_xform_list(self, token_type):
        response = self.client.get(
            reverse('form-list', kwargs={'token': self.get_test_token(token_type)})
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        content = response.render().content.decode()

        if token_type in ['invalid', 'no_assets']:
            self.assertEqual(content, EMPTY_LIST_CONTENT)
            return

        both_forms = os.path.join(
            os.path.dirname(__file__),
            '..',
            'fixtures',
            'formList_with_both_for_dcs.xml',
        )

        with open(both_forms, 'r') as f:
            form_list_xml = f.read().strip()
            data = {
                'hash_0': self.xform_without_auth.md5_hash,
                'hash_1': self.xform.md5_hash,
                'token': self.data_collector.token,
                'pk_0': self.xform_without_auth.pk,
                'pk_1': self.xform.pk,
            }
            self.assertEqual(content, form_list_xml % data)
            self.assertTrue(response.has_header('X-OpenRosa-Version'))
            self.assertTrue(response.has_header('X-OpenRosa-Accept-Content-Length'))
            self.assertTrue(response.has_header('Date'))
            self.assertEqual(response['Content-Type'], 'text/xml; charset=utf-8')

    @data('valid', 'invalid', 'no_assets')
    def test_get_individual_xform(self, token_type):
        token = self.get_test_token(token_type)
        base_url = reverse('form-list', kwargs={'token': token})
        url = '%s?%s' % (base_url, urlencode({'formID': self.xform.id_string}))
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        content = response.render().content.decode()

        if token_type in ['invalid', 'no_assets']:
            self.assertEqual(content, EMPTY_LIST_CONTENT)
            return
        path = os.path.join(
            os.path.dirname(__file__),
            '..',
            'fixtures',
            'formList_for_dc.xml',
        )

        with open(path) as f:
            form_list_xml = f.read().strip()
            data = {
                'hash': self.xform.md5_hash,
                'pk': self.xform.pk,
                'token': self.data_collector.token,
            }
            self.assertEqual(content, form_list_xml % data)

    @data('valid', 'invalid', 'no_assets')
    def test_retrieve_xform_manifest(self, token_type):
        self._load_metadata(self.xform)
        token = self.get_test_token(token_type)

        base_url = reverse(
            'manifest-url',
            kwargs={'token': token, 'pk': self.xform.pk},
        )

        response = self.client.get(base_url)
        if token_type in ['invalid', 'no_assets']:
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
            return
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        manifest_xml = (
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<manifest xmlns="http://openrosa.org/xforms/xformsManifest">'
            '   <mediaFile>'
            '        <filename>screenshot.png</filename>'
            '        <hash>%(hash)s</hash>'
            '        <downloadUrl>http://testserver/collector/%(key)s/xformsMedia/%(xform)s/%(pk)s.png</downloadUrl>'  # noqa
            '    </mediaFile>'
            '</manifest>'
        )

        manifest_xml = re.sub(r'> +<', '><', manifest_xml).strip()

        data = {
            'key': self.data_collector.token,
            'hash': self.metadata.md5_hash,
            'pk': self.metadata.pk,
            'xform': self.xform.pk,
        }
        content = response.render().content.decode().strip()
        self.assertEqual(content, manifest_xml % data)
        self.assertTrue(response.has_header('X-OpenRosa-Version'))
        self.assertTrue(response.has_header('X-OpenRosa-Accept-Content-Length'))
        self.assertTrue(response.has_header('Date'))
        self.assertEqual(response['Content-Type'], 'text/xml; charset=utf-8')

    @data('valid', 'invalid', 'no_assets')
    def test_get_media(self, token_type):
        self._load_metadata(self.xform)
        token = self.get_test_token(token_type)
        base_url = reverse(
            'xform-media',
            kwargs={
                'token': token,
                'pk': self.xform.pk,
                'metadata': self.metadata.pk,
                'format': 'png',
            },
        )
        response = self.client.get(base_url)
        if token_type == 'valid':
            self.assertEqual(response.status_code, status.HTTP_200_OK)
        else:
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @data('valid', 'invalid', 'no_assets')
    def test_retrieve_xform_xml(self, token_type):
        token = self.get_test_token(token_type)
        base_url = reverse(
            'download_xform',
            kwargs={
                'token': token,
                'pk': self.xform_without_auth.pk,
            },
        )
        response = self.client.get(base_url)
        if token_type in ['invalid', 'no_assets']:
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
            return

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertEqual(response['Content-Type'], 'text/xml; charset=utf-8')
        self.assertTrue(response.has_header('X-OpenRosa-Version'))
        self.assertTrue(response.has_header('X-OpenRosa-Accept-Content-Length'))
        self.assertTrue(response.has_header('Date'))

        path = os.path.join(
            os.path.dirname(__file__),
            '..',
            'fixtures',
            'Transportation Form.xml',
        )

        with open(path) as f:
            form_xml = f.read().strip()
            data = {'form_uuid': self.xform_without_auth.uuid}
            content = response.render().content.decode().strip()
            self.assertEqual(content, form_xml % data)

    @data('valid', 'invalid', 'no_assets')
    def test_head_xform_manifest(self, token_type):
        self._load_metadata(self.xform)
        token = self.get_test_token(token_type)

        base_url = reverse(
            'manifest-url',
            kwargs={'token': token, 'pk': self.xform.pk},
        )
        response = self.client.head(base_url)
        if token_type in ['invalid', 'no_assets']:
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        else:
            self.validate_openrosa_head_response(response)

    @data('valid', 'invalid', 'no_assets')
    def test_head_xform_media(self, token_type):
        self._load_metadata(self.xform)
        token = self.get_test_token(token_type)
        base_url = reverse(
            'xform-media',
            kwargs={
                'token': token,
                'pk': self.xform.pk,
                'metadata': self.metadata.pk,
                'format': 'png',
            },
        )
        response = self.client.head(base_url)
        if token_type in ['invalid', 'no_assets']:
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        else:
            self.validate_openrosa_head_response(response)
