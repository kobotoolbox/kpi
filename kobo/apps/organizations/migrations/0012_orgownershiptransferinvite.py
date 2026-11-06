from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0011_emptyorganization'),
        ('project_ownership', '0010_unique_pending_org_ownership_transfer'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrgOwnershipTransferInvite',
            fields=[],
            options={
                'proxy': True,
                'indexes': [],
                'constraints': [],
            },
            bases=('project_ownership.invite',),
        ),
    ]
