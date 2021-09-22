'''
Class to house Organization info, organizations should always exist in the core Veritree API
This model is used to sync information and to maintain links between forms that are shared with
the organization
'''
from django.db import models
from kpi.models import Asset

class Organization(models.Model):
    NGO = 'ngo'
    REGULAR = 'organization'
    ORG_CHOICES = (
        (NGO, NGO),
        (REGULAR, REGULAR)
    )
    name = models.CharField(max_length=200)
    veritree_id = models.PositiveIntegerField(unique=True)
    org_type = models.CharField(max_length=100, choices=ORG_CHOICES, default=REGULAR)
    assets = models.ManyToManyField(Asset, related_name='organizations')
