# flake8: noqa: E501
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0012_organizationownershiptransfer'),
    ]

    operations = [
        migrations.AlterField(
            model_name='organizationinvitation',
            name='status',
            field=models.CharField(
                choices=[
                    ('accepted', 'Accepted'),
                    ('cancelled', 'Cancelled'),
                    ('complete', 'Complete'),
                    ('declined', 'Declined'),
                    ('expired', 'Expired'),
                    ('failed', 'Failed'),
                    ('in_progress', 'In Progress'),
                    ('pending', 'Pending'),
                    ('resent', 'Resent'),
                ],
                default='pending',
                max_length=11,
            ),
        ),
        migrations.AlterField(
            model_name='organizationownershiptransfer',
            name='status',
            field=models.CharField(
                choices=[
                    ('accepted', 'Accepted'),
                    ('cancelled', 'Cancelled'),
                    ('complete', 'Complete'),
                    ('declined', 'Declined'),
                    ('expired', 'Expired'),
                    ('failed', 'Failed'),
                    ('in_progress', 'In Progress'),
                    ('pending', 'Pending'),
                    ('resent', 'Resent'),
                ],
                db_index=True,
                default='pending',
                max_length=11,
            ),
        ),
    ]
