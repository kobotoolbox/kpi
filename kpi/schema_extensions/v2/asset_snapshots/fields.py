from rest_framework import serializers


class AssetSnapshotCreateDetailsField(serializers.JSONField):
    pass


class AssetSnapshotDetailsField(serializers.JSONField):
    pass


class AssetSnapshotSourceField(serializers.JSONField):
    pass


class AssetSnapshotURLField(serializers.URLField):
    pass


class AssetSnapshotUserURLField(serializers.URLField):
    pass


class AssetSnapshotPreviewURLField(serializers.URLField):
    pass


class AssetSnapshotXMLURLField(serializers.URLField):
    pass
