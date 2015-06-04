from haystack import indexes
from .models import Asset, Collection

class AssetIndex(indexes.ModelSearchIndex, indexes.Indexable):
    # Double underscores are not allowed in index field names; searches
    # fail silently when Haystack's split_expression() throws away everything
    # after the double underscores
    username_of_owner = indexes.CharField(model_attr='owner__username')
    class Meta:
        model = Asset

class CollectionIndex(indexes.ModelSearchIndex, indexes.Indexable):
    username_of_owner = indexes.CharField(model_attr='owner__username')
    class Meta:
        model = Collection

# A kludge, not anything recommended by Haystack
DOUBLE_UNDERSCORE_MAP = {
    'owner__username': 'username_of_owner',
}
