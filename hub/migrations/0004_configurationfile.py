# coding: utf-8
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hub', '0003_auto_20160318_1808'),
    ]

    operations = [
        migrations.CreateModel(
            name='ConfigurationFile',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('slug', models.CharField(unique=True, max_length=32, choices=[(b'logo', b'logo'), (b'logo_small', b'logo_small'), (b'login_background', b'login_background')])),
                ('content', models.FileField(upload_to=b'')),
            ],
        ),
    ]
