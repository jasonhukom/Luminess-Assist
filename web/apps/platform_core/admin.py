from django.contrib import admin
from .models import PlatformUser, BotProfile, BotMemory, AppRelease, GlobalConfig, FeatureFlag


@admin.register(PlatformUser)
class PlatformUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'role', 'created_at')
    search_fields = ('username', 'email')
    list_filter = ('role', 'created_at')


@admin.register(BotProfile)
class BotProfileAdmin(admin.ModelAdmin):
    list_display = ('bot_name', 'pairing_code', 'is_active', 'user', 'created_at')
    search_fields = ('bot_name', 'pairing_code')
    list_filter = ('is_active', 'created_at')


@admin.register(BotMemory)
class BotMemoryAdmin(admin.ModelAdmin):
    list_display = ('memory_fact', 'category', 'bot_profile', 'created_at')
    search_fields = ('memory_fact', 'category')
    list_filter = ('category', 'created_at')


@admin.register(AppRelease)
class AppReleaseAdmin(admin.ModelAdmin):
    list_display = ('version_id', 'status', 'is_mandatory_update', 'released_at', 'download_url')
    list_filter = ('status', 'is_mandatory_update', 'released_at')
    search_fields = ('version_id', 'release_notes')


@admin.register(GlobalConfig)
class GlobalConfigAdmin(admin.ModelAdmin):
    list_display = ('key', 'value', 'last_updated')
    search_fields = ('key', 'value', 'description')


@admin.register(FeatureFlag)
class FeatureFlagAdmin(admin.ModelAdmin):
    list_display = ('key', 'title', 'is_enabled', 'last_updated')
    list_filter = ('is_enabled',)
    search_fields = ('key', 'title', 'description')
