from django.contrib import admin
from .models import PlatformUser, BotProfile, BotMemory, AppRelease, GlobalConfig, FeatureFlag


@admin.register(PlatformUser)
class PlatformUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'display_name', 'email', 'role', 'github_username', 'created_at')
    search_fields = ('username', 'display_name', 'email', 'github_username')
    list_filter = ('role', 'created_at')


@admin.register(BotProfile)
class BotProfileAdmin(admin.ModelAdmin):
    list_display = ('bot_name', 'user', 'visual_mode', 'pairing_code', 'is_active', 'is_public', 'github_repo', 'likes_count')
    list_filter = ('visual_mode', 'is_active', 'is_public', 'github_sync_status')
    search_fields = ('bot_name', 'pairing_code', 'github_repo')


@admin.register(BotMemory)
class BotMemoryAdmin(admin.ModelAdmin):
    list_display = ('bot_profile', 'category', 'memory_fact', 'created_at')
    list_filter = ('category', 'created_at')
    search_fields = ('memory_fact',)


@admin.register(AppRelease)
class AppReleaseAdmin(admin.ModelAdmin):
    list_display = ('version_id', 'status', 'is_mandatory_update', 'released_at')
    list_filter = ('status', 'is_mandatory_update')


@admin.register(GlobalConfig)
class GlobalConfigAdmin(admin.ModelAdmin):
    list_display = ('key', 'value', 'description', 'last_updated')
    search_fields = ('key', 'description')


@admin.register(FeatureFlag)
class FeatureFlagAdmin(admin.ModelAdmin):
    list_display = ('key', 'title', 'is_enabled', 'last_updated')
    list_filter = ('is_enabled',)
