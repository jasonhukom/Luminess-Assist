"""
URL configuration for luminess_web project.
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.static import serve
from apps.platform_core.views import frontend_index, health_check

urlpatterns = [
    path('admin/', admin.site.urls),
    path('health/', health_check, name='health_check'),
    path('api/', include('apps.platform_core.urls')),
    re_path(r'^assets/(?P<path>.*)$', serve, {'document_root': settings.BASE_DIR / 'dist' / 'assets'}),
    re_path(r'^(?P<path>robot-icon\.svg|favicon\.ico)$', serve, {'document_root': settings.BASE_DIR / 'dist'}),
    # Frontend fallback: serves the application for root and any subroutes
    re_path(r'^(?!assets/|static/|media/|admin/|api/|health/|robot-icon\.svg|favicon\.ico).*$', frontend_index, name='frontend_index'),
]
