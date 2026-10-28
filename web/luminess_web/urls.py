"""
URL configuration for luminess_web project.
"""
from django.contrib import admin
from django.urls import path, include, re_path
from apps.platform_core.views import frontend_index, health_check

urlpatterns = [
    path('admin/', admin.site.urls),
    path('health/', health_check, name='health_check'),
    path('api/', include('apps.platform_core.urls')),
    # Frontend fallback: serves the application for root and any subroutes
    re_path(r'^(?!static/|media/|admin/|api/|health/).*$', frontend_index, name='frontend_index'),
]
