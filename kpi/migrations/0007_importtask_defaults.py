# coding: utf-8
from django.db import models, migrations
import jsonfield.fields


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0006_importtask_messages'),
    ]

    operations = [
        migrations.AlterField(
            model_name='importtask',
            name='messages',
            field=jsonfield.fields.JSONField(default=dict),
            preserve_default=True,
        ),
        migrations.AlterField(
            model_name='importtask',
            name='status',
            field=models.CharField(default='created', max_length=32, choices=[('created', 'created'), ('processing', 'processing'), ('error', 'error'), ('complete', 'complete')]),
            preserve_default=True,
        ),
    ]
