# coding: utf-8
from django.contrib.postgres.fields import JSONField as JSONBField
from django.conf import settings
from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('kpi', '0022_assetfile'),
    ]

    operations = [
        migrations.CreateModel(
            name='AssetUserPartialPermission',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('permissions', JSONBField(default=dict)),
                ('date_created', models.DateTimeField(default=django.utils.timezone.now)),
                ('date_modified', models.DateTimeField(default=django.utils.timezone.now)),
            ],
        ),
        migrations.AlterModelOptions(
            name='asset',
            options={'ordering': ('-date_modified',), 'permissions': (('view_asset', 'Can view asset'), ('share_asset', "Can change asset's sharing settings"), ('add_submissions', 'Can submit data to asset'), ('view_submissions', 'Can view submitted data for asset'), ('partial_submissions', 'Can make partial actions on submitted data for asset for specific users'), ('change_submissions', 'Can modify submitted data for asset'), ('delete_submissions', 'Can delete submitted data for asset'), ('share_submissions', "Can change sharing settings for asset's submitted data"), ('validate_submissions', 'Can validate submitted data asset'), ('from_kc_only', 'INTERNAL USE ONLY; DO NOT ASSIGN'))},
        ),
        migrations.AddField(
            model_name='assetuserpartialpermission',
            name='asset',
            field=models.ForeignKey(related_name='asset_partial_permissions', to='kpi.Asset', on_delete=models.CASCADE),
        ),
        migrations.AddField(
            model_name='assetuserpartialpermission',
            name='user',
            field=models.ForeignKey(related_name='user_partial_permissions', to=settings.AUTH_USER_MODEL,
                                    on_delete=models.CASCADE),
        ),
        migrations.AlterUniqueTogether(
            name='assetuserpartialpermission',
            unique_together=set([('asset', 'user')]),
        ),
    ]
