# -*- coding: utf-8 -*-
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('auth', '0006_require_contenttypes_0002'),
        ('guardian', '0001_initial'),
        ('api', '0001_initial'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='organizationprofile',
            name='creator',
        ),
        migrations.RemoveField(
            model_name='organizationprofile',
            name='userprofile_ptr',
        ),
        migrations.AlterUniqueTogether(
            name='project',
            unique_together=set([]),
        ),
        migrations.RemoveField(
            model_name='project',
            name='created_by',
        ),
        migrations.RemoveField(
            model_name='project',
            name='organization',
        ),
        migrations.RemoveField(
            model_name='project',
            name='tags',
        ),
        migrations.RemoveField(
            model_name='project',
            name='user_stars',
        ),
        migrations.AlterUniqueTogether(
            name='projectxform',
            unique_together=set([]),
        ),
        migrations.RemoveField(
            model_name='projectxform',
            name='created_by',
        ),
        migrations.RemoveField(
            model_name='projectxform',
            name='project',
        ),
        migrations.RemoveField(
            model_name='projectxform',
            name='xform',
        ),
        migrations.RemoveField(
            model_name='team',
            name='created_by',
        ),
        migrations.RemoveField(
            model_name='team',
            name='group_ptr',
        ),
        migrations.RemoveField(
            model_name='team',
            name='organization',
        ),
        migrations.RemoveField(
            model_name='team',
            name='projects',
        ),
        migrations.DeleteModel(
            name='OrganizationProfile',
        ),
        migrations.DeleteModel(
            name='Project',
        ),
        migrations.DeleteModel(
            name='ProjectXForm',
        ),
        migrations.DeleteModel(
            name='Team',
        ),
    ]
