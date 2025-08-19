# coding: utf-8
from datetime import datetime

from django.test import TestCase
from surveyor_manager.models import Surveyor

from kobo.apps.openrosa.apps.logger.factory import XFormManagerFactory
from kobo.apps.openrosa.apps.logger.models import XForm

xform_factory = XFormManagerFactory()


class TestSurveyorRegistration(TestCase):
    def setUp(self):
        [xf.delete() for xf in XForm.objects.all()]
        self.xf = xform_factory.create_registration_xform()

    def tearDown(self):
        self.xf.delete()

    def test_registration_form_loaded(self):
        registration_forms = XForm.objects.filter(title="registration")
        self.assertTrue(len(registration_forms) > 0)

    def test_registration_creates_surveyor(self):
        xform_factory.create_registration_instance({
            'start': datetime.now(), 'name': 'Steak Sauce',
            'device_id': '12345'})

        self.assertEqual(Surveyor.objects.count(), 1)
        self.assertEqual(Surveyor.objects.all()[0].name, "Steak Sauce")

    def test_multiple_registrations_on_the_same_phone(self):
        """
        Two users registered to phone '12345'.
            1: Betty (hour 1)
            2: Alex (hour 2)
        One submission:
            1. WaterSimple (hour 3)

        Submission should be attributed to "Alex Adams"
        """
        xform_factory.create_simple_xform()

        now = datetime.now()
        ordered_times = [datetime(now.year, now.month, now.day, 1),
                         datetime(now.year, now.month, now.day, 2),
                         datetime(now.year, now.month, now.day, 3)]

        xform_factory.create_registration_instance({
            'start': ordered_times[0], 'name': 'Betty Bimbob',
            'sex': 'female', 'birth_date': '1970-07-07',
            'device_id': '12345'})

        xform_factory.create_registration_instance({
            'start': ordered_times[1], 'name': 'Alex Adams',
            'birth_date': '1986-08-15', 'device_id': '12345'})

        self.assertTrue(Surveyor.objects.count(), 2)

        submission = xform_factory.create_simple_instance(
            {'start': ordered_times[2]})

        self.assertTrue(submission.parsed_instance.surveyor is not None)
        self.assertEqual(submission.parsed_instance.surveyor.name,
                         'Alex Adams')

    def test_multiple_submissions_out_of_order(self):
        """
        Two users registered to phone '12345'.
        User    Submission
        --      --
        1: user_one (named Betty, hour 1)
                2. submission_one # hour 2 - should be attributed to betty
        3: user_two (named Alex, hour 3)
                4. submission_two # hour 4 - should be attributed to alex
        Registrations performed in order,
        Submissions entered out of order.
        """
        xform_factory.create_simple_xform()

        now = datetime.now()
        ordered_times = [datetime(now.year, now.month, now.day, 1),
                         datetime(now.year, now.month, now.day, 2),
                         datetime(now.year, now.month, now.day, 3),
                         datetime(now.year, now.month, now.day, 4)]

        xform_factory.create_registration_instance({
            'form_id': self.xf.id_string, 'start': ordered_times[0],
            'name': 'Betty Bimbob', 'sex': 'female',
            'birth_date': '1970-07-07', 'device_id': '12345'})

        xform_factory.create_registration_instance({
            'form_id': self.xf.id_string, 'start': ordered_times[2],
            'name': 'Alex Adams', 'birth_date': '1986-08-15',
            'device_id': '12345'})

        self.assertTrue(Surveyor.objects.count(), 2)

        # submissions are sometimes parsed out of order, so we are saving the
        # 2nd submission first
        submission_two = xform_factory.create_simple_instance({
            'start': ordered_times[3]})

        submission_one = xform_factory.create_simple_instance({
            'start': ordered_times[1]})

        self.assertEqual(submission_one.parsed_instance.phone.imei, "12345")
        self.assertEqual(submission_one.parsed_instance.start_time,
                         ordered_times[1])
        self.assertEqual(submission_one.parsed_instance.surveyor.name,
                         'Betty Bimbob')
        self.assertEqual(submission_two.parsed_instance.surveyor.name,
                         'Alex Adams')
