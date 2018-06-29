# -*- coding: utf-8 -*-
from abc import ABCMeta, abstractmethod


class ServiceDefinitionInterface(object):

    __metaclass__ = ABCMeta

    @classmethod
    @abstractmethod
    def send(cls, hook, data=None):
        pass

    @staticmethod
    def save_log(hook, submission_uuid, status_code, message):
        pass
        # TODO save log in DB
        # log = HookLog(
        #    instance_uuid=dict_data.get("uuid"),
        #    status_code=status_code,
        #    message=message,
        #    hook=hook
        # )
        # log.save()