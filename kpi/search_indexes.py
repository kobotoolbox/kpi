from haystack import indexes
from .models import Asset, Collection

class AssetIndex(indexes.SearchIndex, indexes.Indexable):
    # Double underscores are not allowed in index field names; searches
    # fail silently when Haystack's split_expression() throws away everything
    # after the double underscores
    text = indexes.CharField(document=True, use_template=True)
    def get_model(self):
        return Asset

class CollectionIndex(indexes.SearchIndex, indexes.Indexable):
    text = indexes.CharField(document=True, use_template=True)
    def get_model(self):
        return Collection
