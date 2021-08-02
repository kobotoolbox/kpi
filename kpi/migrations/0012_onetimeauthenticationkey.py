# coding: utf-8
from functools import partial
from secrets import token_urlsafe

from django.db import migrations, models
import kpi.models.authorized_application
import django.core.validators
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('kpi', '0011_explode_asset_deployments'),
    ]

    operations = [
        migrations.CreateModel(
            name='OneTimeAuthenticationKey',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('key', models.CharField(default=partial(token_urlsafe, nbytes=45), max_length=60, validators=[django.core.validators.MinLengthValidator(60)])),
                ('expiry', models.DateTimeField(default=kpi.models.authorized_application.ten_minutes_from_now)),
                ('user', models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE)),
            ],
        ),
    ]
