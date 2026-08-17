from django.core.checks import run_checks
from django.test import TestCase, override_settings


class MassEmailSendSettingsCheckTestCase(TestCase):

    ALL_CHECK_IDS = (
        'mass_emails.E001',
        'mass_emails.E002',
        'mass_emails.E003',
    )

    @override_settings(MASS_EMAIL_THROTTLE_PER_SECOND=0)
    def test_zero_throttle_fails(self):
        errors = run_checks()
        assert any(e.id == 'mass_emails.E001' for e in errors)

    @override_settings(MASS_EMAIL_SEND_RATE_RATIO=0)
    def test_zero_send_rate_ratio_fails(self):
        errors = run_checks()
        assert any(e.id == 'mass_emails.E002' for e in errors)

    @override_settings(MASS_EMAIL_SEND_RATE_RATIO=0.75)
    def test_send_rate_ratio_above_half_is_allowed(self):
        # Above 0.5 risks bursting past the provider's rate limit near a
        # window boundary, but it's the admin's call, not a hard block.
        errors = run_checks()
        assert not any(e.id == 'mass_emails.E002' for e in errors)

    @override_settings(MASS_EMAIL_SEND_RATE_RATIO=1.01)
    def test_send_rate_ratio_above_one_fails(self):
        errors = run_checks()
        assert any(e.id == 'mass_emails.E002' for e in errors)

    @override_settings(MAILER_CONNECTION_IDLE_TIMEOUT=0)
    def test_zero_idle_timeout_fails(self):
        errors = run_checks()
        assert any(e.id == 'mass_emails.E003' for e in errors)

    def test_default_settings_pass(self):
        errors = run_checks()
        assert not any(e.id in self.ALL_CHECK_IDS for e in errors)
