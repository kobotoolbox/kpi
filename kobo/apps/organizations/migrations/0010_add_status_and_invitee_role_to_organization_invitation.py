# Generated by Django 4.2.15 on 2025-01-02 12:25

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0009_update_db_state_with_auth_user'),
    ]

    operations = [
        migrations.AddField(
            model_name='organizationinvitation',
            name='invitee_role',
            field=models.CharField(
                choices=[('admin', 'Admin'), ('member', 'Member')],
                default='member',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='organizationinvitation',
            name='status',
            field=models.CharField(
                choices=[
                    ('accepted', 'Accepted'),
                    ('cancelled', 'Cancelled'),
                    ('declined', 'Declined'),
                    ('expired', 'Expired'),
                    ('pending', 'Pending'),
                    ('resent', 'Resent'),
                ],
                default='pending',
                max_length=11,
            ),
        ),
    ]
