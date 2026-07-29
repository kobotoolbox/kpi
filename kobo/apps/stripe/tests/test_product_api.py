from django.shortcuts import reverse
from djstripe.enums import BillingScheme
from model_bakery import baker

from kpi.tests.kpi_test_case import BaseTestCase


class ProductAPITestCase(BaseTestCase):
    def test_product_list(self):
        price = baker.make(
            'djstripe.Price',
            billing_scheme=BillingScheme.per_unit,
            livemode=False,
            active=True,
            product__active=True,
            product__livemode=False,
        )
        inactive_price = baker.make(
            'djstripe.Price',
            billing_scheme=BillingScheme.per_unit,
            livemode=False,
            active=False,
            product__active=False,
            product__livemode=False,
        )
        res = self.client.get(reverse('product-list'))
        self.assertContains(res, price.id)
        self.assertNotContains(res, inactive_price.id)
