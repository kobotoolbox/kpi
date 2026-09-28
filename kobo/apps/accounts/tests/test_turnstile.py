from unittest.mock import patch
import requests
from constance.test import override_config
from django.test import TestCase
from django.utils.translation import gettext_lazy as t

from kobo.apps.accounts.forms import LoginForm, SignupForm
from kobo.apps.accounts.utils import validate_turnstile


class TurnstileTestCase(TestCase):
    def test_validate_turnstile_disabled(self):
        with override_config(TURNSTILE_ENABLED=False):
            # Should return True immediately without checking token or api
            self.assertTrue(validate_turnstile(None))
            self.assertTrue(validate_turnstile('dummy-token'))

    def test_validate_turnstile_enabled_missing_secret_key(self):
        with override_config(TURNSTILE_ENABLED=True, TURNSTILE_SECRET_KEY=''):
            # Should return False because secret key is missing
            self.assertFalse(validate_turnstile('dummy-token'))

    def test_validate_turnstile_enabled_empty_token(self):
        with override_config(TURNSTILE_ENABLED=True, TURNSTILE_SECRET_KEY='secret'):
            # Should return False because token is empty
            self.assertFalse(validate_turnstile(None))
            self.assertFalse(validate_turnstile(''))

    @patch('requests.post')
    def test_validate_turnstile_api_success(self, mock_post):
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {'success': True}

        with override_config(TURNSTILE_ENABLED=True, TURNSTILE_SECRET_KEY='secret'):
            self.assertTrue(validate_turnstile('valid-token'))
            mock_post.assert_called_once_with(
                'https://challenges.cloudflare.com/turnstile/v0/siteverify',
                data={'secret': 'secret', 'response': 'valid-token'},
                timeout=5
            )

    @patch('requests.post')
    def test_validate_turnstile_api_failure(self, mock_post):
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {'success': False}

        with override_config(TURNSTILE_ENABLED=True, TURNSTILE_SECRET_KEY='secret'):
            self.assertFalse(validate_turnstile('invalid-token'))

    @patch('requests.post')
    def test_validate_turnstile_api_exception(self, mock_post):
        mock_post.side_effect = requests.RequestException("API error")

        with override_config(TURNSTILE_ENABLED=True, TURNSTILE_SECRET_KEY='secret'):
            self.assertFalse(validate_turnstile('token'))

    @patch('kobo.apps.accounts.utils.validate_turnstile')
    def test_login_form_validation_with_turnstile(self, mock_validate):
        from django.test import RequestFactory
        from django.core.exceptions import ValidationError
        
        rf = RequestFactory()
        request = rf.post('/accounts/login/')

        # 1. Enabled and validation fails
        mock_validate.return_value = False
        with override_config(TURNSTILE_ENABLED=True):
            form = LoginForm(request=request, data={'login': 'user', 'password': 'pwd', 'cf-turnstile-response': 'token'})
            self.assertFalse(form.is_valid())
            self.assertIn('__all__', form.errors)
            self.assertIn('Turnstile', str(form.errors['__all__']))

        # 2. Enabled and validation succeeds
        mock_validate.return_value = True
        with override_config(TURNSTILE_ENABLED=True):
            form = LoginForm(request=request, data={'login': 'user', 'password': 'pwd', 'cf-turnstile-response': 'token'})
            self.assertFalse(form.is_valid())
            self.assertNotIn('Turnstile', str(form.errors))

        # 3. Disabled
        with override_config(TURNSTILE_ENABLED=False):
            form = LoginForm(request=request, data={'login': 'user', 'password': 'pwd'})
            self.assertFalse(form.is_valid())
            self.assertNotIn('Turnstile', str(form.errors))
