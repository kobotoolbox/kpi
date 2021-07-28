# coding: utf-8
from rest_framework import serializers
from rest_framework.reverse import reverse

from kobo.apps.reports import report_data
from kpi.serializers.v2.reports import ReportsDetailSerializer as ReportsDetailSerializerV2


class ReportsListSerializer(serializers.BaseSerializer):
    def to_representation(self, obj):
        request = self.context['request']
        return {
            'url': reverse('reports-detail', args=(obj.uid,), request=request),
        }


class ReportsDetailSerializer(ReportsDetailSerializerV2):
    
    pass
