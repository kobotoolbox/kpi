# -*- coding: utf-8 -*-
from __future__ import absolute_import

from rest_framework.serializers import HyperlinkedIdentityField
from .versioned_hyperlinked_related import VersionedHyperlinkedRelatedField


class VersionedHyperlinkedIdentityField(HyperlinkedIdentityField,
                                        VersionedHyperlinkedRelatedField):

    pass
