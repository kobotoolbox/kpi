# coding: utf-8
from __future__ import (unicode_literals, print_function,
                        absolute_import, division)


from kpi.tests.api.v2 import test_api_users


class UserListTests(test_api_users.UserListTests):

    URL_NAMESPACE = None
