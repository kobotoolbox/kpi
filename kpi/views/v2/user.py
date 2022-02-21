# coding: utf-8
from multiprocessing.sharedctypes import Value
import re
from django.contrib.auth.models import User, Group, Permission
from rest_framework import status, viewsets
from rest_framework.authentication import SessionAuthentication, BasicAuthentication, TokenAuthentication
from rest_framework.response import Response
from rest_framework.reverse import reverse

from kpi.tasks import sync_kobocat_xforms
from kpi.models.authorized_application import ApplicationTokenAuthentication
from kpi.serializers.v2.user import UserSerializer, GroupSerializer, PermissionSerializer
from kpi.permissions import UserActionPermission


# Create your views here.
class UserViewSet(viewsets.ModelViewSet):

    queryset = User.objects.all()
    serializer_class = UserSerializer
    lookup_field = 'username'
    authentication_classes = [SessionAuthentication, BasicAuthentication, TokenAuthentication]
    permission_classes = (UserActionPermission,)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def get_pk_from_url(self, url, url_type):
        try:
            # check if the last char is '/' or not
            if url[-1] == '/':
                url = url[:-1]

            last_index = url.rindex(url_type)
            pk = int(url[last_index + len(url_type):])

            return pk

        except:
            return -1

    def list(self, request, *args, **kwargs):
        return super().list(request, args, kwargs)

    def create(self, request, *args, **kwargs):
        """Create and return a new user."""
        requested_data = request.data
        response_data = {}
        try:
            if 'username' not in requested_data:
                return Response({
                    'error': '"username" should be included.'
                }, status=status.HTTP_400_BAD_REQUEST)

            user = User(
                username=requested_data['username'],
            )
            response_data['username'] = requested_data['username']

            if 'password' not in requested_data:
                return Response({
                    'error': '"password" should be included.'
                }, status=status.HTTP_400_BAD_REQUEST)

            if requested_data['password'] == '':
                return Response({
                    'error': '"password" should not be blank.'
                }, status=status.HTTP_400_BAD_REQUEST)

            user.set_password(requested_data['password'])  # Hash the raw password
            response_data['password'] = requested_data['password']

            if 'first_name' in requested_data:
                user.first_name = requested_data['first_name']
                response_data['first_name'] = requested_data['first_name']

            if 'last_name' in requested_data:
                user.last_name = requested_data['last_name']
                response_data['last_name'] = requested_data['last_name']

            if 'email' in requested_data:
                regex = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
                if re.fullmatch(regex, requested_data['email']):
                    user.email = requested_data['email']
                    response_data['email'] = requested_data['email']
                else:
                    return Response({
                        'error': 'email address is invalid.'
                    }, status=status.HTTP_400_BAD_REQUEST)

            if 'is_active' in requested_data:
                if requested_data['is_active']:
                    user.is_active = 1
                else:
                    user.is_active = 0
                response_data['is_active'] = requested_data['is_active']

            if 'is_superuser' in requested_data:
                if requested_data['is_superuser']:
                    user.is_superuser = 1
                else:
                    user.is_superuser = 0
                response_data['is_superuser'] = requested_data['is_superuser']

            if 'is_staff' in requested_data:
                if requested_data['is_staff']:
                    user.is_staff = 1
                else:
                    user.is_staff = 0
                response_data['is_staff'] = requested_data['is_staff']

            user.save()
            user.groups.clear()
            user.user_permissions.clear()

        except Exception as e:
            if str(e) == '':
                return Response(response_data, status=status.HTTP_201_CREATED)
            else:
                return Response({
                    'error': 'Account could not be created with received data.' + str(e)
                }, status=status.HTTP_400_BAD_REQUEST)

        return Response(response_data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        requested_data = request.data
        response_data = {}
        try:
            user = self.get_object()

            if 'username' in requested_data:
                if User.objects.filter(username=requested_data['username']).exclude(pk=user.id).count() > 0:
                    return Response({
                        'error': 'This username is already in use for other account.'
                    }, status=status.HTTP_400_BAD_REQUEST)

                user.username = requested_data['username']
                response_data['username'] = requested_data['username']

            if 'password' in requested_data:
                user.set_password(requested_data['password'])
                response_data['password'] = requested_data['password']

            if 'first_name' in requested_data:
                user.first_name = requested_data['first_name']
                response_data['first_name'] = requested_data['first_name']

            if 'last_name' in requested_data:
                user.last_name = requested_data['last_name']
                response_data['last_name'] = requested_data['last_name']

            if 'email' in requested_data:
                regex = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
                if re.fullmatch(regex, requested_data['email']):
                    user.email = requested_data['email']
                    response_data['email'] = requested_data['email']
                else:
                    return Response({
                        'error': 'email address is invalid.'
                    }, status=status.HTTP_400_BAD_REQUEST)

            if 'is_active' in requested_data:
                if requested_data['is_active']:
                    user.is_active = 1
                else:
                    user.is_active = 0
                response_data['is_active'] = requested_data['is_active']

            if 'is_superuser' in requested_data:
                if requested_data['is_superuser']:
                    user.is_superuser = 1
                else:
                    user.is_superuser = 0
                response_data['is_superuser'] = requested_data['is_superuser']

            if 'is_staff' in requested_data:
                if requested_data['is_staff']:
                    user.is_staff = 1
                else:
                    user.is_staff = 0
                response_data['is_staff'] = requested_data['is_staff']

            if 'groups' in requested_data:
                user.groups.clear()
                for g in requested_data['groups']:
                    g_pk = self.get_pk_from_url(g, 'groups/')
                    if g_pk == -1:
                        return Response({
                            'error': 'Invalid "groups" is listed.'
                        }, status=status.HTTP_400_BAD_REQUEST)
                    user.groups.add(g_pk)
                response_data['groups'] = requested_data['groups']

            if 'user_permissions' in requested_data:
                user.user_permissions.clear()
                for p in requested_data['user_permissions']:
                    p_pk = self.get_pk_from_url(p, 'user_permissions/')
                    if p_pk == -1:
                        return Response({
                            'error': 'Invalid "user_permission" is listed.'
                        }, status=status.HTTP_400_BAD_REQUEST)
                    user.user_permissions.add(p_pk)
                response_data['user_permissions'] = requested_data['user_permissions']

            user.save()

        except Exception as e:
            if str(e) == '':
                return Response(response_data, status=status.HTTP_200_OK)
            else:
                return Response({
                    'error': 'Account could not be updated with received data.' + str(e)
                }, status=status.HTTP_400_BAD_REQUEST)

        return Response(response_data)
    

class GroupViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows users to be viewed or edited.
    """
    queryset = Group.objects.all()
    serializer_class = GroupSerializer


class PermissionViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows users to be viewed or edited.
    """
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer

