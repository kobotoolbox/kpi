from rest_framework.reverse import reverse
from rest_framework.serializers import HyperlinkedRelatedField

from kpi.models.draft_nlp import DraftNLPModel


class ParentHyperlinkedRelated(HyperlinkedRelatedField):
    view_name = 'api_v2:data-nlp-detail'
    queryset = DraftNLPModel.objects.all()

    def get_url(self, obj, view_name, request, format):
        url_kwargs = {
            'parent_lookup_asset': obj.asset.uid,
            'parent_lookup_data': obj.submission_id,
            'uid': obj.uid,
        }
        return reverse(view_name, kwargs=url_kwargs, request=request, format=format)

    def get_object(self, view_name, view_args, view_kwargs):
        lookup_kwargs = {
            'asset__uid': view_kwargs['parent_lookup_asset'],
            'submission_id': view_kwargs['parent_lookup_data'],
            'uid': view_kwargs['uid'],
        }
        return self.get_queryset().get(**lookup_kwargs)
