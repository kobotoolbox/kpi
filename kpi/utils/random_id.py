# coding: utf-8
import string
import random
alphabet = string.ascii_letters + string.digits


def random_id(length):
    return ''.join(random.choice(alphabet) for _ in range(length))
