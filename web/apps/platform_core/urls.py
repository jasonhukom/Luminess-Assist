from django.urls import path
from . import views

urlpatterns = [
    # Core Health & State
    path('health/', views.health_check, name='api_health'),
    path('state/', views.api_state, name='api_state'),

    # User Authentication & Profiles
    path('auth/register/', views.api_auth_register, name='api_auth_register'),
    path('auth/login/', views.api_auth_login, name='api_auth_login'),
    path('auth/me/', views.api_auth_me, name='api_auth_me'),
    path('auth/logout/', views.api_auth_logout, name='api_auth_logout'),
    path('users/<str:username>/', views.api_user_profile, name='api_user_profile'),

    # Community Bots Showcase & Creation
    path('bots/', views.api_bots, name='api_bots'),
    path('bots/create/', views.api_bots, name='api_bots_create'),
    path('bots/<str:bot_id>/', views.api_bot_detail, name='api_bot_detail'),
    path('bots/<str:bot_id>/like/', views.api_bot_like, name='api_bot_like'),
    path('bots/<str:bot_id>/chat/', views.api_bot_chat, name='api_bot_chat'),

    # GitHub Fork & Integration
    path('github/fork/', views.api_github_fork, name='api_github_fork'),

    # Desktop Companion Profile & Sync
    path('profile/', views.api_profile, name='api_profile'),
    path('memories/', views.api_memories, name='api_memories'),
    path('memories/<str:memory_id>/', views.api_memories, name='api_memory_detail'),

    # Admin Configurations & Releases
    path('releases/', views.api_releases, name='api_releases'),
    path('config/', views.api_config, name='api_config'),
    path('flags/', views.api_flags, name='api_flags'),
]
