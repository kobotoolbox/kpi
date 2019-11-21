# coding: utf-8
import re

from haystack import indexes
from taggit.models import Tag

from .models import Asset


class FieldPreparersMixin:
    """
    Haystack uses commas as separators for MultiValueField:
    https://github.com/django-haystack/django-haystack/blob/v2.4.0/haystack/backends/whoosh_backend.py#L159
    We'll find commas (and spaces, to mimic Gmail) and replace them with dashes.
    """
    COMMA_SPACE_RE = re.compile('[, ]')

    def _escape_comma_space(self, string, repl='-'):
        return re.sub(self.COMMA_SPACE_RE, repl, string)

    def prepare_tag(self, obj):
        return [
            self._escape_comma_space(t.name)
            for t in obj.tags.all()
        ]

    def prepare_name__exact(self, obj):
        return self._escape_comma_space(obj.name)

    def prepare_asset_type(self, obj):
        return self._escape_comma_space(obj.asset_type)

    def prepare_owner__username__exact(self, obj):
        if obj.owner:
            return self._escape_comma_space(obj.owner.username)

    def prepare_parent__name__exact(self, obj):
        if obj.parent:
            return self._escape_comma_space(obj.parent.name)

    def prepare_parent__uid(self, obj):
        """
        Trivial method needed because MultiValueField(model_attr='parent__uid')
        ends up giving each character in the UID its own entry in the lexicon
        """
        if obj.parent:
            return obj.parent.uid

    def prepare_users_granted_permission(self, obj):
        return [u.username for u in obj.get_users_with_perms()]


class AssetIndex(indexes.SearchIndex, indexes.Indexable, FieldPreparersMixin):
    # Haystack usually doesn't deal well with double underscores in field names
    # (searches fail silently when Haystack's split_expression() throws away
    # everything after the double underscores), but we can get away with it
    # since our queries use Raw().
    text = indexes.CharField(document=True, use_template=True)
    name = indexes.CharField(model_attr='name')
    owner__username = indexes.CharField(model_attr='owner__username', null=True)
    parent__name = indexes.CharField(model_attr='parent__name', null=True)
    tag = indexes.MultiValueField()
    # There's nothing multi-valued about these fields, but using
    # MultiValueField convinces Haystack to use Whoosh's KEYWORD field, which
    # in turn uses KeywordAnalyzer. Then, by replacing commas, we can force the
    # entire field to be a single token. This would be much easier if Haystack
    # allowed us to use Whoosh's ID field.
    name__exact = indexes.MultiValueField()
    asset_type = indexes.MultiValueField()
    owner__username__exact = indexes.MultiValueField()
    parent__name__exact = indexes.MultiValueField()
    parent__uid = indexes.MultiValueField()
    has_deployment = indexes.MultiValueField()
    deployment__identifier = indexes.MultiValueField()
    deployment__active = indexes.MultiValueField()
    users_granted_permission = indexes.MultiValueField()

    def prepare_has_deployment(self, obj):
        return str(obj.has_deployment).lower()

    def prepare_deployment__identifier(self, obj):
        if not obj.has_deployment:
            return None
        return self._escape_comma_space(obj.deployment.identifier)

    def prepare_deployment__active(self, obj):
        return str(obj.has_deployment and obj.deployment.active).lower()

    def get_model(self):
        return Asset


class TagIndex(indexes.SearchIndex, indexes.Indexable, FieldPreparersMixin):
    text = indexes.CharField(model_attr='name', document=True)
    name__ngram = indexes.NgramField(model_attr='name')
    asset_type = indexes.MultiValueField()
    kind = indexes.MultiValueField()

    def prepare_asset_type(self, obj):
        # Call order_by() to make distinct() behave as expected
        asset_types = Asset.objects.filter(tags=obj).order_by().values_list(
            'asset_type', flat=True).distinct()
        return [self._escape_comma_space(x) for x in asset_types]

    def prepare_kind(self, obj):
        kinds = []
        try:
            kinds.append(Asset.objects.filter(tags=obj)[0].kind)
        except IndexError:
            pass
        return [self._escape_comma_space(x) for x in kinds]

    def get_model(self):
        return Tag
