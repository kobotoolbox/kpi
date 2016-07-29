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
        if 'vnames' in request.query_params:
            vnames = filter(lambda x: len(x) > 1,
                           request.query_params.get('vnames', '').split(','))
        else:
            vnames = get_report._vnames(obj)
        _list = get_report.data(obj, vnames)

        return {
            'url': reverse('reports-detail', args=(obj.uid,), request=request),
            'list': get_report.data(obj, vnames),
            'count': len(_list),
            'list': _list,
        }
