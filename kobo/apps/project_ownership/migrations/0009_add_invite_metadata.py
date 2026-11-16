from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('project_ownership', '0008_transferstatuserror_level_and_verbose_names'),
    ]

    operations = [
        migrations.AlterField(
            model_name='invite',
            name='invite_type',
            field=models.CharField(
                choices=[
                    ('org-membership', 'Org Membership'),
                    ('org-ownership-transfer', 'Org Ownership Transfer'),
                    ('user-ownership-transfer', 'User Ownership Transfer'),
                ],
                default='user-ownership-transfer',
                max_length=30,
            ),
        ),
        migrations.AlterField(
            model_name='transfer',
            name='invite_type',
            field=models.CharField(
                choices=[
                    ('org-membership', 'Org Membership'),
                    ('org-ownership-transfer', 'Org Ownership Transfer'),
                    ('user-ownership-transfer', 'User Ownership Transfer'),
                ],
                default='user-ownership-transfer',
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name='invite',
            name='metadata',
            field=models.JSONField(default=dict),
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
