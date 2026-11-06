import uuid

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('organizations', '0011_emptyorganization'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrganizationOwnershipTransfer',
            fields=[
                (
                    'id',
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                (
                    'guid',
                    models.UUIDField(
                        db_index=True,
                        default=uuid.uuid4,
                        editable=False,
                        unique=True,
                    ),
                ),
                (
                    'status',
                    models.CharField(
                        choices=[
                            ('accepted', 'Accepted'),
                            ('cancelled', 'Cancelled'),
                            ('declined', 'Declined'),
                            ('expired', 'Expired'),
                            ('pending', 'Pending'),
                            ('resent', 'Resent'),
                        ],
                        db_index=True,
                        default='pending',
                        max_length=11,
                    ),
                ),
                (
                    'billing_review_requested',
                    models.BooleanField(default=False),
                ),
                (
                    'created',
                    models.DateTimeField(
                        default=django.utils.timezone.now,
                        editable=False,
                    ),
                ),
                (
                    'modified',
                    models.DateTimeField(auto_now=True),
                ),
                (
                    'organization',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='ownership_transfers',
                        to='organizations.organization',
                    ),
                ),
                (
                    'recipient',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='received_organization_ownership_transfers',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'sender',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='sent_organization_ownership_transfers',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'ordering': ['-created'],
            },
        ),
        migrations.AddConstraint(
            model_name='organizationownershiptransfer',
            constraint=models.UniqueConstraint(
                condition=models.Q(('status', 'pending')),
                fields=('organization',),
                name='unique_pending_org_ownership_transfer',
            ),
        ),
    ]
