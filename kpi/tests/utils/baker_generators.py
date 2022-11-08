import random

from model_bakery import baker
from model_bakery.random_gen import (
    gen_datetime,
    gen_integer,
    gen_related,
    gen_slug,
)

from kpi.fields.kpi_uid import KpiUidField

# Cause baker to be deterministic
random.seed(0)


def currency_code():
    return 'USD'


baker.generators.add('organizations.fields.SlugField', gen_slug)
baker.generators.add('djstripe.fields.StripeCurrencyCodeField', currency_code)
baker.generators.add('djstripe.fields.StripeIdField', gen_slug)
baker.generators.add('djstripe.fields.StripeDateTimeField', gen_datetime)
baker.generators.add(
    'djstripe.fields.StripeQuantumCurrencyAmountField', gen_integer
)
baker.generators.add('djstripe.fields.StripeForeignKey', gen_related)
baker.generators.add(
    'kpi.fields.kpi_uid.KpiUidField', KpiUidField.generate_unique_id
)
