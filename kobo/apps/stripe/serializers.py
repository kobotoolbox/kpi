from django.core.exceptions import SuspiciousOperation
from djstripe.models import Customer, Plan, Product
from rest_framework import serializers
from rest_framework.serializers import ModelSerializer


class BaseProductSerializer(ModelSerializer):
    class Meta:
        model = Product
        fields = ('id', 'name', 'description', 'type', 'metadata')


class PlanSerializer(ModelSerializer):
    product = BaseProductSerializer()

    class Meta:
        model = Plan
        fields = ('id', 'nickname', 'amount', 'metadata', 'product')


class ProductSerializer(BaseProductSerializer):
    plans = PlanSerializer(many=True, source='plan_set')

    class Meta(BaseProductSerializer.Meta):
        fields = ('id', 'name', 'description', 'type', 'plans', 'metadata')
