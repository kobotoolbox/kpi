# coding: utf-8
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='CorsModel',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('cors', models.CharField(help_text='do not include http:// or https://', max_length=255)),
            ],
            options={
                'verbose_name': 'allowed CORS origin',
            },
        ),
    ]
