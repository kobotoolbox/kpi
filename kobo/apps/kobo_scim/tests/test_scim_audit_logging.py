from allauth.socialaccount.models import SocialAccount, SocialApp
from django.urls import reverse
from rest_framework.test import APITestCase

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog, AuditType
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.kobo_scim.constants import SCIM_SCHEMA_USER
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

        self.url_base = reverse(
            'api_v2:kobo_scim:scim-users-list', kwargs={'idp_slug': self.idp.slug}
        )

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
            provider=self.social_app.provider_id,
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

    def test_patch_reactivate_inactive_user_logs_reprovisioning(self):
        url = f'{self.url_base}/{self.user1.id}'

        deactivate_payload = {
            'Operations': [{'op': 'replace', 'path': 'active', 'value': False}]
        }
        self.client.patch(url, deactivate_payload, format='json')
        AuditLog.objects.filter(object_id=self.user1.id).delete()

        reactivate_payload = {
            'Operations': [{'op': 'replace', 'path': 'active', 'value': True}]
        }
        response = self.client.patch(url, reactivate_payload, format='json')
        self.assertEqual(response.status_code, 200)

        audit_logs = AuditLog.objects.filter(
            action=AuditAction.REPROVISIONING,
            object_id=self.user1.id,
        )
        self.assertEqual(audit_logs.count(), 1)
        log = audit_logs.first()
        self.assertEqual(log.metadata['idp_slug'], 'test-idp')
        self.assertEqual(log.metadata['username'], 'jdoe')
        self.assertEqual(log.metadata['email'], 'jdoe@example.com')
        self.assertEqual(log.metadata['status_code'], 200)
        self.assertIn('re-provisioning', log.metadata['reason'].lower())

    def test_patch_reactivate_active_user_no_audit_log(self):
        url = f'{self.url_base}/{self.user1.id}'

        self.assertTrue(self.user1.is_active)
        AuditLog.objects.filter(object_id=self.user1.id).delete()

        payload = {'Operations': [{'op': 'replace', 'path': 'active', 'value': True}]}
        response = self.client.patch(url, payload, format='json')
        self.assertEqual(response.status_code, 200)

        audit_logs = AuditLog.objects.filter(
            action=AuditAction.REPROVISIONING,
            object_id=self.user1.id,
        )
        self.assertEqual(audit_logs.count(), 0)

    def test_patch_reactivate_multiple_users_same_email_logs_all(self):
        user1_alt = User.objects.create_user(
            username='jdoe_alt',
            email='jdoe@example.com',
        )
        SocialAccount.objects.create(
            user=user1_alt,
            provider=self.social_app.provider_id,
            uid='jdoe-alt-uid',
        )

        self.user1.is_active = False
        self.user1.save()
        user1_alt.is_active = False
        user1_alt.save()
        url = f'{self.url_base}/{self.user1.id}'

        AuditLog.objects.filter(
            action=AuditAction.REPROVISIONING,
        ).delete()

        payload = {'Operations': [{'op': 'replace', 'path': 'active', 'value': True}]}
        response = self.client.patch(url, payload, format='json')
        self.assertEqual(response.status_code, 200)

        self.user1.refresh_from_db()
        user1_alt.refresh_from_db()
        self.assertTrue(self.user1.is_active)
        self.assertTrue(user1_alt.is_active)

        audit_logs = AuditLog.objects.filter(
            action=AuditAction.REPROVISIONING,
            object_id__in=[self.user1.id, user1_alt.id],
        ).order_by('object_id')
        self.assertEqual(audit_logs.count(), 2)

        log_user_ids = {int(log.object_id) for log in audit_logs}
        self.assertEqual(log_user_ids, {self.user1.id, user1_alt.id})
        for log in audit_logs:
            self.assertEqual(log.metadata['idp_slug'], 'test-idp')
            self.assertEqual(log.metadata['status_code'], 200)
            self.assertIn('re-provisioning', log.metadata['reason'].lower())

    def test_post_create_with_existing_email_logs_error(self):
        AuditLog.objects.filter(object_id__isnull=True).delete()

        payload = {
            'schemas': [SCIM_SCHEMA_USER],
            'userName': 'newuser',
            'emails': [{'primary': True, 'value': 'jdoe@example.com', 'type': 'work'}],
            'active': True,
        }

        response = self.client.post(
            self.url_base,
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response.status_code, 409)

        audit_logs = AuditLog.objects.filter(
            action=AuditAction.PROVISIONING_ERROR,
            object_id__isnull=True,
        )
        error_logs = [
            log for log in audit_logs if log.metadata.get('email') == 'jdoe@example.com'
        ]
        self.assertGreater(len(error_logs), 0)
        log = error_logs[0]
        self.assertEqual(log.metadata['idp_slug'], 'test-idp')
        self.assertEqual(log.metadata['error'], 'email_already_exists')
        self.assertIn('email address already exists', log.metadata['reason'].lower())

    def test_post_create_success_logs_provisioning(self):
        AuditLog.objects.all().delete()

        payload = {
            'schemas': [SCIM_SCHEMA_USER],
            'userName': 'newuser',
            'emails': [{'primary': True, 'value': 'newuser@example.com'}],
            'active': True,
        }

        response = self.client.post(
            self.url_base,
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response.status_code, 201)

        user = User.objects.get(username='newuser')
        audit_logs = AuditLog.objects.filter(
            action=AuditAction.PROVISIONING,
            object_id=user.id,
        )
        self.assertEqual(audit_logs.count(), 1)
        log = audit_logs.first()
        self.assertEqual(log.metadata['idp_slug'], 'test-idp')
        self.assertEqual(log.metadata['username'], 'newuser')
        self.assertEqual(log.metadata['email'], 'newuser@example.com')
        self.assertEqual(log.metadata['status_code'], 201)

    def test_post_reactivate_multiple_users_same_email_logs_all(self):
        user1_alt = User.objects.create_user(
            username='jdoe_alt',
            email='jdoe@example.com',
            is_active=False,
        )
        SocialAccount.objects.create(
            user=user1_alt,
            provider=self.social_app.provider_id,
            uid='jdoe-alt-uid',
        )

        self.user1.is_active = False
        self.user1.save()

        AuditLog.objects.filter(action=AuditAction.REPROVISIONING).delete()

        payload = {
            'schemas': [SCIM_SCHEMA_USER],
            'userName': 'jdoe',
            'externalId': 'jdoe-uid',
            'emails': [{'primary': True, 'value': 'jdoe@example.com'}],
            'active': True,
        }

        response = self.client.post(
            self.url_base,
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response.status_code, 201)

        self.user1.refresh_from_db()
        user1_alt.refresh_from_db()
        self.assertTrue(self.user1.is_active)
        self.assertTrue(user1_alt.is_active)

        audit_logs = AuditLog.objects.filter(
            action=AuditAction.REPROVISIONING,
            object_id__in=[self.user1.id, user1_alt.id],
        )

        self.assertEqual(audit_logs.count(), 2)

    def test_post_reactivate_inactive_user_logs_reprovisioning(self):
        self.user1.is_active = False
        self.user1.save()

        AuditLog.objects.filter(object_id=self.user1.id).delete()
        payload = {
            'schemas': [SCIM_SCHEMA_USER],
            'userName': 'jdoe',
            'externalId': 'jdoe-uid',
            'emails': [{'primary': True, 'value': 'jdoe@example.com'}],
            'active': True,
        }

        response = self.client.post(
            self.url_base,
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response.status_code, 201)

        audit_logs = AuditLog.objects.filter(
            action=AuditAction.REPROVISIONING,
            object_id=self.user1.id,
        )
        self.assertEqual(audit_logs.count(), 1)
        log = audit_logs.first()
        self.assertEqual(log.metadata['idp_slug'], 'test-idp')
        self.assertEqual(log.metadata['status_code'], 201)
        self.assertIn('re-provisioning', log.metadata['reason'].lower())

    def test_post_create_inactive_user_logs_provisioning_and_deactivation(self):
        payload = {
            'schemas': [SCIM_SCHEMA_USER],
            'userName': 'inactive_user',
            'emails': [{'primary': True, 'value': 'inactive@example.com'}],
            'active': False,
        }

        response = self.client.post(
            self.url_base,
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response.status_code, 201)

        user = User.objects.get(username='inactive_user')
        self.assertFalse(user.is_active)

        provisioning_logs = AuditLog.objects.filter(
            action=AuditAction.PROVISIONING,
            object_id=user.id,
        )
        self.assertEqual(provisioning_logs.count(), 1)

        deactivation_logs = AuditLog.objects.filter(
            action=AuditAction.DEACTIVATION,
            object_id=user.id,
        )
        self.assertEqual(deactivation_logs.count(), 1)

    def test_post_existing_linked_inactive_user_logs_reprovisioning_and_deactivation(
        self,
    ):
        self.user1.is_active = True
        self.user1.save()

        AuditLog.objects.filter(object_id=self.user1.id).delete()

        payload = {
            'schemas': [SCIM_SCHEMA_USER],
            'userName': 'jdoe',
            'externalId': 'jdoe-uid',
            'emails': [{'primary': True, 'value': 'jdoe@example.com'}],
            'active': False,
        }

        response = self.client.post(
            self.url_base,
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response.status_code, 201)

        self.user1.refresh_from_db()
        self.assertFalse(self.user1.is_active)

        self.assertEqual(
            AuditLog.objects.filter(
                action=AuditAction.REPROVISIONING,
                object_id=self.user1.id,
            ).count(),
            1,
        )

        self.assertEqual(
            AuditLog.objects.filter(
                action=AuditAction.DEACTIVATION,
                object_id=self.user1.id,
            ).count(),
            1,
        )
