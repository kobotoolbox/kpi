from haystack import indexes
from .models import Asset, Collection

class AssetIndex(indexes.ModelSearchIndex, indexes.Indexable):
    # Double underscores are not allowed in index field names; searches
    # fail silently when Haystack's split_expression() throws away everything
    # after the double underscores
    class Meta:
        model = Asset

class CollectionIndex(indexes.ModelSearchIndex, indexes.Indexable):
    class Meta:
        model = Collection
