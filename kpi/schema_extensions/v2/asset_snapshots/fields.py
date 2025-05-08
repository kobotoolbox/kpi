from rest_framework import serializers


class AssetSnapshotCreateDetailsField(serializers.JSONField):
    pass


class AssetSnapshotDetailsField(serializers.JSONField):
    pass


class AssetSnapshotSourceField(serializers.JSONField):
    pass


class AssetSnapshotURLField(serializers.URLField):
    pass


class AssetSnapshotURLUserField(serializers.URLField):
    pass


class AssetSnapshotURLPreviewField(serializers.URLField):
    pass


class AssetSnapshotURLXMLField(serializers.URLField):
    pass
