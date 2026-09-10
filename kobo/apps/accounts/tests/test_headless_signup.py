"""
The headless signup endpoint is a separate code path from the templated signup
page: allauth builds its own `SignupInput` rather than using
`ACCOUNT_FORMS['signup']`. These tests pin down that both paths accept the same
fields, enforce the same rules and store the same data.

See `kobo/apps/accounts/signup_fields.py` for how the two are kept in sync.
"""

from constance.test import override_config
from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from hub.models.sitewide_message import SitewideMessage

HEADLESS_SIGNUP_URL = '/api/v2/allauth/browser/v1/auth/signup'


class HeadlessSignupExtraFieldsTestCase(TestCase):
    """
    `POST /api/v2/allauth/browser/v1/auth/signup` must accept the same extra
    fields as the templated form and persist them to `ExtraUserDetail`
    """

    def setUp(self):
        self.client = Client()
        SitewideMessage.objects.create(slug='terms_of_service', body='tos agreement')

    def test_extra_fields_are_persisted(self):
        self._post_expecting_success(self._payload())

        user = get_user_model().objects.get(username='headless_user')
        extra_data = user.extra_details.data
        assert extra_data['name'] == 'Headless Tester'
        assert extra_data['organization'] == 'Ministry of Love'
        assert extra_data['organization_type'] == 'non-profit'
        assert extra_data['organization_website'] == 'https://minilove.test'
        assert extra_data['newsletter_subscription'] is True
        # `terms_of_service` is recorded as a timestamp, not stored verbatim
        assert 'terms_of_service' not in extra_data
        assert user.extra_details.private_data['last_tos_accept_time']

    def test_terms_of_service_is_required(self):
        response = self._post(
            self._payload(username='tos_reluctant', terms_of_service=False)
        )

        assert response.status_code == 400
        assert not get_user_model().objects.filter(username='tos_reluctant').exists()

    def test_terms_of_service_not_required_when_no_sitewide_message(self):
        SitewideMessage.objects.filter(slug='terms_of_service').delete()

        payload = self._payload(username='no_tos_for_me')
        del payload['terms_of_service']
        self._post_expecting_success(payload)

        user = get_user_model().objects.get(username='no_tos_for_me')
        assert 'last_tos_accept_time' not in user.extra_details.private_data

    @override_config(REGISTRATION_BLACKLIST_EMAIL_DOMAINS='example.com')
    def test_blacklisted_email_domain_is_rejected(self):
        response = self._post(self._payload(username='blacklisted'))

        assert response.status_code == 400
        assert not get_user_model().objects.filter(username='blacklisted').exists()

    @override_config(
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=True,
        PASSWORD_USER_ATTRIBUTES='username\nemail\nfull_name\norganization',
    )
    def test_password_is_checked_against_user_attributes(self):
        # allauth calls the password validators without a user, so the
        # similarity rules would never fire on this path without our own check
        response = self._post(
            self._payload(username='similar_pw', password='Ministry of Love')
        )

        assert response.status_code == 400, response.content
        assert not get_user_model().objects.filter(username='similar_pw').exists()

    @override_config(USER_METADATA_FIELDS=[{'name': 'name', 'required': True}])
    def test_fields_disabled_for_this_server_are_not_stored(self):
        # `organization` is not in USER_METADATA_FIELDS, so the field is removed
        # from the form and any submitted value must be ignored
        self._post_expecting_success(self._payload(username='minimal_metadata'))

        user = get_user_model().objects.get(username='minimal_metadata')
        assert user.extra_details.data['name'] == 'Headless Tester'
        # `ExtraUserDetail` normalises `organization` into a string of its own
        # accord, so assert the submitted value was discarded rather than
        # asserting the key is absent
        assert user.extra_details.data.get('organization') != 'Ministry of Love'
        assert 'sector' not in user.extra_details.data

    @override_config(
        USER_METADATA_FIELDS=[
            {'name': 'organization', 'required': True},
            {'name': 'organization_type', 'required': True},
        ]
    )
    def test_conditionally_required_organization_fields_are_enforced(self):
        # `organization` is required unless `organization_type` is 'none'
        response = self._post(
            self._payload(
                username='no_org', organization='', organization_type='government'
            )
        )
        assert response.status_code == 400
        assert not get_user_model().objects.filter(username='no_org').exists()

        # ...and the 'none' escape hatch still works over the API
        self._post_expecting_success(
            self._payload(
                username='org_less', organization='', organization_type='none'
            )
        )
        assert get_user_model().objects.filter(username='org_less').exists()

    def _payload(self, username='headless_user', **overrides):
        payload = {
            'username': username,
            'email': f'{username}@example.com',
            'password': 'a-Sufficiently-Long-Passphrase-42',
            'name': 'Headless Tester',
            'organization': 'Ministry of Love',
            'organization_type': 'non-profit',
            'organization_website': 'https://minilove.test',
            'sector': 'Public Administration',
            'country': 'FRA',
            'newsletter_subscription': True,
            'terms_of_service': True,
        }
        payload.update(overrides)
        return payload

    def _post(self, payload):
        return self.client.post(
            HEADLESS_SIGNUP_URL, payload, content_type='application/json'
        )

    def _post_expecting_success(self, payload):
        response = self._post(payload)
        # `ACCOUNT_EMAIL_VERIFICATION = 'mandatory'` means a successful signup
        # leaves the session unauthenticated pending verification, which allauth
        # reports as 401 rather than 2xx
        assert response.status_code == 401, response.content
        return response


class TemplatedSignupRegressionTestCase(TestCase):
    """
    `AccountAdapter.save_user` no longer identifies our extra fields by diffing
    against allauth's own `SignupForm`, because `ACCOUNT_SIGNUP_FORM_CLASS` puts
    them on that form too. Getting this wrong drops every extra value silently
    while still creating the account, so pin the templated path down as well
    """

    def setUp(self):
        self.client = Client()
        self.url = reverse('account_signup')

    def test_extra_fields_are_persisted(self):
        SitewideMessage.objects.create(slug='terms_of_service', body='tos agreement')
        username = 'templated_user'
        response = self.client.post(
            self.url,
            {
                'username': username,
                'email': f'{username}@example.com',
                'password1': 'a-Sufficiently-Long-Passphrase-42',
                'password2': 'a-Sufficiently-Long-Passphrase-42',
                'name': 'Templated Tester',
                'organization': 'Ministry of Peace',
                'organization_type': 'non-profit',
                'organization_website': 'https://minipax.test',
                'newsletter_subscription': True,
                'terms_of_service': True,
            },
        )

        assert response.status_code == 302
        user = get_user_model().objects.get(username=username)
        extra_data = user.extra_details.data
        assert extra_data['name'] == 'Templated Tester'
        assert extra_data['organization'] == 'Ministry of Peace'
        assert extra_data['newsletter_subscription'] is True
        assert user.extra_details.private_data['last_tos_accept_time']
