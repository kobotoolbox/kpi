from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.schema_extensions.v2.generic.schema import (
    GENERIC_OBJECT_SCHEMA,
    GENERIC_STRING_SCHEMA,
)


class ExtraDetailsFieldExtensions(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.user_reports.fields.ExtraDetailsField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'data': build_object_type(
                    properties={
                        'name': GENERIC_STRING_SCHEMA,
                        'sector': GENERIC_STRING_SCHEMA,
                        'country': GENERIC_STRING_SCHEMA,
                        'organization': GENERIC_STRING_SCHEMA,
                        'last_ui_language': GENERIC_STRING_SCHEMA,
                        'organization_type': GENERIC_STRING_SCHEMA,
                        'organization_website': GENERIC_STRING_SCHEMA,
                        'newsletter_subscription': build_basic_type(OpenApiTypes.BOOL),
                        'done_storage_limits_check': build_basic_type(
                            OpenApiTypes.BOOL
                        ),
                    }
                ),
                'date_removed': build_basic_type(OpenApiTypes.DATETIME),
                'validated_password': build_basic_type(OpenApiTypes.BOOL),
                'password_date_changed': build_basic_type(OpenApiTypes.DATETIME),
                'date_removal_requested': build_basic_type(OpenApiTypes.DATETIME),
            },
        )


class OrganizationsFieldExtensions(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.user_reports.fields.OrganizationsField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'organization_name': GENERIC_STRING_SCHEMA,
                'organization_uid': GENERIC_STRING_SCHEMA,
                'role': GENERIC_STRING_SCHEMA,
            }
        )


SUBSCRIPTION_METADATA_SCHEMA = build_object_type(
    properties={
        'request_url': GENERIC_STRING_SCHEMA,
        'organization_id': GENERIC_STRING_SCHEMA,
        'kpi_owner_user_id': GENERIC_STRING_SCHEMA,
        'kpi_owner_username': GENERIC_STRING_SCHEMA,
    }
)

PRICE_RECURRING_SCHEMA = build_object_type(
    properties={
        'meter': GENERIC_STRING_SCHEMA,
        'interval': GENERIC_STRING_SCHEMA,
        'usage_type': GENERIC_STRING_SCHEMA,
        'interval_count': build_basic_type(OpenApiTypes.INT),
        'aggregate_usage': GENERIC_STRING_SCHEMA,
        'trial_period_days': build_basic_type(OpenApiTypes.INT),
    }
)

TRANSFORM_QUANTITY_SCHEMA = build_object_type(
    properties={
        'divide_by': build_basic_type(OpenApiTypes.INT),
        'round': GENERIC_STRING_SCHEMA,
    },
    nullable=True,
)

PRODUCT_SCHEMA = build_object_type(
    properties={
        'id': GENERIC_STRING_SCHEMA,
        'name': GENERIC_STRING_SCHEMA,
        'description': GENERIC_STRING_SCHEMA,
        'type': GENERIC_STRING_SCHEMA,
        'metadata': build_object_type(
            properties={
                'product_type': GENERIC_STRING_SCHEMA,
                'storage_bytes_limit': GENERIC_STRING_SCHEMA,
            },
            additionalProperties=True,
        ),
    }
)

PRICE_SCHEMA = build_object_type(
    properties={
        'id': GENERIC_STRING_SCHEMA,
        'nickname': GENERIC_STRING_SCHEMA,
        'currency': GENERIC_STRING_SCHEMA,
        'type': GENERIC_STRING_SCHEMA,
        'recurring': PRICE_RECURRING_SCHEMA,
        'unit_amount': build_basic_type(OpenApiTypes.INT),
        'human_readable_price': GENERIC_STRING_SCHEMA,
        'metadata': build_object_type(additionalProperties=True),
        'active': build_basic_type(OpenApiTypes.BOOL),
        'product': PRODUCT_SCHEMA,
        'transform_quantity': TRANSFORM_QUANTITY_SCHEMA,
    }
)

SUBSCRIPTION_ITEM_SCHEMA = build_object_type(
    properties={
        'id': GENERIC_STRING_SCHEMA,
        'price': build_array_type(schema=PRICE_SCHEMA),
        'quantity': build_basic_type(OpenApiTypes.INT),
    }
)

SUBSCRIPTION_PHASE_ITEM_SCHEMA = build_object_type(
    properties={
        'plan': GENERIC_STRING_SCHEMA,
        'price': GENERIC_STRING_SCHEMA,
        'metadata': build_object_type(additionalProperties=True),
        'quantity': build_basic_type(OpenApiTypes.INT),
        'tax_rates': build_array_type(schema=build_basic_type(OpenApiTypes.INT)),
        'billing_thresholds': build_object_type(additionalProperties=True),
    }
)

