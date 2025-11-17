from kobo.apps.subsequences.utils.versioning import migrate_advanced_features
from kpi.models import Asset


def run():
    assets = Asset.objects.exclude(advanced_features__iexact='{}')
    for asset in assets:
        migrate_advanced_features(asset)
