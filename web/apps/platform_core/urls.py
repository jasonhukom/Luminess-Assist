from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health_check, name='api_health'),
    path('state/', views.api_state, name='api_state'),
    path('profile/', views.api_profile, name='api_profile'),
    path('memories/', views.api_memories, name='api_memories'),
    path('memories/<str:memory_id>/', views.api_memories, name='api_memory_detail'),
    path('releases/', views.api_releases, name='api_releases'),
    path('config/', views.api_config, name='api_config'),
    path('flags/', views.api_flags, name='api_flags'),
]
