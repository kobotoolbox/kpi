from constance.test import override_config
from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from hub.models.sitewide_message import SitewideMessage

HEADLESS_SIGNUP_URL = '/api/v2/allauth/browser/v1/auth/signup'

# Collected after login through `PATCH /me/`, never at signup
PROFILE_FIELDS = {
    'name': 'Headless Tester',
    'organization': 'Ministry of Love',
    'organization_type': 'non-profit',
    'organization_website': 'https://minilove.test',
    'sector': 'Public Administration',
    'country': 'FRA',
}


class HeadlessSignupExtraFieldsTestCase(TestCase):
    """
    `POST /api/v2/allauth/browser/v1/auth/signup` accepts the two fields that
    must be collected while the account is created, and nothing else
    """

    def setUp(self):
        self.client = Client()
        SitewideMessage.objects.create(slug='terms_of_service', body='tos agreement')

    def test_extra_fields_are_persisted(self):
        self._post_expecting_success(self._payload())

        user = get_user_model().objects.get(username='headless_user')
        assert user.extra_details.data['newsletter_subscription'] is True
        # `terms_of_service` is recorded as a timestamp, not stored verbatim
        assert 'terms_of_service' not in user.extra_details.data
        assert user.extra_details.private_data['last_tos_accept_time']

    def test_profile_fields_are_not_collected_at_signup(self):
        # The SPA gathers these after login via `PATCH /me/`, so the endpoint
        # must neither advertise nor store them
        self._post_expecting_success(
            self._payload(username='profile_fields', **PROFILE_FIELDS)
        )

        user = get_user_model().objects.get(username='profile_fields')
        extra_data = user.extra_details.data
        for field_name, submitted_value in PROFILE_FIELDS.items():
            assert extra_data.get(field_name) != submitted_value

    def test_profile_fields_are_absent_from_the_published_schema(self):
        from allauth.headless.spec.internal.schema import get_schema

        properties = get_schema()['components']['schemas']['BaseSignup']['properties']

        assert 'newsletter_subscription' in properties
        assert 'terms_of_service' in properties
        for field_name in PROFILE_FIELDS:
            assert field_name not in properties

    def test_terms_of_service_is_required(self):
        response = self._post(
            self._payload(username='tos_reluctant', terms_of_service=False)
        )

        assert response.status_code == 400
        assert not get_user_model().objects.filter(username='tos_reluctant').exists()

    def test_terms_of_service_is_not_required_by_the_published_schema(self):
        # Servers without a `terms_of_service` sitewide message drop the field,
        # so the schema - one artefact shared by every server - must not force
        # generated clients to send it. Requiredness is enforced at runtime;
        # see `test_terms_of_service_is_required`
        from allauth.headless.spec.internal.schema import get_schema

        base_signup = get_schema()['components']['schemas']['BaseSignup']
        assert 'terms_of_service' in base_signup['properties']
        assert 'terms_of_service' not in base_signup.get('required', [])

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
        PASSWORD_USER_ATTRIBUTES='username\nemail',
    )
    def test_password_is_checked_against_user_attributes(self):
        # allauth calls the password validators without a user, so the
        # similarity rules would never fire on this path without our own check
        response = self._post(
            self._payload(username='ministryoflove', password='ministryoflove')
        )

        assert response.status_code == 400, response.content
        assert not get_user_model().objects.filter(username='ministryoflove').exists()

    @override_config(USER_METADATA_FIELDS=[{'name': 'name', 'required': True}])
    def test_fields_disabled_for_this_server_are_not_stored(self):
        # `newsletter_subscription` is not in USER_METADATA_FIELDS, so the field
        # is removed from the form and any submitted value must be ignored
        self._post_expecting_success(self._payload(username='minimal_metadata'))

        user = get_user_model().objects.get(username='minimal_metadata')
        assert user.extra_details.data.get('newsletter_subscription') is not True

    def _payload(self, username='headless_user', **overrides):
        payload = {
            'username': username,
            'email': f'{username}@example.com',
            'password': 'a-Sufficiently-Long-Passphrase-42',
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
    The HTML page keeps collecting everything, and `AccountAdapter.save_user`
    now works from a field-name list spanning both forms. Getting that wrong
    drops values silently while still creating the account, so pin it down
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
        assert extra_data['organization_type'] == 'non-profit'
        assert extra_data['newsletter_subscription'] is True
        assert user.extra_details.private_data['last_tos_accept_time']
