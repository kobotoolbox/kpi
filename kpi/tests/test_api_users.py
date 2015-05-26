from rest_framework.test import APITestCase
from django.core.urlresolvers import reverse
from rest_framework import status

# class UserListTests(APITestCase):
#     fixtures = ['test_data']

#     # def setUp(self):
#     #     self.client.login(username='admin', password='pass')

#     def test_anonymous_user_list(self):
#         """
#         Ensure we can create a new collection object.
#         """
#         url = reverse('user-list')
#         data = {'name': 'my collection', 'collections': [], 'assets': []}
#         # response = self.client.post(url, data, format='json')
#         # self.assertEqual(response.status_code, status.HTTP_201_CREATED)
#         # self.assertEqual(response.data['name'], 'my collection')
