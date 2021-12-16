from pprint import pprint

from kpi.models import Asset

def run():
    asset = Asset.objects.order_by('date_created').last()
    asset.advanced_features = {'transcript': {}}
    asset.save()
    pprint(asset.get_advanced_submission_schema())
