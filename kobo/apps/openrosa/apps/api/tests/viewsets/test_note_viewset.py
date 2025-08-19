# coding: utf-8
from django.test import RequestFactory

from kobo.apps.openrosa.apps.api.viewsets.note_viewset import NoteViewSet
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase


class TestNoteViewSet(TestBase):

    def setUp(self):
        super().setUp()
        self._create_user_and_login()
        self._publish_transportation_form()
        self._make_submissions()
        self.view = NoteViewSet.as_view({
            'get': 'list',
            'post': 'create',
            'delete': 'destroy'
        })
        self.factory = RequestFactory()
        self.extra = {
            'HTTP_AUTHORIZATION': 'Token %s' % self.user.auth_token}

    def _add_notes_to_data_point(self):
        # add a note to a specific data point
        note = {'note': "Road Warrior"}
        dataid = self.xform.instances.all()[0].pk
        note['instance'] = dataid
        request = self.factory.post('/', data=note, **self.extra)
        self.assertTrue(self.xform.instances.count())

        response = self.view(request)
        self.assertEqual(response.status_code, 201)
        self.pk = response.data['id']
        note['id'] = self.pk
        self.note = note

    def test_note_list(self):
        self._add_notes_to_data_point()
        request = self.factory.get('/', **self.extra)
        response = self.view(request)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(len(response.data) > 0)
        self.assertEqual(dict(response.data[0], **self.note),
                         response.data[0])

    def test_note_get(self):
        self._add_notes_to_data_point()
        view = NoteViewSet.as_view({
            'get': 'retrieve'
        })
        request = self.factory.get('/', **self.extra)
        response = view(request, pk=self.pk)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(dict(response.data, **self.note),
                         response.data)

    def test_add_notes_to_data_point(self):
        self._add_notes_to_data_point()

    def test_other_user_notes_access(self):
        self._create_user_and_login('lilly', '1234')
        extra = {
            'HTTP_AUTHORIZATION': 'Token %s' % self.user.auth_token}
        note = {'note': "Road Warrior"}
        dataid = self.xform.instances.all()[0].pk
        note['instance'] = dataid

        # Other user 'lilly' should not be able to create notes
        # to xform instance owned by 'bob'
        request = self.factory.post('/', data=note, **extra)
        self.assertTrue(self.xform.instances.count())
        response = self.view(request)
        self.assertEqual(response.status_code, 403)

        # save some notes as bob
        self._add_notes_to_data_point()

        # access to /notes endpoint, should be empty list
        request = self.factory.get('/', **extra)
        response = self.view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

        # Other user 'lilly' should not have access to bob's instance notes
        view = NoteViewSet.as_view({
            'get': 'retrieve'
        })
        request = self.factory.get('/', **extra)
        response = view(request, pk=self.pk)
        self.assertEqual(response.status_code, 404)

        # Share publicly XForm
        self.xform.shared = True
        self.xform.shared_data = True
        self.xform.save()

        # Since project is public, other user 'lilly' should have access
        # to bob's instance notes
        # Detail endpoint
        request = self.factory.get('/', **extra)
        response = view(request, pk=self.pk)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data.get('note'), note['note'])

        # List endpoint
        request = self.factory.get('/', **extra)
        response = self.view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

        # Anonymous user should also have access to bob's instance notes
        # Detail endpoint
        request = self.factory.get('/')
        response = view(request, pk=self.pk)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data.get('note'), note['note'])

        # But Anonymous user cannot still list notes
        # List endpoint
        request = self.factory.get('/')
        response = self.view(request)
        self.assertEqual(response.status_code, 401)

    def test_delete_note(self):
        self._add_notes_to_data_point()
        request = self.factory.delete('/', **self.extra)
        response = self.view(request, pk=self.pk)
        self.assertEqual(response.status_code, 204)
        request = self.factory.get('/', **self.extra)
        response = self.view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])
