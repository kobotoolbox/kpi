from kpi import deployment_backends
from django.utils import timezone
import re

def test_conf():

    my_var = "test"
    my_super_long = "asdfdfasd fwdf asdf asdf asdf asdf awdfgadfg qwdg qwdf qwefg qrw3g"

    if my_var == "test":
        print('echo')

    if timezone.now().date() == timezone.now().date():
        re.compile("foo", re.IGNORECASE)

def mon_autre():
    my_class = MyClass()


class MyClass():


    def __init__(self):
        pass




    def __str__(self):
        pass
