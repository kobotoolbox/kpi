# coding: utf-8
from rest_framework import serializers
from rest_framework.reverse import reverse

import report_data as get_report


class ReportsListSerializer(serializers.BaseSerializer):
    def to_representation(self, obj):
        request = self.context['request']
        return {
            'url': reverse('reports-detail', args=(obj.uid,), request=request),
        }


class ReportsDetailSerializer(serializers.BaseSerializer):
    def to_representation(self, obj):
        request = self.context['request']
        if 'kuids' in request.query_params:
            kuids = filter(lambda x: len(x) > 1,
                           request.query_params.get('kuids', '').split(','))
        else:
            kuids = get_report._kuids(obj)
        _list = get_report.data(obj, kuids)

        return {
            'url': reverse('reports-detail', args=(obj.uid,), request=request),
            'list': get_report.data(obj, kuids),
            'count': len(_list),
            'list': _list,
        }
