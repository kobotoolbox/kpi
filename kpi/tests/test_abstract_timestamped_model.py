from django.apps import apps
from django.db import models, connection
from django.test import TestCase

from kpi.models.abstract_models import AbstractTimeStampedModel


class DummyModel(AbstractTimeStampedModel):
    name = models.CharField(max_length=100)

    class Meta:
        app_label = 'dummy_tests'


class AbstractTimestampedModelTestCase(TestCase):

    @classmethod
    def setUpTestData(cls):
        if not apps.is_installed('dummy_tests'):
            apps.all_models['dummy_tests'] = {}
        apps.all_models['dummy_tests']['dummymodel'] = DummyModel
        apps.clear_cache()
        with connection.schema_editor() as schema_editor:
            schema_editor.create_model(DummyModel)

    @classmethod
    def tearDownClass(cls):
        with connection.schema_editor() as schema_editor:
            schema_editor.delete_model(DummyModel)
        super().tearDownClass()

    def test_date_modified(self):
        obj = DummyModel.objects.create(name='Test')
        date_modified = obj.date_modified

        # `update_fields` is not specified, `date_modified` should be modified
        obj.save()
        assert obj.date_modified != date_modified
        assert obj.date_modified > date_modified
        date_modified = obj.date_modified

        # `update_fields` is specified without `date_modified`.
        # `date_modified` should NOT be modified.
        obj.save(update_fields=['name'])
        assert obj.date_modified == date_modified

        # `update_fields` is specified with `date_modified`.
        # `date_modified` should be modified.
        obj.save(update_fields=['name', 'date_modified'])
        assert obj.date_modified != date_modified
        assert obj.date_modified > date_modified
