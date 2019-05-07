# -*- coding: utf-8 -*-
from __future__ import absolute_import, unicode_literals

from rest_framework.reverse import reverse, reverse_lazy


class UrlHelper:

    def __init__(self):
        pass

    @staticmethod
    def reverse(viewname, *args, **kwargs):
        """
        Has the same behavior as `rest_framework.reverse.reverse`,
        except it adds namespace if needed.

        :param viewname: str
        :param namespace: str
        :return: str
        """
        context = kwargs.pop('context', None)
        namespace = None

        if context:
            try:
                namespace = context.get('view').URL_NAMESPACE
            except AttributeError:
                pass

        if namespace is not None:
            viewname = '{namespace}:{viewname}'.format(
                namespace=namespace,
                viewname=viewname
            )

        return reverse(viewname, *args, **kwargs)

    @staticmethod
    def reverse_lazy(viewname, *args, **kwargs):
        """
        Has the same behavior as `rest_framework.reverse.reverse_lazy`,
        except it adds namespace if needed.

        :param viewname: str
        :param namespace: str
        :return: str
        """
        context = kwargs.get('context')
        namespace = None
        if context:
            namespace = getattr(context.get('view'), 'URL_NAMESPACE')

        if namespace is not None:
            viewname = '{namespace}:{viewname}'.format(
                namespace=namespace,
                viewname=viewname
            )

        return reverse_lazy(viewname, *args, **kwargs)

