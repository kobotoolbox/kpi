from django.conf import settings
from django.db import migrations

CREATE_BILLING_AND_USAGE_SNAPSHOT_TABLE_SQL = """
    CREATE TABLE IF NOT EXISTS billing_and_usage_snapshot (
        id BIGSERIAL PRIMARY KEY,
        organization_id VARCHAR NOT NULL,
        effective_user_id INTEGER NULL,
        storage_bytes_total BIGINT NOT NULL DEFAULT 0,
        submission_counts_all_time BIGINT NOT NULL DEFAULT 0,
        current_period_submissions BIGINT NOT NULL DEFAULT 0,
        billing_period_start TIMESTAMPTZ,
        billing_period_end TIMESTAMPTZ,
        snapshot_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_snapshot_run_id UUID NULL
    );
    """

DROP_BILLING_AND_USAGE_SNAPSHOT_TABLE_SQL = """
    DROP TABLE IF EXISTS billing_and_usage_snapshot CASCADE;
    """

CREATE_BILLING_AND_USAGE_SNAPSHOT_INDEXES_SQL = """
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bau_org_unique
        ON billing_and_usage_snapshot (organization_id);
    CREATE INDEX IF NOT EXISTS idx_bau_user
        ON billing_and_usage_snapshot (effective_user_id);
    CREATE INDEX IF NOT EXISTS idx_bau_created
        ON billing_and_usage_snapshot (snapshot_created_at);
    CREATE INDEX IF NOT EXISTS idx_bau_last_run
        ON billing_and_usage_snapshot (last_snapshot_run_id);
    """

DROP_BILLING_AND_USAGE_SNAPSHOT_INDEXES_SQL = """
    DROP INDEX IF EXISTS idx_bau_org_unique;
    DROP INDEX IF EXISTS idx_bau_user;
    DROP INDEX IF EXISTS idx_bau_created;
    DROP INDEX IF EXISTS idx_bau_last_run;
    """

