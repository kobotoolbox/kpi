import stripe
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Max, Prefetch
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django_dont_vary_on.decorators import only_vary_on
from djstripe import enums
from djstripe.models import (
    Customer,
    Price,
    Product,
    Subscription,
    SubscriptionItem,
    SubscriptionSchedule,
)
from djstripe.settings import djstripe_settings
from drf_spectacular.utils import extend_schema, extend_schema_view
from organizations.utils import create_organization
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES
from kobo.apps.stripe.models import PlanAddOn
from kobo.apps.stripe.serializers import (
    ChangePlanSerializer,
    CheckoutLinkSerializer,
    CustomerPortalSerializer,
    OneTimeAddOnSerializer,
    ProductSerializer,
    SubscriptionSerializer,
)
from kobo.apps.stripe.utils.view_utils import (
    generate_return_url,
    get_total_price_for_quantity,
)
from kpi.permissions import IsAuthenticated
from kpi.schema_extensions.v2.stripe.serializers import CustomerPortalPostResponse
from kpi.utils.schema_extensions.response import open_api_200_ok_response
from kpi.versioning import APIV2Versioning


@extend_schema(tags=['Other'])
class OneTimeAddOnViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Lists the one-time add-ons for the authenticated user's organization.
    """
    permission_classes = (IsAuthenticated,)
    serializer_class = OneTimeAddOnSerializer
    queryset = PlanAddOn.objects.all()
    versioning_class = APIV2Versioning

    def get_queryset(self):
        return self.queryset.filter(
            charge__livemode=settings.STRIPE_LIVE_MODE,
            organization__organization_users__user=self.request.user,
        )


@extend_schema(tags=['Other'])
class ChangePlanView(APIView):
    """
    Change an existing subscription to a new price.

    This will immediately change their subscription to the new plan if upgrading, prorating the charge.
    If the user is downgrading to a lower price, it will schedule the change at the end of the current billing period.

    <pre class="prettyprint">
    <b>GET</b> /api/v2/stripe/change-plan/?subscription_id=<code>{subscription_id}</code>&price_id=<code>{price_id}</code>
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/stripe/change-plan/

    > **Payload**
    >
    >        {
    >           "price_id": "price_A34cds8fmske3tf",
    >           "subscription_id": "sub_s9aNFrd2fsmld4gz",
    >           "quantity": 100000
    >        }

    where:

    * "price_id" (required) is the Stripe Price ID for the plan the user is changing to.
    * "quantity" is the quantity for the new subscription price (default: 1).
    * "subscription_id" (required) is a Stripe Subscription ID for the subscription being changed.
    """
    permission_classes = (IsAuthenticated,)
    serializer_class = ChangePlanSerializer
    versioning_class = APIV2Versioning

    @staticmethod
    def modify_subscription(price, subscription, quantity):
        stripe.api_key = djstripe_settings.STRIPE_SECRET_KEY
        subscription_item = subscription.items.get()
        # Exit immediately if the price/quantity we're changing to is the price/quantity they're currently subscribed to
        if (
            quantity == subscription_item.quantity
            and price.id == subscription_item.price.id
        ):
            return Response(
                {'status': 'already subscribed'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # If we're upgrading their plan or moving to a plan with the same price, change the subscription immediately
        current_total_price = get_total_price_for_quantity(subscription_item.price, subscription_item.quantity)
        new_total_price = get_total_price_for_quantity(price, quantity)
        if new_total_price >= current_total_price:
            stripe_response = stripe.Subscription.modify(
                subscription.id,
                payment_behavior='pending_if_incomplete',
                proration_behavior='always_invoice',
                items=[
                    {
                        'id': subscription_item.id,
                        'price': price.id,
                        'quantity': quantity,
                    }
                ],
            )
            # If there are pending updates, there was a problem scheduling the change to their plan
            if stripe_response.get('pending_update'):
                return Response({
                    'status': 'pending',
                })
            # Upgraded successfully!
            else:
                return Response({
                    'price_id': price.id,
                    'status': 'success',
                })

        # We're downgrading the subscription, schedule a subscription change at the end of the current period
        return ChangePlanView.schedule_subscription_change(
            subscription=subscription,
            subscription_item=subscription_item,
            price_id=price.id,
            quantity=quantity,
        )

    @staticmethod
    def schedule_subscription_change(subscription, subscription_item, price_id, quantity):
        # First, try getting the existing schedule for the user's subscription
        try:
            schedule = SubscriptionSchedule.objects.get(
                subscription=subscription,
                status=enums.SubscriptionScheduleStatus.active,
            )
            # If the subscription is already scheduled to change to the given price/quantity, quit
            last_phase_item = schedule.phases[-1]['items'][0]
            if last_phase_item['price'] == price_id and last_phase_item.get('quantity') == quantity:
                return Response(
                    {'status': 'already scheduled to change to price'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        # If we couldn't find a schedule, make a new one
        except ObjectDoesNotExist:
            schedule = stripe.SubscriptionSchedule.create(
                from_subscription=subscription.id
            )
        # SubscriptionSchedules are managed by their `phases` list. Make a new phase to append to that list
        new_phases = [{
            'iterations': 1,
            'items': [
                {
                    'price': price_id,
                    'quantity': quantity,
                }
            ],
        }]
        # If the schedule already has phases, combine those with our new phase
        if schedule.phases:
            # Determine the current phase we're in, checking for the most recent phase with the current price ID
            phase_prices = [phase['items'][0]['price'] for phase in schedule.phases]
            phase_prices.reverse()
            current_phase_index = len(phase_prices) - phase_prices.index(
                subscription_item.price.id
            )
            phases_to_date = schedule.phases[0:current_phase_index]
            new_phases.insert(0, *phases_to_date)
        # Update the schedule at Stripe. Their webhook will sync our local SubscriptionSchedule models
        stripe.SubscriptionSchedule.modify(
            schedule.id, phases=new_phases
        )
        return Response({'status': 'scheduled'})

    def get(self, request):
        serializer = ChangePlanSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        price = serializer.validated_data.get('price_id')
        subscription = serializer.validated_data.get('subscription_id')
        quantity = serializer.validated_data.get('quantity')
        # Make sure the subscription belongs to the current user
        try:
            if (
                not subscription.customer.subscriber.owner.organization_user.user
                == request.user
            ):
                raise AttributeError
        except AttributeError:
            return Response(status=status.HTTP_403_FORBIDDEN)
        return ChangePlanView.modify_subscription(price, subscription, quantity)


@extend_schema(tags=['Other'])
class CheckoutLinkView(APIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = CheckoutLinkSerializer
    versioning_class = APIV2Versioning

    @staticmethod
    def generate_payment_link(price, user, organization_id, quantity=1):
        if organization_id:
            # Get the organization for the logged-in user and provided organization ID
            organization = Organization.objects.get(
                id=organization_id, owner__organization_user__user_id=user
            )
        else:
            # Find the first organization the user belongs to, otherwise make a new one
            organization = Organization.objects.filter(
                users=user, owner__organization_user__user_id=user
            ).first()
            if not organization:
                organization = create_organization(
                    user,
                    f"{user.username}'s organization",
                    model=Organization,
                    owner__user=user,
                )
        customer, _ = Customer.get_or_create(
            subscriber=organization, livemode=settings.STRIPE_LIVE_MODE
        )
        # Update the customer's name and organization name in Stripe.
        # djstripe doesn't let us do this on customer creation, so modify the customer on Stripe and then fetch locally.
        stripe_customer = stripe.Customer.modify(
            customer.id,
            name=customer.name or user.extra_details.data.get('name', user.username),
            description=organization.name,
            api_key=djstripe_settings.STRIPE_SECRET_KEY,
            metadata={
                'kpi_owner_username': user.username,
                'kpi_owner_user_id': user.id,
                'request_url': settings.KOBOFORM_URL,
                'organization_id': organization_id,
            },
        )
        customer.sync_from_stripe_data(stripe_customer)
        session = CheckoutLinkView.start_checkout_session(
            customer_id=customer.id,
            price=price,
            organization_id=organization.id,
            user=user,
            quantity=quantity,
        )
        return session['url']

    @staticmethod
    def start_checkout_session(customer_id, price, organization_id, user, quantity=1):
        kwargs = {}
        if price.type == 'one_time':
            checkout_mode = 'payment'
            kwargs['payment_intent_data'] = {
                'metadata': {
                    'organization_id': organization_id,
                    'price_id': price.id,
                    'quantity': quantity,
                    # product metadata contains the usage limit values
                    # for one-time add-ons
                    **(price.product.metadata or {}),
                },
            }
        else:
            checkout_mode = 'subscription'
            # subscriptions in Stripe can only be purchased one at a time
            quantity = 1
            kwargs['subscription_data'] = {
                'metadata': {
                    'kpi_owner_username': user.username,
                    'kpi_owner_user_id': user.id,
                    'request_url': settings.KOBOFORM_URL,
                    'organization_id': organization_id,
                },
            }

        return stripe.checkout.Session.create(
            api_key=djstripe_settings.STRIPE_SECRET_KEY,
            allow_promotion_codes=True,
            automatic_tax={'enabled': False},
            billing_address_collection='required',
            customer=customer_id,
            customer_update={
                'address': 'auto',
                'name': 'auto',
            },
            line_items=[
                {
                    'price': price.id,
                    'quantity': quantity,
                },
            ],
            metadata={
                'organization_id': organization_id,
                'price_id': price.id,
                'kpi_owner_username': user.username,
            },
            mode=checkout_mode,
            success_url=generate_return_url(price.product.metadata)
            + f'?checkout={price.id}',
            **kwargs,
        )

    def post(self, request):
        serializer = CheckoutLinkSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        price = serializer.validated_data.get('price_id')
        organization_id = serializer.validated_data.get('organization_id')
        quantity = serializer.validated_data.get('quantity')
        url = self.generate_payment_link(
            price=price,
            user=request.user,
            organization_id=organization_id,
            quantity=quantity,
        )
        return Response({'url': url})


@extend_schema(tags=['Other'])
@extend_schema_view(
    post=extend_schema(
        request={'application/json': CustomerPortalSerializer},
        # Using an inline serializer given that
        responses=open_api_200_ok_response(
            CustomerPortalPostResponse,
            raise_not_found=False,
            raise_access_forbidden=False,
            # Can throw 400 due to invalid payload
            validate_payload=True,
        ),
    ),
)
class CustomerPortalView(APIView):
    permission_classes = (IsAuthenticated,)
    versioning_class = APIV2Versioning

    @staticmethod
    def generate_portal_link(user, organization_id, requested_price):
        customer = (
            Customer.objects.filter(
                subscriber_id=organization_id,
                subscriber__owner__organization_user__user_id=user,
                subscriptions__status__in=ACTIVE_STRIPE_STATUSES,
                livemode=settings.STRIPE_LIVE_MODE,
            )
            .values(
                'id',
                'subscriptions__id',
                'subscriptions__items__id',
                'subscriptions__items__price__product',
                'subscriptions__items__price__product__metadata',
            )
            .first()
        )

        if not customer:
            error_str = f"Couldn't find customer with organization id {organization_id}"
            return Response(
                {'error': error_str},
                status=status.HTTP_400_BAD_REQUEST,
            )

        portal_kwargs = {}

        current_product_metadata = customer[
            'subscriptions__items__price__product__metadata'
        ]

        return_url = generate_return_url(current_product_metadata)

        relevant_config_slug = 'manage-standard'
        if current_product_metadata.get('product_type') == 'addon':
            relevant_config_slug = 'manage-addon'
        if current_product_metadata.get('plan_type') == 'enterprise':
            relevant_config_slug = 'manage-enterprise'
        if current_product_metadata.get('plan_type') == 'unlimited':
            relevant_config_slug = 'manage-unlimited'

        # Determine which config to use to handle downgrades to ensure customers
        # moving to a higher tier of service can switch plans immediately.
        # Otherwise, downgrades should always be at the end of the customer's
        # current billing period.
        if requested_price:
            relevant_config_slug = 'switch-plans-delayed-downgrade'

            # Check if user is updating to a higher tier of service
            # by comparing monthly prices
            current_product_monthly_price = Price.objects.filter(
                product=customer['subscriptions__items__price__product'],
                recurring__interval='month',
                recurring__interval_count=1,
            ).first()
            current_product_monthly_unit_amount = (
                current_product_monthly_price.unit_amount
                if current_product_monthly_price
                else 0
            )

            if (
                requested_price.recurring
                and requested_price.recurring['interval'] == 'month'
                and requested_price.recurring['interval_count'] == 1
            ):
                requested_product_monthly_unit_amount = requested_price.unit_amount
            else:
                requested_product_monthly_price = Price.objects.filter(
                    product=requested_price.product,
                    recurring__interval='month',
                    recurring__interval_count=1,
                ).first()
                requested_product_monthly_unit_amount = (
                    requested_product_monthly_price.unit_amount
                    if requested_product_monthly_price
                    else 0
                )
            if (
                requested_product_monthly_unit_amount
                > current_product_monthly_unit_amount
            ):
                relevant_config_slug = 'switch-plans-immediate-downgrade'

            metadata = requested_price.product.metadata
            return_url = generate_return_url(metadata)

            """
            Customers with subscription schedules can't upgrade from the portal
            So if the customer has any active subscription schedules, release them, keeping the subscription intact
            """
            schedules = (
                SubscriptionSchedule.objects.filter(
                    customer__id=customer['id'],
                )
                .exclude(status__in=['released', 'canceled'])
                .values('status', 'id')
            )
            for schedule in schedules:
                stripe.SubscriptionSchedule.release(
                    schedule['id'],
                    api_key=djstripe_settings.STRIPE_SECRET_KEY,
                    preserve_cancel_date=False,
                )

            portal_kwargs = {
                'flow_data': {
                    'type': 'subscription_update_confirm',
                    'subscription_update_confirm': {
                        'items': [
                            {
                                'id': customer['subscriptions__items__id'],
                                'quantity': 1,
                                'price': requested_price.id,
                            },
                        ],
                        'subscription': customer['subscriptions__id'],
                    },
                    'after_completion': {
                        'type': 'redirect',
                        'redirect': {
                            'return_url': return_url
                            + f'?checkout={requested_price.id}',
                        },
                    },
                },
            }

        all_configs = stripe.billing_portal.Configuration.list(
            active=True,
            api_key=djstripe_settings.STRIPE_SECRET_KEY,
            limit=100,
        )
        config = next(
            (
                config
                for config in all_configs
                if (config['metadata'].get('slug', '') == relevant_config_slug)
            ),
            None,
        )

        if not config:
            return Response(
                {'error': 'Missing Stripe billing configuration.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        portal_kwargs['configuration'] = config

        stripe_response = stripe.billing_portal.Session.create(
            api_key=djstripe_settings.STRIPE_SECRET_KEY,
            customer=customer['id'],
            return_url=return_url,
            **portal_kwargs,
        )
        return Response({'url': stripe_response['url']})

    def post(self, request):
        serializer = CustomerPortalSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        organization_id = serializer.validated_data.get('organization_id', None)
        price = serializer.validated_data.get('price_id', None)
        response = self.generate_portal_link(
            user=request.user,
            organization_id=organization_id,
            requested_price=price,
        )
        return response


@extend_schema(tags=['Other'])
@extend_schema_view(
    list=extend_schema(
        responses=open_api_200_ok_response(
            SubscriptionSerializer,
            raise_not_found=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
)
class SubscriptionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Subscription.objects.all()
    serializer_class = SubscriptionSerializer
    lookup_field = 'id'
    permission_classes = (IsAuthenticated,)
    versioning_class = APIV2Versioning

    def get_queryset(self):
        return self.queryset.filter(
            livemode=settings.STRIPE_LIVE_MODE,
            customer__subscriber__users=self.request.user,
        ).select_related(
            'schedule'
        ).prefetch_related(
            Prefetch(
                'items',
                queryset=SubscriptionItem.objects.select_related(
                    'price__product'
                ),
            )
        )


@extend_schema(tags=['Other'])
@method_decorator(cache_page(settings.ENDPOINT_CACHE_DURATION), name='list')
@method_decorator(only_vary_on('Origin'), name='list')
class ProductViewSet(viewsets.GenericViewSet, mixins.ListModelMixin):
    """
    Returns Product and Price Lists, sorted from the product with the lowest price to highest
    <strong>This endpoint is cached for an amount of time determined by ENDPOINT_CACHE_DURATION</strong>

    <pre class="prettyprint">
    <b>GET</b> /api/v2/stripe/products/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/stripe/products/

    > Response
    >
    >       HTTP 200 Ok
    >        {
    >           "count": ...
    >           "next": ...
    >           "previous": ...
    >           "results": [
    >               {
    >                   "id": string,
    >                   "name": string,
    >                   "type": string,
    >                   "prices": [
    >                       {
    >                           "id": string,
    >                           "nickname": string,
    >                           "currency": string,
    >                           "type": string,
    >                           "recurring": {
    >                               "aggregate_usage": string ('sum', 'last_during_period`, `last_ever`, `max`)
    >                               "interval": string ('month', 'year', 'week', 'day')
    >                               "interval_count": int,
    >                               "usage_type": string ('metered', 'licensed')
    >                           },
    >                           "unit_amount": int (cents),
    >                           "human_readable_price": string,
    >                           "metadata": {},
    >                           "active": bool,
    >                           "product": string,
    >                           "transform_quantity": null | {'round': 'up'|'down', 'divide_by': int}
    >                       },
    >                       ...
    >                   ],
    >                   "metadata": {},
    >               },
    >               ...
    >           ]
    >        }
    >

    ### Note: unit_amount is price in cents (assuming currency is USD/AUD/CAD/etc.)

    ## Current Endpoint
    """

    queryset = (
        Product.objects.filter(
            active=True,
            livemode=settings.STRIPE_LIVE_MODE,
            prices__active=True,
        )
        .prefetch_related(
            Prefetch('prices', queryset=Price.objects.filter(active=True))
        )
        .annotate(highest_unit_amount=Max('prices__unit_amount'))
        .order_by('highest_unit_amount')
        .distinct()
    )
    serializer_class = ProductSerializer
    versioning_class = APIV2Versioning
