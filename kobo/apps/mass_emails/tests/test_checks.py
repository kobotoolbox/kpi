from django.core.checks import run_checks
from django.test import TestCase, override_settings


class MassEmailSendSettingsCheckTestCase(TestCase):

    @override_settings(MASS_EMAIL_THROTTLE_PER_SECOND=0)
    def test_zero_throttle_fails(self):
        errors = run_checks()
        assert any(e.id == 'mass_emails.E001' for e in errors)

    @override_settings(MASS_EMAIL_SLEEP_SECONDS=-1)
    def test_negative_sleep_fails(self):
        errors = run_checks()
        assert any(e.id == 'mass_emails.E002' for e in errors)

    def test_default_settings_pass(self):
        errors = run_checks()
        assert not any(e.id in ('mass_emails.E001', 'mass_emails.E002') for e in errors)
