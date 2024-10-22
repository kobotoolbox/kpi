# coding: utf-8
import os

import pytest
from pyxform.errors import PyXFormError

from kobo.apps.openrosa.apps.logger.models import Instance, XForm
from .test_base import TestBase


class TestInputs(TestBase):
    """
    This is where I'll input all files that proved problematic for
    users when uploading.
    """

    def test_uniqueness_of_group_names_enforced(self):
        pre_count = XForm.objects.count()
        self._create_user_and_login()

        with pytest.raises(PyXFormError) as e:
            self._publish_xls_file('fixtures/group_names_must_be_unique.xls')
            assert (
                'The name "group_names_must_be_unique" is the same as the form name'
                in str(e)
            )

        assert XForm.objects.count() == pre_count

    def test_mch(self):
        self._publish_xls_file(os.path.join('fixtures/bug_fixes/MCH_v1.xls'))

    def test_buggy_files(self):
        message = 'Duplicate column header: label'
        with pytest.raises(PyXFormError) as e:
            self._publish_xls_file(
                os.path.join('fixtures', 'bug_fixes', 'enumerator_weekly.xls')
            )
            assert message == str(e)

    def test_erics_files(self):
        for name in [
            'battery_life.xls',
            'Enumerator_Training_Practice_Survey.xls',
        ]:
            self._publish_xls_file(os.path.join('fixtures', 'bug_fixes', name))


class TestSubmissionBugs(TestBase):

    def test_submission_with_mixed_case_username(self):
        self._publish_transportation_form()
        s = self.surveys[0]
        count = Instance.objects.count()
        self._make_submission(
            os.path.join(
                self.this_directory,
                'fixtures',
                'transportation',
                'instances',
                s,
                s + '.xml',
            ),
            'BoB',
        )
        self.assertEqual(Instance.objects.count(), count + 1)


class TestCascading(TestBase):

    def test_correct_id_string_picked(self):
        XForm.objects.all().delete()
        name = 'new_cascading_select.xls'
        id_string = 'cascading_select_test'
        self._publish_xls_file(os.path.join(
            self.this_directory, 'fixtures', 'bug_fixes', name))
        self.assertEqual(XForm.objects.count(), 1)
        xform_id_string = XForm.objects.all()[0].id_string
        self.assertEqual(xform_id_string, id_string)
