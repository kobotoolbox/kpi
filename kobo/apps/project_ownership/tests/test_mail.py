from django.contrib.auth import get_user_model
from django.core import mail
from rest_framework.reverse import reverse

from kpi.models import Asset
from kpi.tests.kpi_test_case import KpiTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE

from kobo.apps.project_ownership.models import Invite, InviteStatusChoices


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
                self._get_endpoint('user-detail'), args=[self.anotheruser.username]
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
        payload = {'status': InviteStatusChoices.ACCEPTED.value}
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
        payload = {'status': InviteStatusChoices.DECLINED.value}
        self.client.patch(invite_detail_url, data=payload, format='json')

        self.assertEqual(mail.outbox[0].to[0], self.someuser.email)
        self.assertEqual(
            mail.outbox[0].subject, 'KoboToolbox project ownership transfer accepted'
        )

    def test_sender_receives_expired_notification(self):
        raise NotImplementedError('To be implemented')

    def test_admins_receive_failure_report(self):
        raise NotImplementedError('To be implemented')