CREATE_MV_SQL = """
    CREATE MATERIALIZED VIEW user_reports_mv AS
    WITH user_nlp_usage AS (
        SELECT
            nuc.user_id,
            COALESCE(SUM(nuc.total_asr_seconds), 0) AS total_asr_seconds,
            COALESCE(SUM(nuc.total_mt_characters), 0) AS total_mt_characters
        FROM trackers_nlpusagecounter nuc
        GROUP BY nuc.user_id
    ),
    user_assets AS (
        SELECT
            a.owner_id as user_id,
            COUNT(*) as total_assets,
            COUNT(*) FILTER (WHERE a._deployment_status = 'deployed') as deployed_assets
        FROM kpi_asset a
        WHERE a.pending_delete = false
        GROUP BY a.owner_id
    ),
    user_role_map AS (
        SELECT
            au.id AS user_id,
            CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM organizations_organizationowner o
                    JOIN organizations_organizationuser ou_owner ON ou_owner.id = o.organization_user_id
                    WHERE ou_owner.user_id = au.id
                ) THEN 'owner'
                WHEN EXISTS (
                    SELECT 1 FROM organizations_organizationuser ou WHERE ou.user_id = au.id AND ou.is_admin IS TRUE
                ) THEN 'admin'
                WHEN EXISTS (
                    SELECT 1 FROM organizations_organizationuser ou WHERE ou.user_id = au.id
                ) THEN 'member'
                ELSE 'external'
            END AS user_role
        FROM auth_user au
    ),
    user_billing_periods AS (
        SELECT DISTINCT
            au.id as user_id,
            bus.billing_period_start AS current_period_start,
            bus.billing_period_end   AS current_period_end,
            bus.organization_id,
            COALESCE(bus.storage_bytes_total, 0) as storage_bytes_total,
            COALESCE(bus.submission_counts_all_time, 0) as submission_counts_all_time,
            COALESCE(bus.current_period_submissions, 0) as current_period_submissions
        FROM auth_user au
        LEFT JOIN organizations_organizationuser ou ON au.id = ou.user_id
        LEFT JOIN billing_and_usage_snapshot bus ON ou.organization_id = bus.organization_id
    ),
    nlp_period_agg AS (
        SELECT
            nuc.user_id,
            SUM(
                CASE WHEN nuc.date >= ubp.current_period_start AND nuc.date <= ubp.current_period_end
                     THEN nuc.total_asr_seconds ELSE 0 END
            ) AS current_period_asr,
            SUM(
                CASE WHEN nuc.date >= ubp.current_period_start AND nuc.date <= ubp.current_period_end
                     THEN nuc.total_mt_characters ELSE 0 END
            ) AS current_period_mt
        FROM trackers_nlpusagecounter nuc
        JOIN user_billing_periods ubp ON nuc.user_id = ubp.user_id
        GROUP BY nuc.user_id
    ),
    user_current_period_usage AS (
        SELECT
            ubp.user_id,
            ubp.current_period_start,
            ubp.current_period_end,
            ubp.organization_id,
            COALESCE(na.current_period_asr, 0) AS current_period_asr,
            COALESCE(na.current_period_mt, 0) AS current_period_mt
        FROM user_billing_periods ubp
        LEFT JOIN nlp_period_agg na ON ubp.user_id = na.user_id
    )
    SELECT
        au.id AS id,
        ued.uid AS extra_details_uid,
        au.username,
        au.first_name,
        au.last_name,
        au.email,
        au.is_superuser,
        au.is_staff,
        au.is_active,
        TO_CHAR(au.date_joined AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS date_joined,
        CASE
            WHEN au.last_login IS NOT NULL THEN TO_CHAR(au.last_login AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
            ELSE NULL
        END AS last_login,
        EXISTS (
            SELECT 1
            FROM account_emailaddress aea
            WHERE aea.user_id = au.id
            AND aea.primary = true
            AND aea.verified = true
        ) AS validated_email,
        ued.validated_password,
        EXISTS (
            SELECT 1
            FROM trench_mfamethod mfa
            WHERE mfa.user_id = au.id
            AND mfa.is_active = true
        ) AS mfa_is_active,
        EXISTS (
            SELECT 1
            FROM socialaccount_socialaccount sa
            WHERE sa.user_id = au.id
        ) AS sso_is_active,
        EXISTS (
            SELECT 1
            FROM hub_extrauserdetail ued_tos
            WHERE ued_tos.user_id = au.id
            AND ued_tos.private_data ? 'last_tos_accept_time'
        ) AS accepted_tos,
        COALESCE(
            jsonb_agg(
                json_build_object(
                    'id', sa.id,
                    'provider', sa.provider,
                    'uid', sa.uid
                )
            ) FILTER (WHERE sa.id IS NOT NULL),
            '[]'::jsonb
        )::text AS social_accounts,
        CASE
            WHEN org.id IS NOT NULL THEN json_build_object(
                'organization_name', org.name,
                'organization_uid', org.id::text,
                'role', ur.user_role
            )::text
            ELSE NULL
        END AS organizations,
        ued.data::text AS metadata,
        COALESCE(unl.total_asr_seconds, 0) AS nlp_usage_asr_seconds_total,
        COALESCE(unl.total_mt_characters, 0) AS nlp_usage_mt_characters_total,
        COALESCE(ua.total_assets, 0) AS asset_count,
        COALESCE(ua.deployed_assets, 0) AS deployed_asset_count,
        COALESCE(ucpu.current_period_asr, 0) AS current_period_asr,
        COALESCE(ucpu.current_period_mt, 0) AS current_period_mt,
        ucpu.current_period_start,
        ucpu.current_period_end,
        ucpu.organization_id,
        ubau.storage_bytes_total,
        ubau.submission_counts_all_time,
        ubau.current_period_submissions,
        COALESCE(
            jsonb_agg(
                json_build_object(
                    'items', (
                        SELECT jsonb_agg(
                            json_build_object(
                                'id', si.id,
                                'price', json_build_object(
                                    'id', pr.id,
                                    'nickname', pr.nickname,
                                    'currency', pr.currency,
                                    'type', pr.type,
                                    'recurring', pr.recurring,
                                    'unit_amount', pr.unit_amount,
                                    'human_readable_price',
                                    CASE
                                        WHEN pr.recurring IS NOT NULL THEN
                                            CONCAT(
                                                TO_CHAR(pr.unit_amount::numeric / 100, 'FM$999,999.00'),
                                                ' USD/',
                                                pr.recurring->>'interval'
                                            )
                                        ELSE
                                            TO_CHAR(pr.unit_amount::numeric / 100, 'FM$999,999.00')
                                    END,
                                    'metadata', pr.metadata,
                                    'active', pr.active,
                                    'product', json_build_object(
                                        'id', prod.id,
                                        'name', prod.name,
                                        'description', prod.description,
                                        'type', prod.type,
                                        'metadata', prod.metadata
                                    ),
                                    'transform_quantity', pr.transform_quantity
                                ),
                                'quantity', si.quantity
                            )
                        )
                        FROM djstripe_subscriptionitem si
                        JOIN djstripe_price pr ON si.price_id = pr.djstripe_id
                        JOIN djstripe_product prod ON pr.product_id = prod.id
                        WHERE si.subscription_id = sub.id
                    ),
                    'schedule', sub.schedule_id,
                    'djstripe_created', sub.djstripe_created,
                    'djstripe_updated', sub.djstripe_updated,
                    'id', sub.id,
                    'livemode', sub.livemode,
                    'created', sub.created,
                    'metadata', sub.metadata,
                    'description', sub.description,
                    'application_fee_percent', sub.application_fee_percent,
                    'billing_cycle_anchor', sub.billing_cycle_anchor,
                    'billing_thresholds', sub.billing_thresholds,
                    'cancel_at', sub.cancel_at,
                    'cancel_at_period_end', sub.cancel_at_period_end,
                    'canceled_at', sub.canceled_at,
                    'collection_method', sub.collection_method,
                    'current_period_start', sub.current_period_start,
                    'current_period_end', sub.current_period_end,
                    'days_until_due', sub.days_until_due,
                    'discount', sub.discount,
                    'ended_at', sub.ended_at,
                    'next_pending_invoice_item_invoice', sub.next_pending_invoice_item_invoice,
                    'pause_collection', sub.pause_collection,
                    'pending_invoice_item_interval', sub.pending_invoice_item_interval,
                    'pending_update', sub.pending_update,
                    'proration_behavior', sub.proration_behavior,
                    'proration_date', sub.proration_date,
                    'quantity', sub.quantity,
                    'start_date', sub.start_date,
                    'status', sub.status,
                    'trial_end', sub.trial_end,
                    'trial_start', sub.trial_start,
                    'djstripe_owner_account', sub.djstripe_owner_account_id,
                    'customer', cust.id,
                    'default_payment_method', sub.default_payment_method_id,
                    'default_source', sub.default_source_id,
                    'latest_invoice', sub.latest_invoice_id,
                    'pending_setup_intent', sub.pending_setup_intent_id,
                    'plan', sub.plan_id,
                    'default_tax_rates', (
                        SELECT
                            COALESCE(
                                jsonb_agg(
                                    jsonb_build_object(
                                        'id', tax.id,
                                        'djstripe_id', tax.djstripe_id,
                                        'description', tax.description,
                                        'display_name', tax.display_name,
                                        'inclusive', tax.inclusive,
                                        'jurisdiction', tax.jurisdiction,
                                        'percentage', tax.percentage,
                                        'tax_type', tax.tax_type,
                                        'active', tax.active,
                                        'country', tax.country,
                                        'state', tax.state
                                    )
                                ) FILTER (WHERE tax.id IS NOT NULL),
                                '[]'::jsonb
                            )
                        FROM
                            djstripe_djstripesubscriptiondefaulttaxrate AS sub_tax_rate
                        JOIN
                            djstripe_taxrate AS tax
                            ON sub_tax_rate.taxrate_id = tax.djstripe_id
                        WHERE
                            sub_tax_rate.subscription_id::text = sub.id::text
                    )
                )
            ) FILTER (WHERE sub.id IS NOT NULL),
            '[]'::jsonb
        )::text AS subscriptions
    FROM auth_user au
    LEFT JOIN organizations_organizationuser ou ON au.id = ou.user_id
    LEFT JOIN organizations_organization org ON ou.organization_id = org.id
    LEFT JOIN djstripe_subscription sub ON sub.metadata->>'organization_id' = org.id::text
    LEFT JOIN djstripe_customer cust ON sub.customer_id = cust.id
    LEFT JOIN hub_extrauserdetail ued ON au.id = ued.user_id
    LEFT JOIN socialaccount_socialaccount sa ON au.id = sa.user_id
    LEFT JOIN user_nlp_usage unl ON au.id = unl.user_id
    LEFT JOIN user_assets ua ON au.id = ua.user_id
    LEFT JOIN user_role_map ur ON ur.user_id = au.id
    LEFT JOIN user_current_period_usage ucpu ON au.id = ucpu.user_id
    LEFT JOIN user_billing_periods ubau ON au.id = ubau.user_id
    GROUP BY
        au.id,
        au.username,
        au.first_name,
        au.last_name,
        au.email,
        au.is_superuser,
        au.is_staff,
        au.is_active,
        ued.uid,
        ued.validated_password,
        ued.data,
        org.id,
        org.name,
        au.date_joined,
        au.last_login,
        unl.total_asr_seconds,
        unl.total_mt_characters,
        ua.total_assets,
        ua.deployed_assets,
        ur.user_role,
        ucpu.current_period_start,
        ucpu.current_period_end,
        ucpu.current_period_asr,
        ucpu.current_period_mt,
        ucpu.organization_id,
        ubau.storage_bytes_total,
        ubau.submission_counts_all_time,
        ubau.current_period_submissions;
    """

