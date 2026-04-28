"""
Ensure djstripe 2.10 migrations are applied.

djstripe 2.10 replaced all migrations (0002–0011_2_7) with a single
0002_2_10 migration without using Django's `replaces` mechanism.
This migration acts as a dependency bridge so that both fresh databases
and upgrades from older djstripe versions work correctly.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('stripe', '0004_alter_model_options'),
        ('djstripe', '0002_2_10'),
    ]

    operations = []
