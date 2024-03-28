# coding: utf-8
import jsonfield.fields
import taggit.managers
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('logger', '0001_initial'),
        ('taggit', '0002_auto_20150616_2121'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('auth', '0006_require_contenttypes_0002'),
        ('main', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrganizationProfile',
            fields=[
                ('userprofile_ptr', models.OneToOneField(parent_link=True, auto_created=True, primary_key=True, serialize=False, to='main.UserProfile', on_delete=models.CASCADE)),
                ('is_organization', models.BooleanField(default=True)),
                ('creator', models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE)),
            ],
            options={
                'permissions': (('can_add_xform', 'Can add/upload an xform to organization'), ('view_organizationprofile', 'Can view organization profile')),
            },
            bases=('main.userprofile',),
        ),
        migrations.CreateModel(
            name='Project',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('name', models.CharField(max_length=255)),
                ('metadata', jsonfield.fields.JSONField(blank=True)),
                ('shared', models.BooleanField(default=False)),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('date_modified', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(related_name='project_creator', to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE)),
                ('organization', models.ForeignKey(related_name='project_organization', to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE)),
                ('tags', taggit.managers.TaggableManager(to='taggit.Tag', through='taggit.TaggedItem', help_text='A comma-separated list of tags.', verbose_name='Tags')),
                ('user_stars', models.ManyToManyField(to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'permissions': (('view_project', 'Can view project'), ('add_xform', 'Can add xform to project'), ('transfer_project', 'Can transfer project to different owner')),
            },
        ),
        migrations.CreateModel(
            name='ProjectXForm',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('created_by', models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE)),
                ('project', models.ForeignKey(to='api.Project', on_delete=models.CASCADE)),
                ('xform', models.ForeignKey(to='logger.XForm', on_delete=models.CASCADE)),
            ],
        ),
        migrations.CreateModel(
            name='Team',
            fields=[
                ('group_ptr', models.OneToOneField(parent_link=True, auto_created=True, primary_key=True, serialize=False, to='auth.Group', on_delete=models.CASCADE)),
                ('date_created', models.DateTimeField(auto_now_add=True, null=True)),
                ('date_modified', models.DateTimeField(auto_now=True, null=True)),
                ('created_by', models.ForeignKey(related_name='team_creator', blank=True, to=settings.AUTH_USER_MODEL, null=True, on_delete=models.CASCADE)),
                ('organization', models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE)),
                ('projects', models.ManyToManyField(to='api.Project')),
            ],
            options={
                'permissions': (('view_team', 'Can view team.'),),
            },
            bases=('auth.group',),
        ),
        migrations.AlterUniqueTogether(
            name='projectxform',
            unique_together=set([('xform', 'project')]),
        ),
        migrations.AlterUniqueTogether(
            name='project',
            unique_together=set([('name', 'organization')]),
        ),
    ]
