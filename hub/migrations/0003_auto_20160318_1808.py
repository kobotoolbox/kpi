# coding: utf-8
import jsonfield.fields
from django.conf import settings
from django.db import migrations, models


def create_extrauserdetails(apps, schema_editor):
    ExtraUserDetail = apps.get_model('hub', 'ExtraUserDetail')
    User = apps.get_model('auth', 'User')
    for user in User.objects.all():
        ExtraUserDetail.objects.get_or_create(user=user)


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('hub', '0002_formbuilderpreference'),
    ]

    operations = [
        migrations.CreateModel(
            name='ExtraUserDetail',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('data', jsonfield.fields.JSONField(default=dict)),
                ('user', models.OneToOneField(related_name='extra_details',
                                              to=settings.AUTH_USER_MODEL,
                                              on_delete=models.CASCADE)),
            ],
        ),
        migrations.AlterField(
            model_name='formbuilderpreference',
            name='preferred_builder',
            field=models.CharField(default='K', max_length=1, choices=[('K', 'kpi'), ('D', 'dkobo')]),
        ),
        migrations.RunPython(create_extrauserdetails),
    ]
