import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0011_emptyorganization'),
        ('project_ownership', '0008_transferstatuserror_level_and_verbose_names'),
    ]

    operations = [
        migrations.AddField(
            model_name='invite',
            name='metadata',
            field=models.JSONField(default=dict),
        ),
        migrations.AddField(
            model_name='invite',
            name='organization',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='ownership_transfers',
                to='organizations.organization',
            ),
        ),
        migrations.CreateModel(
            name='OrgOwnershipTransferInvite',
            fields=[],
            options={
                'verbose_name': 'organization ownership transfer invite',
                'proxy': True,
                'indexes': [],
                'constraints': [],
            },
            bases=('project_ownership.invite',),
        ),
    ]
