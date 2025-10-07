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
                            ('in_progress', 'In Progress'),
                            ('completed', 'Completed'),
                            ('aborted', 'Aborted')
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
                        related_name='snapshots',
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
        # Register the materialized-view model state (unmanaged) so Django knows
        # the model exists for ORM queries, but doesn't try to create a migration
        # file for it. The actual materialized view is created by the subsequent
        # migration `0002_create_user_reports_mv.py`.
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.CreateModel(
                    name='UserReports',
                    fields=[
                        (
                            'id',
                            models.BigIntegerField(primary_key=True, serialize=False)
                        ),
                        (
                            'extra_details_uid',
                            models.CharField(max_length=255, null=True, blank=True)
                        ),
                        ('username', models.CharField(max_length=150)),
                        ('first_name', models.CharField(max_length=150)),
                        ('last_name', models.CharField(max_length=150)),
                        ('email', models.CharField(max_length=254)),
                        ('is_superuser', models.BooleanField()),
                        ('is_staff', models.BooleanField()),
                        ('is_active', models.BooleanField()),
                        ('date_joined', models.CharField(max_length=64)),
                        (
                            'last_login',
                            models.CharField(max_length=64, null=True, blank=True)
                        ),
                        ('validated_email', models.BooleanField()),
                        ('validated_password', models.BooleanField()),
                        ('mfa_is_active', models.BooleanField()),
                        ('sso_is_active', models.BooleanField()),
                        ('accepted_tos', models.BooleanField()),
                        ('social_accounts', models.JSONField(null=True, blank=True)),
                        ('organizations', models.JSONField(null=True, blank=True)),
                        ('metadata', models.JSONField(null=True, blank=True)),
                        ('subscriptions', models.JSONField(null=True, blank=True)),
                        ('storage_bytes_total', models.BigIntegerField(default=0)),
                        (
                            'submission_counts_all_time',
                            models.BigIntegerField(default=0)
                        ),
                        (
                            'nlp_usage_asr_seconds_total',
                            models.BigIntegerField(default=0)
                        ),
                        (
                            'nlp_usage_mt_characters_total',
                            models.BigIntegerField(default=0)
                        ),
                        ('asset_count', models.IntegerField(default=0)),
                        ('deployed_asset_count', models.IntegerField(default=0)),
                        (
                            'current_period_start',
                            models.DateTimeField(null=True, blank=True)
                        ),
                        (
                            'current_period_end',
                            models.DateTimeField(null=True, blank=True)
                        ),
                        (
                            'current_period_submissions',
                            models.BigIntegerField(default=0)
                        ),
                        ('current_period_asr', models.BigIntegerField(default=0)),
                        ('current_period_mt', models.BigIntegerField(default=0)),
                        (
                            'organization_id',
                            models.IntegerField(null=True, blank=True)
                        ),
                    ],
                    options={
                        'managed': False,
                        'db_table': 'user_reports_mv',
                    },
                ),
            ],
        ),
    ]
