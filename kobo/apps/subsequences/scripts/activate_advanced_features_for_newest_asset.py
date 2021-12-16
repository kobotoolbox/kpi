from pprint import pprint

from kpi.models import Asset

def run():
    # Asset.objects.order_by('+date_created').first()
    asset = Asset.objects.last()
    asset.advanced_features = {'transcript': {}}
    asset.save()
    pprint(asset.get_advanced_submission_schema())
