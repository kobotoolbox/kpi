from django.core.exceptions import SuspiciousOperation, ValidationError
from djstripe.models import Customer, Plan, Product, Subscription
from rest_framework import serializers


class BaseProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ('id', 'name', 'description', 'type', 'metadata')


class CheckoutLinkSerializer(serializers.Serializer):
    price_id = serializers.CharField(required=True)
    organization_uid = serializers.CharField(required=True)

    def validate(self, attrs):
        price_id = attrs.get('price_id')
        organization_uid = attrs.get('organization_uid')
        if price_id.startswith('price_') and organization_uid.startswith('org'):
            return attrs
        raise ValidationError('Invalid price/organization ID')



class PlanSerializer(serializers.ModelSerializer):

    product = BaseProductSerializer()

    class Meta:
        model = Plan
        exclude = ('djstripe_id',)


class SubscriptionSerializer(serializers.ModelSerializer):

    plan = serializers.SerializerMethodField()

    class Meta:
        model = Subscription
        exclude = ('djstripe_id',)

    def get_plan(self, subscription):
        plan = Plan.objects.get(id=subscription.plan.id)
        return PlanSerializer(plan, many=False, context=self.context).data
