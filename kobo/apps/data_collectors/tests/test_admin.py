from django.contrib.admin.sites import site
from django.test import RequestFactory, TestCase

from kobo.apps.data_collectors.admin import DataCollectorGroupAdmin
from kobo.apps.data_collectors.models import DataCollector, DataCollectorGroup
from kobo.apps.kobo_auth.shortcuts import User
from kpi.models import Asset


class AdminTestCase(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.data_collector_group = DataCollectorGroup.objects.create(
            name='DCG_0', owner=self.someuser
        )
        self.dc0 = DataCollector.objects.create(
            group=self.data_collector_group, name='dc0'
        )
        self.dc1 = DataCollector.objects.create(
            group=self.data_collector_group, name='dc1'
        )
        self.asset = Asset.objects.filter(owner=self.someuser).first()
        self.asset.data_collector_group = self.data_collector_group
        self.asset.save()

    def test_form_only_shows_available_assets(self):
        admin = DataCollectorGroupAdmin(DataCollectorGroup, site)
        request = RequestFactory().get('/')
        request.user = User.objects.get(username='adminuser')
        asset_from_another_user = Asset.objects.create(
            owner=User.objects.get(username='anotheruser')
        )
        asset_in_another_group = Asset.objects.create(
            owner=self.someuser,
            data_collector_group=DataCollectorGroup.objects.create(
                name='DCG_1', owner=self.someuser
            ),
        )
        available_asset = Asset.objects.filter(owner=self.someuser)[1]
        FormClass = admin.get_form(request=request, obj=self.data_collector_group)
        assets_in_queryset = FormClass.base_fields['assets'].queryset.all()
        assert asset_from_another_user not in assets_in_queryset
        assert asset_in_another_group not in assets_in_queryset
        assert available_asset in assets_in_queryset
        # make sure we include assets already belonging to the group
        assert self.asset in assets_in_queryset

    def test_add_assets_to_group(self):
        admin = DataCollectorGroupAdmin(DataCollectorGroup, site)
        add_asset = Asset.objects.filter(owner=self.someuser)[1]
        add_asset.save()
        request = RequestFactory().post(
            '/',
            data={
                'owner': self.someuser.pk,
                'name': 'dc0',
                'assets': [self.asset.pk, add_asset.pk],
            },
        )
        request.user = User.objects.get(username='adminuser')
        DCForm = admin.get_form(request, self.data_collector_group, change=True)
        form = DCForm(request.POST, request.FILES, instance=self.data_collector_group)
        form.is_valid()
        admin.save_model(
            request=request, obj=self.data_collector_group, form=form, change=True
        )
        self.asset.refresh_from_db()
        add_asset.refresh_from_db()
        assert self.asset.data_collector_group_id == self.data_collector_group.pk
        assert add_asset.data_collector_group_id == self.data_collector_group.pk

    def test_remove_assets_from_group(self):
        admin = DataCollectorGroupAdmin(DataCollectorGroup, site)
        asset_to_remove = Asset.objects.filter(owner=self.someuser)[1]
        asset_to_remove.data_collector_group = self.data_collector_group
        asset_to_remove.save()
        request = RequestFactory().post(
            '/',
            data={'owner': self.someuser.pk, 'name': 'dc0', 'assets': [self.asset.pk]},
        )
        request.user = User.objects.get(username='adminuser')
        DCForm = admin.get_form(request, self.data_collector_group, change=True)
        form = DCForm(request.POST, request.FILES, instance=self.data_collector_group)
        form.is_valid()
        admin.save_model(
            request=request, obj=self.data_collector_group, form=form, change=True
        )
        self.asset.refresh_from_db()
        asset_to_remove.refresh_from_db()
        assert self.asset.data_collector_group_id == self.data_collector_group.pk
        assert asset_to_remove.data_collector_group_id is None