DROP_MV_SQL = """
    DROP MATERIALIZED VIEW IF EXISTS user_reports_mv;
    """

CREATE_INDEX_SQL = """
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_user_reports_mv_id ON user_reports_mv (id);
    """
DROP_INDEX_SQL = """
    DROP INDEX IF EXISTS idx_user_reports_mv_id;
    """


def manually_create_mv_instructions(apps, schema_editor):
    print(
        """
        ⚠️ ATTENTION ⚠️
        Run the SQL query below in PostgreSQL directly to create the materialized view:

        {CREATE_MV_SQL}

        Once the materialized view is created, you may need to refresh it periodically with:
        REFRESH MATERIALIZED VIEW CONCURRENTLY user_reports_mv;
        """
    )


def manually_drop_mv_instructions(apps, schema_editor):
    print(
        """
        ⚠️ ATTENTION ⚠️
        Run the SQL query below in PostgreSQL directly:

        {DROP_MV_SQL}

        """
    )


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('trackers', '0005_remove_year_and_month'),
        ('mfa', '0004_alter_mfamethod_date_created_and_more'),
        ('kpi', '0069_alter_assetversion_reversion_version'),
    ]

    if settings.SKIP_HEAVY_MIGRATIONS:
        operations = [
            migrations.RunPython(
                manually_create_mv_instructions,
                manually_drop_mv_instructions,
            )
        ]
    else:
        operations = [
            migrations.RunSQL(
                sql=CREATE_BILLING_AND_USAGE_SNAPSHOT_TABLE_SQL,
                reverse_sql=DROP_BILLING_AND_USAGE_SNAPSHOT_TABLE_SQL,
            ),
            migrations.RunSQL(
                sql=CREATE_BILLING_AND_USAGE_SNAPSHOT_INDEXES_SQL,
                reverse_sql=DROP_BILLING_AND_USAGE_SNAPSHOT_INDEXES_SQL,
            ),
            migrations.RunSQL(
                sql=CREATE_MV_SQL,
                reverse_sql=DROP_MV_SQL,
            ),
            migrations.RunSQL(
                sql=CREATE_INDEX_SQL,
                reverse_sql=DROP_INDEX_SQL,
            ),
        ]
