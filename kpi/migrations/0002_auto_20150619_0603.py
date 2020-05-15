# coding: utf-8
from django.db import models, migrations
import jsonfield.fields
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('kpi', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='AssetDeployment',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('asset_version_id', models.IntegerField()),
                ('xform_pk', models.IntegerField(null=True)),
                ('xform_id_string', models.CharField(max_length=100)),
                ('data', jsonfield.fields.JSONField()),
                ('uid', models.CharField(default='', max_length=22)),
                ('asset', models.ForeignKey(to='kpi.Asset', on_delete=models.CASCADE)),
                ('user', models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE)),
            ],
            options={
            },
            bases=(models.Model,),
        ),
        migrations.AddField(
            model_name='asset',
            name='summary',
            field=jsonfield.fields.JSONField(default=dict, null=True),
            preserve_default=True,
        ),
        migrations.AlterField(
            model_name='asset',
            name='asset_type',
            field=models.CharField(default='text', max_length=20, choices=[('text', 'text'), ('question', 'question'), ('block', 'block'), ('survey', 'survey'), ('empty', 'empty')]),
            preserve_default=True,
        ),
        migrations.AlterField(
            model_name='asset',
            name='parent',
            field=models.ForeignKey(related_name='assets', blank=True, to='kpi.Collection', null=True, on_delete=models.CASCADE),
            preserve_default=True,
        ),
        migrations.AlterField(
            model_name='asset',
            name='uid',
            field=models.CharField(default='', max_length=22, blank=True),
            preserve_default=True,
        ),
    ]
