from allauth.socialaccount.models import SocialAccount, SocialApp
from rest_framework.test import APITestCase

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog, AuditType
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.kobo_scim.models import IdentityProvider


class ScimAuditLogTests(APITestCase):

    def setUp(self):
        self.social_app = SocialApp.objects.create(
            provider='openid_connect',
            provider_id='google',
            name='Test Provider',
            client_id='test-client-id',
        )

        self.idp = IdentityProvider.objects.create(
            name='Test IdP',
            slug='test-idp',
            scim_api_key='secret-token',
            is_active=True,
            social_app=self.social_app,
        )

        self.url_base = f'/api/scim/v2/{self.idp.slug}/Users'

        self.user1 = User.objects.create_user(
            username='jdoe',
            email='jdoe@example.com',
        )
        SocialAccount.objects.create(
            user=self.user1,
            provider=self.social_app.provider_id,
            uid='jdoe-uid',
        )

        self.user2 = User.objects.create_user(
            username='asmith',
            email='asmith@example.com',
        )
        SocialAccount.objects.create(
            user=self.user2,
            provider=self.social_app.provider_id,
            uid='asmith-uid',
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

    def test_delete_creates_audit_log(self):
        url = f'{self.url_base}/{self.user1.id}'
        self.client.delete(url)

        audit_logs = AuditLog.objects.filter(
            action=AuditAction.DEACTIVATION,
            object_id=self.user1.id,
        )
        self.assertEqual(audit_logs.count(), 1)
        log = audit_logs.first()
        self.assertEqual(log.metadata['idp_slug'], 'test-idp')
        self.assertEqual(log.metadata['deactivated_email'], 'jdoe@example.com')

    def test_delete_multiple_users_same_email_logs_all(self):
        user1_alt = User.objects.create_user(
            username='jdoe_alt',
            email='jdoe@example.com',
        )
        SocialAccount.objects.create(
            user=user1_alt,
            provider=self.social_app.provider,
            uid='jdoe-alt-uid',
        )

        url = f'{self.url_base}/{self.user1.id}'
        self.client.delete(url)

        audit_logs = AuditLog.objects.filter(
            action=AuditAction.DEACTIVATION,
        )
        self.assertEqual(audit_logs.count(), 2)

    def test_patch_creates_audit_log(self):
        url = f'{self.url_base}/{self.user1.id}'
        payload = {'Operations': [{'op': 'replace', 'path': 'active', 'value': False}]}

        self.client.patch(url, payload, format='json')

        audit_logs = AuditLog.objects.filter(
            action=AuditAction.DEACTIVATION,
            object_id=self.user1.id,
        )
        self.assertEqual(audit_logs.count(), 1)
        log = audit_logs.first()
        self.assertEqual(log.metadata['idp_slug'], 'test-idp')

    def test_audit_log_has_correct_type_and_action(self):
        url = f'{self.url_base}/{self.user1.id}'
        self.client.delete(url)

        log = AuditLog.objects.get(object_id=self.user1.id)

        self.assertEqual(log.action, AuditAction.DEACTIVATION)
        self.assertEqual(log.log_type, AuditType.USER_MANAGEMENT)
