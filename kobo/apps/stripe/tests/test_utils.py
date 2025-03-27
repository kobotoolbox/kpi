from djstripe.models import Product, Price
from model_bakery import baker

from kobo.apps.stripe.utils import get_default_plan_name
from kpi.tests.kpi_test_case import BaseTestCase


class UtilsTestCase(BaseTestCase):
    def test_get_default_plan_name(self):
        product = baker.prepare(
            Product,
            metadata={'product_type': 'plan', 'default_free_plan': 'true'},
            active=True,
            name='Test Community Plan',
        )
        product.save()
        price = baker.make(
            Price,
            active=True,
            id='price_1LsSOSAR39rDI89svTKog9Hq',
            product=product,
            metadata={'max_purchase_quantity': '3'},
        )

        assert get_default_plan_name() == product.name