SUBSCRIPTION_PHASE_SCHEMA = build_object_type(
    properties={
        'items': build_array_type(schema=SUBSCRIPTION_PHASE_ITEM_SCHEMA),
        'coupon': GENERIC_STRING_SCHEMA,
        'currency': GENERIC_STRING_SCHEMA,
        'end_date': build_basic_type(OpenApiTypes.INT),
        'metadata': build_object_type(),
        'trial_end': build_basic_type(OpenApiTypes.INT),
        'start_date': build_basic_type(OpenApiTypes.INT),
        'description': GENERIC_STRING_SCHEMA,
        'on_behalf_of': GENERIC_STRING_SCHEMA,
        'automatic_tax': build_object_type(
            schema={'enabled': build_basic_type(OpenApiTypes.BOOL)}
        ),
        'transfer_data': GENERIC_STRING_SCHEMA,
        'invoice_settings': GENERIC_STRING_SCHEMA,
        'add_invoice_items': GENERIC_OBJECT_SCHEMA,
        'collection_method': GENERIC_STRING_SCHEMA,
        'default_tax_rates': GENERIC_OBJECT_SCHEMA,
        'billing_thresholds': GENERIC_STRING_SCHEMA,
        'proration_behavior': GENERIC_STRING_SCHEMA,
        'billing_cycle_anchor': build_basic_type(OpenApiTypes.INT),
        'default_payment_method': GENERIC_STRING_SCHEMA,
        'application_fee_percent': build_basic_type(OpenApiTypes.INT),
    },
    nullable=True,
)

SUBSCRIPTION_SCHEDULE_SCHEMA = build_object_type(
    properties={
        'phases': build_array_type(schema=SUBSCRIPTION_PHASE_SCHEMA),
        'status': GENERIC_STRING_SCHEMA,
    },
    nullable=True,
)

SUBSCRIPTION_SCHEMA = build_object_type(
    properties={
        'items': build_array_type(schema=SUBSCRIPTION_ITEM_SCHEMA),
        'schedule': SUBSCRIPTION_SCHEDULE_SCHEMA,
        'djstripe_created': GENERIC_STRING_SCHEMA,
        'djstripe_updated': GENERIC_STRING_SCHEMA,
        'id': GENERIC_STRING_SCHEMA,
        'livemode': build_basic_type(OpenApiTypes.BOOL),
        'created': GENERIC_STRING_SCHEMA,
        'metadata': SUBSCRIPTION_METADATA_SCHEMA,
        'description': GENERIC_STRING_SCHEMA,
        'application_fee_percent': build_basic_type(OpenApiTypes.FLOAT),
        'billing_cycle_anchor': GENERIC_STRING_SCHEMA,
        'billing_thresholds': GENERIC_STRING_SCHEMA,
        'cancel_at': GENERIC_STRING_SCHEMA,
        'cancel_at_period_end': build_basic_type(OpenApiTypes.BOOL),
        'canceled_at': GENERIC_STRING_SCHEMA,
        'collection_method': GENERIC_STRING_SCHEMA,
        'current_period_end': GENERIC_STRING_SCHEMA,
        'current_period_start': GENERIC_STRING_SCHEMA,
        'days_until_due': GENERIC_STRING_SCHEMA,
        'discount': GENERIC_STRING_SCHEMA,
        'ended_at': GENERIC_STRING_SCHEMA,
        'next_pending_invoice_item_invoice': GENERIC_STRING_SCHEMA,
        'pause_collection': GENERIC_STRING_SCHEMA,
        'pending_invoice_item_interval': GENERIC_STRING_SCHEMA,
        'pending_update': GENERIC_STRING_SCHEMA,
        'proration_behavior': GENERIC_STRING_SCHEMA,
        'proration_date': GENERIC_STRING_SCHEMA,
        'quantity': build_basic_type(OpenApiTypes.INT),
        'start_date': GENERIC_STRING_SCHEMA,
        'status': GENERIC_STRING_SCHEMA,
        'trial_end': GENERIC_STRING_SCHEMA,
        'trial_start': GENERIC_STRING_SCHEMA,
        'djstripe_owner_account': GENERIC_STRING_SCHEMA,
        'customer': GENERIC_STRING_SCHEMA,
        'default_payment_method': GENERIC_STRING_SCHEMA,
        'default_source': GENERIC_STRING_SCHEMA,
        'latest_invoice': GENERIC_STRING_SCHEMA,
        'pending_setup_intent': GENERIC_STRING_SCHEMA,
        'plan': build_basic_type(OpenApiTypes.INT),
        'default_tax_rates': GENERIC_OBJECT_SCHEMA,
    }
)


class SubscriptionsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.user_reports.fields.SubscriptionsField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(schema=SUBSCRIPTION_SCHEMA)
