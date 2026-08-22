import constance
from allauth.socialaccount.models import SocialApp
from constance.test import override_config
from ddt import data, ddt, unpack
from django.core.exceptions import ValidationError

from kobo.apps.accounts.models import (
    SocialAppCustomData,
    SocialAppManagedDomain,
    validate_domain,
)
from kpi.tests.base_test_case import BaseTestCase


@ddt
class SocialAppManagedDomainTestCase(BaseTestCase):

    @data(
        # allow list, block list, domain, expect success
        (None, None, 'good.com', True),
        (None, None, 'bad', False),
        (None, 'bad.com\nworse.com', 'bad.com', False),
        (None, 'bad.com\nworse.com', 'bAD.cOm', False),
        (None, 'bad.com\nworse.com', 'good.com', True),
        ('good.com\nbetter.com', None, 'good.com', True),
        ('good.com\nbetter.com', None, 'gOOd.com', True),
        ('good.com\nbetter.com', None, 'bad.com', False),
    )
    @unpack
    def test_validate_domain(self, allow_list, block_list, domain, expect_success):
        with override_config(
            REGISTRATION_ALLOWED_EMAIL_DOMAINS=allow_list,
            REGISTRATION_BLACKLIST_EMAIL_DOMAINS=block_list,
        ):
            if not expect_success:
                with self.assertRaises(ValidationError):
                    validate_domain(domain)
            else:
                validate_domain(domain)

        validate_domain('good.com')
        with self.assertRaises(ValidationError):
            validate_domain('bad!')

    def test_constance_managed_sso_email_domains_signal_sync(self):
        app1 = SocialApp.objects.create(
            provider='google', name='Google', client_id='1', secret='s'
        )
        custom_data1 = SocialAppCustomData.objects.create(social_app=app1, managed=True)

        domain1 = SocialAppManagedDomain.objects.create(
            social_app=custom_data1, domain='example.com'
        )
        self.assertEqual(
            constance.config.REGISTRATION_SSO_MANAGED_EMAIL_DOMAINS, 'example.com'
        )

        SocialAppManagedDomain.objects.create(
                social_app=custom_data1, domain='alpha.com'
        )
        self.assertEqual(
            constance.config.REGISTRATION_SSO_MANAGED_EMAIL_DOMAINS,
            'alpha.com\nexample.com',
        )

        app2 = SocialApp.objects.create(
            provider='github', name='GitHub', client_id='2', secret='s'
        )
        custom_data2 = SocialAppCustomData.objects.create(
            social_app=app2, managed=False
        )
        SocialAppManagedDomain.objects.create(
            social_app=custom_data2, domain='unmanaged.com'
        )
        self.assertEqual(
            constance.config.REGISTRATION_SSO_MANAGED_EMAIL_DOMAINS,
            'alpha.com\nexample.com',
        )

        custom_data2.managed = True
        custom_data2.save()
        self.assertEqual(
            constance.config.REGISTRATION_SSO_MANAGED_EMAIL_DOMAINS,
            'alpha.com\nexample.com\nunmanaged.com',
        )

        domain1.delete()
        self.assertEqual(
            constance.config.REGISTRATION_SSO_MANAGED_EMAIL_DOMAINS,
            'alpha.com\nunmanaged.com',
        )
