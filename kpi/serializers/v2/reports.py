# coding: utf-8
from rest_framework import serializers
from rest_framework.reverse import reverse

from kobo.apps.reports import report_data


class ReportsDetailSerializer(serializers.BaseSerializer):

    def to_representation(self, obj):
        request = self.context['request']
        if 'names' in request.query_params:
            vnames = filter(lambda x: len(x) > 1,
                            request.query_params.get('names', '').split(','))
        else:
            vnames = None

        split_by = request.query_params.get('split_by', None)
        submission_stream = obj.deployment.get_submissions(request.user)
        _list = report_data.data_by_identifiers(
            obj,
            vnames,
            split_by=split_by,
            submission_stream=submission_stream,
        )

        return {
            'url': reverse('asset-reports', args=(obj.uid,), request=request),
            'count': len(_list),
            'list': _list,
        }
