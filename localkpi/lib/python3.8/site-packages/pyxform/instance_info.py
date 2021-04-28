# -*- coding: utf-8 -*-
"""
InstanceInfo class module.
"""


class InstanceInfo(object):
    """Standardise Instance details relevant during XML generation."""

    def __init__(self, type, context, name, src, instance):
        self.type = type
        self.context = context
        self.name = name
        self.src = src
        self.instance = instance
