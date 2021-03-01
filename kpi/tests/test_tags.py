# coding: utf-8
from django.contrib.auth.models import User
from django.test import TestCase
from taggit.models import Tag

from kpi.models.asset import Asset


class CreateCollectionTests(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.sa = Asset.objects.create(owner=self.user)

    def test_query_tags(self):
        TAG_NAME = 'Some-Tag'
        self.assertEqual(Tag.objects.count(), 0)
        self.sa.tags.add(TAG_NAME)
        self.assertEqual(Tag.objects.count(), 1)

    def test_can_query_all_assets_by_tag(self):
        TAG_NAME = 'Some-Asset-Tag'
        self.sa.tags.add(TAG_NAME)
        tag_obj = Tag.objects.get(name=TAG_NAME)
        tagged_survey_items = Asset.objects.filter(tags=tag_obj)
        self.assertEqual(tagged_survey_items.count(), 1)
        # alternative method to query by tag string
        self.assertEqual(Asset.objects.filter_by_tag_name(TAG_NAME).count(), 1)
