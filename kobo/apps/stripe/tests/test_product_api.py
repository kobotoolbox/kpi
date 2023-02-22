from django.shortcuts import reverse
from model_bakery import baker

from kpi.tests.kpi_test_case import BaseTestCase


class ProductAPITestCase(BaseTestCase):
    def test_product_list(self):
        plan = baker.make(
            "djstripe.Plan",
            amount=0,
            livemode=False,
            active=True,
            product__active=True,
            product__livemode=False,
        )
        inactive_plan = baker.make(
            "djstripe.Plan",
            amount=0,
            livemode=False,
            active=False,
            product__active=False,
            product__livemode=False,
        )
        res = self.client.get(reverse("product-list"))
        self.assertContains(res, plan.id)
        self.assertNotContains(res, inactive_plan.id)
