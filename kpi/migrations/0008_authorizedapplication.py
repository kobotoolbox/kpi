# coding: utf-8
from functools import partial
from secrets import token_urlsafe

from django.db import models, migrations
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0007_importtask_defaults'),
    ]

    operations = [
        migrations.CreateModel(
            name='AuthorizedApplication',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('name', models.CharField(max_length=50)),
                ('key', models.CharField(default=partial(token_urlsafe, nbytes=45), max_length=60, validators=[django.core.validators.MinLengthValidator(60)])),
            ],
            options={
            },
            bases=(models.Model,),
        ),
    ]
