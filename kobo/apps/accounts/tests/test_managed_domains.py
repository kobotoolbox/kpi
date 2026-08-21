from constance.test import override_config
from ddt import data, ddt, unpack
from django.core.exceptions import ValidationError

from kobo.apps.accounts.models import (
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
