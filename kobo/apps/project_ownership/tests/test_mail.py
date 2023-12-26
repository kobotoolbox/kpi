from django.test import TestCase

class Mail(TestCase):

    def test_recipient_receives_invite(self):
        raise NotImplementedError('To be implemented')

    def test_sender_receives_new_owner_acceptance(self):
        raise NotImplementedError('To be implemented')

    def test_sender_receives_new_owner_refusal(self):
        raise NotImplementedError('To be implemented')

    def test_sender_receives_expired_notification(self):
        raise NotImplementedError('To be implemented')

    def test_admins_receive_failure_report(self):
        raise NotImplementedError('To be implemented')
