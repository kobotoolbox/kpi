# -*- coding: utf-8 -*-
from __future__ import absolute_import

from .tasks import service_definition_task


class HookUtils(object):

    @staticmethod
    def call_service(asset, data):
        """

        :param asset: Asset.
        :param data: str. stringified JSON representation of submitted data
        """
        # call service send with url and data parameters
        for hook in asset.hooks.filter(active=True).all():
            service_definition_task.delay(hook, data)
