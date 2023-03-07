from django.core.exceptions import SuspiciousOperation, ValidationError
from djstripe.models import Customer, Plan, Product, Subscription
from rest_framework import serializers


class BaseProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ('id', 'name', 'description', 'type', 'metadata')


class CustomerPortalSerializer(serializers.Serializer):
    organization_uid = serializers.CharField(required=True)

    def validate_organization_uid(self, organization_uid):
        if organization_uid.startswith('org'):
            return organization_uid
        raise ValidationError('Invalid organization ID')


class CheckoutLinkSerializer(serializers.Serializer):
    price_id = serializers.CharField(required=True)
    organization_uid = serializers.CharField(required=False)

    def validate_price_id(self, price_id):
        if price_id.startswith('price_'):
            return price_id
        raise ValidationError('Invalid price ID')

    def validate_organization_uid(self, organization_uid):
        if organization_uid.startswith('org') or not organization_uid:
            return organization_uid
        raise ValidationError('Invalid organization ID')


class PlanSerializer(serializers.ModelSerializer):

    product = BaseProductSerializer()

    class Meta:
        model = Plan
        exclude = ('djstripe_id',)


class ProductSerializer(BaseProductSerializer):
    plans = PlanSerializer(many=True, source="plan_set")

    class Meta(BaseProductSerializer.Meta):
        fields = ("id", "name", "description", "type", "plans", "metadata")


class SubscriptionSerializer(serializers.ModelSerializer):

    plan = serializers.SerializerMethodField()

    class Meta:
        model = Subscription
        exclude = ('djstripe_id',)

    def get_plan(self, subscription):
        plan = Plan.objects.get(id=subscription.plan.id)
        return PlanSerializer(plan, many=False, context=self.context).data
