from django.core.management.base import BaseCommand
from django.apps import apps
from django.db import connection
from django.conf import settings
from django.utils import timezone


class Command(BaseCommand):
    help = 'Create optimized user_report materialized view without billing period dependencies.'

    MATVIEW_NAME = 'user_report_mv'

    def handle(self, *args, **options):
        # Get models
        User = apps.get_model('kobo_auth', 'User')
        XForm = apps.get_model('logger', 'XForm')
        DailyCounter = apps.get_model('logger', 'DailyXFormSubmissionCounter')
        NLP = apps.get_model('trackers', 'NLPUsageCounter')
        ExtraDetails = apps.get_model('hub', 'ExtraUserDetail')
        Asset = apps.get_model('kpi', 'Asset')
        OrgUser = apps.get_model('organizations', 'OrganizationUser')
        Organization = apps.get_model('organizations', 'Organization')
        EmailAddress = apps.get_model('account', 'EmailAddress')
        SocialAccount = apps.get_model('socialaccount', 'SocialAccount')

        # Optional djstripe models
        DjCustomer = None
        DjSubscription = None
        try:
            DjCustomer = apps.get_model('djstripe', 'Customer')
            DjSubscription = apps.get_model('djstripe', 'Subscription')
        except LookupError:
            self.stdout.write('djstripe not installed; subscriptions will be empty.')

        # Optional MFA model
        MFAMethod = None
        try:
            MFAMethod = apps.get_model('mfa', 'MFAMethod')
        except LookupError:
            self.stdout.write('MFA models not found; mfa_is_active will be false.')

        # Get table names
        user_table = User._meta.db_table
        xform_table = XForm._meta.db_table
        daily_counter_table = DailyCounter._meta.db_table
        nlp_table = NLP._meta.db_table
        ed_table = ExtraDetails._meta.db_table
        asset_table = Asset._meta.db_table
        org_user_table = OrgUser._meta.db_table
        org_table = Organization._meta.db_table
        ea_table = EmailAddress._meta.db_table
        sa_table = SocialAccount._meta.db_table

        self.stdout.write('Creating materialized view...')

        sql = f"""
        CREATE MATERIALIZED VIEW IF NOT EXISTS {self.MATVIEW_NAME} AS
        SELECT
            -- Basic user fields
            u.id AS user_id,
            u.username,
            u.first_name,
            u.last_name,
            u.email,
            u.is_superuser,
            u.is_staff,
            u.is_active,
            u.date_joined,
            u.last_login,

            -- Extra details
            ed.uid AS extra_details_uid,
            ed.data AS metadata,

            -- Boolean flags
            (ed.private_data ? 'last_tos_accept_time') AS accepted_tos,
            (ea.verified AND ea.primary) AS validated_email,
            COALESCE(ed.validated_password, false) AS validated_password,
            (EXISTS(SELECT 1 FROM {sa_table} sa WHERE sa.user_id = u.id)) AS sso_is_active,
            {f'''
            (EXISTS (
                SELECT 1
                FROM {MFAMethod._meta.db_table} mfa
                JOIN trench_mfamethod trench ON mfa.mfamethod_ptr_id = trench.id
                WHERE trench.user_id = u.id AND trench.is_active = true
            )) AS mfa_is_active,
            ''' if MFAMethod else 'false AS mfa_is_active,'}

            -- Social accounts as JSON array
            COALESCE(
                (SELECT jsonb_agg(
                    jsonb_build_object(
                        'provider', sa.provider,
                        'uid', sa.uid,
                        'last_login', sa.last_login,
                        'date_joined', sa.date_joined,
                        'extra_data', sa.extra_data
                    )
                ) FROM {sa_table} sa WHERE sa.user_id = u.id),
                '[]'::jsonb
            ) AS social_accounts,

            -- Asset counts
            COALESCE(ac.total_assets, 0) AS asset_count,
            COALESCE(ac.deployed_assets, 0) AS deployed_asset_count,

            -- Storage usage (organization-agnostic)
            COALESCE(xb.total_storage_bytes, 0) AS total_storage_bytes,

            -- ALL-TIME totals (no billing period dependency)
            COALESCE(subs.all_time_submissions, 0) AS submission_counts_all_time,
            COALESCE(nlp.asr_seconds_all_time, 0) AS nlp_usage_asr_seconds_all_time,
            COALESCE(nlp.mt_characters_all_time, 0) AS nlp_usage_mt_characters_all_time,

            -- Organization data
            ou.organization_id,
            org.name AS organization_name,
            org.id::text AS organization_uid,
            COALESCE(ou.is_admin, false) AS is_org_admin,
            ed.data->>'organization_type' AS metadata_organization_type,

            -- Subscriptions as JSON
            COALESCE(subs_json.subscriptions_json, '[]'::jsonb) AS subscriptions,

            -- Refresh timestamp
            now() AS last_refresh

        FROM {user_table} u

        -- Extra details
        LEFT JOIN {ed_table} ed ON ed.user_id = u.id

        -- Email validation
        LEFT JOIN {ea_table} ea ON ea.user_id = u.id AND ea.primary = true

        -- Storage calculation (organization-agnostic)
        LEFT JOIN (
            SELECT
                x.user_id,
                SUM(COALESCE(x.attachment_storage_bytes, 0)) AS total_storage_bytes
            FROM {xform_table} x
            WHERE COALESCE(x.pending_delete, false) = false
            GROUP BY x.user_id
        ) xb ON xb.user_id = u.id

        -- ALL-TIME submission counts (no period filtering)
        LEFT JOIN (
            SELECT
                user_id,
                SUM(counter) AS all_time_submissions
            FROM {daily_counter_table}
            GROUP BY user_id
        ) subs ON subs.user_id = u.id

        -- ALL-TIME NLP usage (no period filtering)
        LEFT JOIN (
            SELECT
                user_id,
                SUM(total_asr_seconds) AS asr_seconds_all_time,
                SUM(total_mt_characters) AS mt_characters_all_time
            FROM {nlp_table}
            GROUP BY user_id
        ) nlp ON nlp.user_id = u.id

        -- Asset counts
        LEFT JOIN (
            SELECT
                owner_id AS user_id,
                COUNT(*) AS total_assets,
                SUM(CASE WHEN _deployment_status = 'deployed' THEN 1 ELSE 0 END)::int AS deployed_assets
            FROM {asset_table}
            WHERE asset_type IS NOT NULL
            GROUP BY owner_id
        ) ac ON ac.user_id = u.id

        -- Organization membership
        LEFT JOIN {org_user_table} ou ON ou.user_id = u.id
        LEFT JOIN {org_table} org ON org.id = ou.organization_id
        """

        # Add djstripe subscriptions if available
        if DjCustomer and DjSubscription:
            sql += f"""
            -- Subscriptions from djstripe
            LEFT JOIN (
                SELECT
                    c.subscriber_id::int AS user_id,
                    jsonb_agg(
                        jsonb_build_object(
                            'id', s.id,
                            'status', s.status,
                            'current_period_start', s.current_period_start,
                            'current_period_end', s.current_period_end,
                            'created', s.created,
                            'plan', jsonb_build_object(
                                'id', p.id,
                                'nickname', p.nickname,
                                'amount', p.amount,
                                'currency', p.currency,
                                'interval', p.interval
                            )
                        ) ORDER BY s.current_period_end DESC
                    ) AS subscriptions_json
                FROM {DjCustomer._meta.db_table} c
                JOIN {DjSubscription._meta.db_table} s ON s.customer_id = c.id
                LEFT JOIN djstripe_plan p ON p.id = s.plan_id::varchar
                WHERE s.status IN ('active', 'trialing', 'past_due')
                GROUP BY c.subscriber_id
            ) subs_json ON subs_json.user_id = u.id
            """
        else:
            sql += """
            -- No djstripe, empty subscriptions
            LEFT JOIN (
                SELECT NULL::int as user_id, '[]'::jsonb as subscriptions_json
                WHERE false
            ) subs_json ON subs_json.user_id = u.id
            """

        # Execute the materialized view creation
        with connection.cursor() as cur:
            self.stdout.write('Dropping existing materialized view if exists...')
            cur.execute(f'DROP MATERIALIZED VIEW IF EXISTS {self.MATVIEW_NAME} CASCADE;')

            self.stdout.write('Creating materialized view...')
            cur.execute(sql)

            # Create indexes for performance
            self.stdout.write('Creating indexes...')

            # Primary index
            cur.execute(f'CREATE UNIQUE INDEX {self.MATVIEW_NAME}_user_id_idx ON {self.MATVIEW_NAME} (user_id);')

            # Filtering indexes based on requirements
            cur.execute(
                f'CREATE INDEX {self.MATVIEW_NAME}_storage_bytes_idx ON {self.MATVIEW_NAME} (total_storage_bytes);'
            )
            cur.execute(f'CREATE INDEX {self.MATVIEW_NAME}_date_joined_idx ON {self.MATVIEW_NAME} (date_joined);')
            cur.execute(f'CREATE INDEX {self.MATVIEW_NAME}_last_login_idx ON {self.MATVIEW_NAME} (last_login);')
            cur.execute(f'CREATE INDEX {self.MATVIEW_NAME}_email_idx ON {self.MATVIEW_NAME} (email);')
            cur.execute(f'CREATE INDEX {self.MATVIEW_NAME}_org_id_idx ON {self.MATVIEW_NAME} (organization_id);')

            # JSONB indexes for complex filtering
            cur.execute(
                f'CREATE INDEX {self.MATVIEW_NAME}_subscriptions_gin ON {self.MATVIEW_NAME} USING gin (subscriptions);')
            cur.execute(
                f'CREATE INDEX {self.MATVIEW_NAME}_org_type_idx ON {self.MATVIEW_NAME} (metadata_organization_type);')

            # Composite indexes for common patterns
            cur.execute(
                f'CREATE INDEX {self.MATVIEW_NAME}_org_storage_idx ON {self.MATVIEW_NAME} (organization_id, total_storage_bytes);')
            cur.execute(
                f'CREATE INDEX {self.MATVIEW_NAME}_active_users_idx ON {self.MATVIEW_NAME} (is_active, date_joined);')

            self.stdout.write(self.style.SUCCESS('Materialized view created successfully!'))
            self.stdout.write('This view contains organization-agnostic data.')
            self.stdout.write('Current period calculations will be done at query time.')
            self.stdout.write('To refresh: python manage.py refresh_user_report_mv')
