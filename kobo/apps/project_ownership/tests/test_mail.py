from constance.test import override_config
from django.contrib.auth import get_user_model
from django.core import mail
from rest_framework.reverse import reverse

from kpi.models import Asset
from kpi.tests.kpi_test_case import KpiTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE

from ..models import Invite, InviteStatusChoices, Transfer, TransferStatusChoices
from ..tasks import mark_as_expired


class ProjectOwnershipMailTestCase(KpiTestCase):
    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self) -> None:
        super().setUp()
        User = get_user_model()  # noqa
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')

        self.invite_url = reverse(self._get_endpoint('project-ownership-invite-list'))
        self.asset = Asset.objects.get(pk=1)

    def test_recipient_receives_invite(self):
        self.client.login(username='someuser', password='someuser')
        payload = {
            'recipient': self.absolute_reverse(
                self._get_endpoint('user-kpi-detail'), args=[self.anotheruser.username]
            ),
            'assets': [self.asset.uid],
        }
        self.client.post(self.invite_url, data=payload, format='json')

        invite_uid = Invite.objects.first().uid
        self.assertEqual(mail.outbox[0].to[0], self.anotheruser.email)
        self.assertIn(invite_uid, mail.outbox[0].body)

    def test_sender_receives_new_owner_acceptance(self):
        invite = Invite.objects.create(sender=self.someuser, recipient=self.anotheruser)
        invite_detail_url = reverse(
            self._get_endpoint('project-ownership-invite-detail'), args=[invite.uid]
        )

        self.client.login(username='anotheruser', password='anotheruser')
        payload = {'status': InviteStatusChoices.ACCEPTED}
        self.client.patch(invite_detail_url, data=payload, format='json')

        self.assertEqual(mail.outbox[0].to[0], self.someuser.email)
        self.assertEqual(
            mail.outbox[0].subject, 'KoboToolbox project ownership transfer accepted'
        )

    def test_sender_receives_new_owner_refusal(self):
        invite = Invite.objects.create(sender=self.someuser, recipient=self.anotheruser)
        invite_detail_url = reverse(
            self._get_endpoint('project-ownership-invite-detail'), args=[invite.uid]
        )

        self.client.login(username='anotheruser', password='anotheruser')
        payload = {'status': InviteStatusChoices.DECLINED}
        self.client.patch(invite_detail_url, data=payload, format='json')

        self.assertEqual(mail.outbox[0].to[0], self.someuser.email)
        self.assertEqual(
            mail.outbox[0].subject, 'KoboToolbox project ownership transfer incomplete'
        )

    @override_config(PROJECT_OWNERSHIP_INVITE_EXPIRY=0)
    def test_sender_receives_expired_notification(self):
        Invite.objects.create(sender=self.someuser, recipient=self.anotheruser)

        mark_as_expired()

        self.assertEqual(mail.outbox[0].to[0], self.someuser.email)
        self.assertEqual(mail.outbox[0].subject, 'Invite has expired')

    @override_config(PROJECT_OWNERSHIP_ADMIN_EMAIL='admin@admin.com')
    def test_admins_receive_failure_report(self):
        asset = Asset.objects.get(pk=1)
        invite = Invite.objects.create(sender=self.someuser, recipient=self.anotheruser)
        transfer = Transfer.objects.create(invite=invite, asset=asset)

        transfer.status = TransferStatusChoices.FAILED
        transfer.save()

        self.assertEqual(mail.outbox[0].to[0], 'admin@admin.com')
        self.assertEqual(
            mail.outbox[0].subject,
            'KoboToolbox Notifications: Project ownership transfer failure',
        )
