from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0070_alter_assetversion_reversion_version'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE MATERIALIZED VIEW user_reports_mv AS
            SELECT
                row_number() OVER () AS id,
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
                        'organization_uid', org.id::text
                    )::text
                    ELSE NULL
                END AS organizations,
                ued.data::text AS metadata,
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
                au.last_login;
            """,
            reverse_sql="""
            DROP MATERIALIZED VIEW user_reports_mv;
            """,
        )
    ]
