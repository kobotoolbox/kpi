from haystack import indexes
from .models import Asset, Collection

class AssetIndex(indexes.ModelSearchIndex, indexes.Indexable):
    class Meta:
        model = Asset

class CollectionIndex(indexes.ModelSearchIndex, indexes.Indexable):
    class Meta:
        model = Collection
