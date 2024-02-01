# coding: utf-8
from django.db import migrations, models
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='tokenstoragemodel',
            name='id',
            field=models.OneToOneField(related_name='google_id', primary_key=True, serialize=False, to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE),
        ),
    ]
