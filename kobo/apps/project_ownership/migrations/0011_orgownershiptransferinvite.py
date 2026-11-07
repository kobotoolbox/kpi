from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('project_ownership', '0010_unique_pending_org_ownership_transfer'),
    ]

    operations = [
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
