from rest_framework import status
from django.test import TestCase
from kpi.models.collection import Collection
from kpi.models.asset import SurveyAsset
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from taggit.models import Tag

class CreateCollectionTests(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.all()[0]
        self.coll = Collection.objects.create(owner=self.user)
        self.sa = SurveyAsset.objects.create(content=[], owner = self.user)

    def test_query_tags(self):
        TAG_NAME = 'Some Tag'
        self.assertEqual(Tag.objects.count(), 0)
        self.coll.tags.add(TAG_NAME)
        self.assertEqual(Tag.objects.count(), 1)

    def test_can_query_all_assets_by_tag(self):
        TAG_NAME = 'Some Asset Tag'
        self.sa.tags.add(TAG_NAME)
        tag_obj = Tag.objects.get(name=TAG_NAME)
        tagged_survey_items = SurveyAsset.objects.filter(tags=tag_obj)
        self.assertEqual(tagged_survey_items.count(), 1)
        # alternative method to query by tag string
        self.assertEqual(SurveyAsset.objects.filter_by_tag_name(TAG_NAME).count(), 1)

    def test_can_query_all_collections_by_tag(self):
        TAG_NAME = 'Some Collection Tag'
        self.coll.tags.add(TAG_NAME)
        tag_obj = Tag.objects.get(name=TAG_NAME)
        tagged_collections = Collection.objects.filter(tags=tag_obj)
        self.assertEqual(tagged_collections.count(), 1)
        # alternative method to query by tag string
        self.assertEqual(Collection.objects.filter_by_tag_name(TAG_NAME).count(), 1)

