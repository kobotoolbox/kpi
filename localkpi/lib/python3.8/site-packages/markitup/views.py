from __future__ import unicode_literals

from django.shortcuts import render

from markitup import settings
from markitup.markup import filter_func


def apply_filter(request):
    markup = filter_func(request.POST.get('data', ''))
    return render(request, 'markitup/preview.html', {'preview': markup})
