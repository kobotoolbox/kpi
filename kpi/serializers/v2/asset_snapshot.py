# coding: utf-8
from rest_framework import exceptions, serializers
from rest_framework.relations import HyperlinkedIdentityField
from rest_framework.reverse import reverse

from kpi.constants import PERM_VIEW_ASSET
from kpi.fields import RelativePrefixHyperlinkedRelatedField, WritableJSONField
from kpi.models import Asset, AssetSnapshot


class AssetSnapshotSerializer(serializers.HyperlinkedModelSerializer):
    url = HyperlinkedIdentityField(
         lookup_field='uid',
         view_name='assetsnapshot-detail')
    uid = serializers.ReadOnlyField()
    xml = serializers.SerializerMethodField()
    enketopreviewlink = serializers.SerializerMethodField()
    details = WritableJSONField(required=False)
    asset = RelativePrefixHyperlinkedRelatedField(
        queryset=Asset.objects.all(),
        view_name='asset-detail',
        lookup_field='uid',
        required=False,
        allow_null=True,
        style={'base_template': 'input.html'}  # Render as a simple text box
    )
    owner = RelativePrefixHyperlinkedRelatedField(
        view_name='user-detail',
        lookup_field='username',
        read_only=True
    )
    asset_version_id = serializers.ReadOnlyField()
    date_created = serializers.DateTimeField(read_only=True)
    source = WritableJSONField(required=False)

    def get_xml(self, obj):
        """
        There's too much magic in HyperlinkedIdentityField. When format is
        unspecified by the request, HyperlinkedIdentityField.to_representation()
        refuses to append format to the url. We want to *unconditionally*
        include the xml format suffix.
        :param obj: AssetSnapshot
        :return: str
        """
        return reverse(
            viewname='assetsnapshot-detail',
            format='xml',
            kwargs={'uid': obj.uid},
            request=self.context.get('request', None)
        )

    def get_enketopreviewlink(self, obj):
        return reverse(
            viewname='assetsnapshot-preview',
            kwargs={'uid': obj.uid},
            request=self.context.get('request', None)
        )

    def create(self, validated_data):
        """
        Create a snapshot of an asset, either by copying an existing
        asset's content or by accepting the source directly in the request.
        Transform the source into XML that's then exposed to Enketo
        (and the www).
        """
        asset = validated_data.get('asset', None)
        source = validated_data.get('source', None)

        # Force owner to be the requesting user
        # NB: validated_data is not used when linking to an existing asset
        # without specifying source; in that case, the snapshot owner is the
        # asset's owner, even if a different user makes the request
        validated_data['owner'] = self.context['request'].user

        # TODO: Move to a validator?
        if asset and source:
            if not self.context['request'].user.has_perm(PERM_VIEW_ASSET, asset):
                # The client is not allowed to snapshot this asset
                raise exceptions.PermissionDenied
            validated_data['source'] = source
            snapshot = AssetSnapshot.objects.create(**validated_data)
        elif asset:
            # The client provided an existing asset; read source from it
            if not self.context['request'].user.has_perm(PERM_VIEW_ASSET, asset):
                # The client is not allowed to snapshot this asset
                raise exceptions.PermissionDenied
            # asset.snapshot pulls , by default, a snapshot for the latest
            # version.
            snapshot = asset.snapshot
        elif source:
            # The client provided source directly; no need to copy anything
            # For tidiness, pop off unused fields. `None` avoids KeyError
            validated_data.pop('asset', None)
            validated_data.pop('asset_version', None)
            snapshot = AssetSnapshot.objects.create(**validated_data)
        else:
            raise serializers.ValidationError('Specify an asset and/or a source')

        if not snapshot.xml:
            raise serializers.ValidationError(snapshot.details)
        return snapshot

    class Meta:
        model = AssetSnapshot
        lookup_field = 'uid'
        fields = ('url',
                  'uid',
                  'owner',
                  'date_created',
                  'xml',
                  'enketopreviewlink',
                  'asset',
                  'asset_version_id',
                  'details',
                  'source',
                  )
