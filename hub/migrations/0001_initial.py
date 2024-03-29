# coding: utf-8
from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='SitewideMessage',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('slug', models.CharField(max_length=50)),
                ('body', models.TextField()),
                ('_body_rendered', models.TextField(editable=False, blank=True)),
            ],
            options={
            },
            bases=(models.Model,),
        ),
    ]
