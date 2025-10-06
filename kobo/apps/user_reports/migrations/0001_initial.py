from django.db import migrations, models
from django.db.models import Q

import kpi.models.abstract_models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='BillingAndUsageSnapshotRun',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID'
                    )
                ),
                ('uid', kpi.fields.kpi_uid.KpiUidField(_null=False, uid_prefix='busr')),
                (
                    'status',
                    models.CharField(
                        choices=[
                            ('in_progress', 'IN_PROGRESS'),
                            ('completed', 'COMPLETED'),
                            ('aborted', 'ABORTED')
                        ],
                        default='in_progress',
                        max_length=32
                    )
                ),
                ('last_processed_org_id', models.CharField(blank=True, null=True)),
                ('details', models.JSONField(blank=True, null=True)),
                ('singleton', models.BooleanField(default=True, editable=False)),
                (
                    'date_created',
                    models.DateTimeField(
                        default=kpi.models.abstract_models._get_default_datetime
                    ),
                ),
                (
                    'date_modified',
                    models.DateTimeField(
                        default=kpi.models.abstract_models._get_default_datetime
                    ),
                ),
            ],
            options={
                'db_table': 'billing_and_usage_snapshot_run',
                'ordering': ['-date_created'],
            },
        ),
        migrations.CreateModel(
            name='BillingAndUsageSnapshot',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID'
                    )
                ),
                (
                    'effective_user_id',
                    models.IntegerField(blank=True, null=True, db_index=True)
                ),
                (
                    'last_snapshot_run',
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        to='user_reports.billingandusagesnapshotrun',
                    ),
                ),
                (
                    'organization',
                    models.OneToOneField(
                        on_delete=models.deletion.CASCADE,
                        to='organizations.organization',
                    ),
                ),
                ('storage_bytes_total', models.BigIntegerField(default=0)),
                ('submission_counts_all_time', models.BigIntegerField(default=0)),
                ('current_period_submissions', models.BigIntegerField(default=0)),
                ('billing_period_start', models.DateTimeField(blank=True, null=True)),
                ('billing_period_end', models.DateTimeField(blank=True, null=True)),
                (
                    'date_created',
                    models.DateTimeField(
                        default=kpi.models.abstract_models._get_default_datetime
                    ),
                ),
                (
                    'date_modified',
                    models.DateTimeField(
                        default=kpi.models.abstract_models._get_default_datetime
                    ),
                ),
            ],
            options={
                'db_table': 'billing_and_usage_snapshot',
            },
        ),
        migrations.AddIndex(
            model_name='billingandusagesnapshot',
            index=models.Index(fields=['effective_user_id'], name='idx_bau_user'),
        ),
        migrations.AddIndex(
            model_name='billingandusagesnapshot',
            index=models.Index(fields=['date_created'], name='idx_bau_created'),
        ),
        # Add index for runs
        migrations.AddIndex(
            model_name='billingandusagesnapshotrun',
            index=models.Index(
                fields=['status', 'date_modified'],
                name='idx_bau_run_status_expires'
            ),
        ),
        migrations.AddConstraint(
            model_name='billingandusagesnapshotrun',
            constraint=models.UniqueConstraint(
                fields=('singleton',),
                condition=Q(status='in_progress'),
                name='uniq_run_in_progress'
            ),
        ),
        migrations.AddConstraint(
            model_name='billingandusagesnapshot',
            constraint=models.UniqueConstraint(
                fields=('organization',),
                name='uniq_snapshot_per_org'
            ),
        ),
    ]
