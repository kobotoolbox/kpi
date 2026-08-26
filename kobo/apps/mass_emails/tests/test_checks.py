from django.core.checks import run_checks
from django.test import TestCase, override_settings


class MassEmailSendSettingsCheckTestCase(TestCase):

    ALL_CHECK_IDS = (
        'mass_emails.E001',
        'mass_emails.E002',
    )

    @override_settings(MASS_EMAIL_THROTTLE_PER_SECOND=0)
    def test_zero_throttle_fails(self):
        errors = run_checks()
        assert any(e.id == 'mass_emails.E001' for e in errors)

    @override_settings(MASS_EMAIL_THROTTLE_PER_SECOND=0.1)
    def test_throttle_at_minimum_is_allowed(self):
        errors = run_checks()
        assert not any(e.id == 'mass_emails.E001' for e in errors)

    @override_settings(MAILER_CONNECTION_IDLE_TIMEOUT=0)
    def test_zero_idle_timeout_fails(self):
        errors = run_checks()
        assert any(e.id == 'mass_emails.E002' for e in errors)

    def test_default_settings_pass(self):
        errors = run_checks()
        assert not any(e.id in self.ALL_CHECK_IDS for e in errors)
