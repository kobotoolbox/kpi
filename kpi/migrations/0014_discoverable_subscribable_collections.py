# coding: utf-8
from django.db import migrations, models
from django.conf import settings
import kpi.fields


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('kpi', '0013_uid_field'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserCollectionSubscription',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('uid', kpi.fields.KpiUidField(uid_prefix='b')),
            ],
        ),
        migrations.AddField(
            model_name='collection',
            name='discoverable_when_public',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='usercollectionsubscription',
            name='collection',
            field=models.ForeignKey(to='kpi.Collection', on_delete=models.CASCADE),
        ),
        migrations.AddField(
            model_name='usercollectionsubscription',
            name='user',
            field=models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE),
        ),
        migrations.AlterUniqueTogether(
            name='usercollectionsubscription',
            unique_together=set([('collection', 'user')]),
        ),
    ]
