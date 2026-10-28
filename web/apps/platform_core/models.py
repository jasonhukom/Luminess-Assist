import uuid
from django.db import models
from django.utils import timezone


def generate_user_id():
    return f"usr_{uuid.uuid4().hex[:8]}"


def generate_bot_id():
    return f"bot_{uuid.uuid4().hex[:8]}"


def generate_memory_id():
    return f"mem_{uuid.uuid4().hex[:8]}"


def default_appearance():
    return {
        'model': 'robot',
        'color': '#38bdf8',
        'paletteName': 'Cyber Cyan',
        'accessory': 'headphones',
        'scale': 1.0,
    }


def default_personality():
    return {
        'botName': 'Luminess',
        'userName': 'Pilot',
        'archetype': 'witty_hacker',
        'formality': 3,
        'humor': 8,
        'verbosity': 4,
        'customPrompt': 'Focus on snappy desktop automation and friendly productivity reminders.',
    }


def default_voice():
    return {
        'voiceId': 'luna-neural',
        'voiceName': 'Luna Neural (Playful AI)',
        'pitch': 1.05,
        'speed': 1.0,
    }


def default_permissions():
    return {
        'canOpenApps': True,
        'canSortFiles': True,
        'canReadClipboard': False,
        'canWriteClipboard': True,
        'canReadSystemStats': True,
        'canExecuteCommands': False,
        'canSetTimers': True,
    }


class PlatformUser(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_user_id)
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, default='user', choices=[('admin', 'Admin'), ('user', 'User')])
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'platform_users'
        verbose_name = 'Platform User'
        verbose_name_plural = 'Platform Users'

    def __str__(self):
        return f"{self.username} ({self.role})"


class BotProfile(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_bot_id)
    user = models.ForeignKey(PlatformUser, on_delete=models.CASCADE, null=True, blank=True, related_name='bot_profiles')
    bot_name = models.CharField(max_length=100, default='Luminess')
    is_active = models.BooleanField(default=True)
    pairing_code = models.CharField(max_length=32, unique=True, db_index=True)
    appearance_config = models.JSONField(default=default_appearance)
    personality_config = models.JSONField(default=default_personality)
    voice_config = models.JSONField(default=default_voice)
    permissions = models.JSONField(default=default_permissions)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bot_profiles'
        verbose_name = 'Bot Profile'
        verbose_name_plural = 'Bot Profiles'

    def __str__(self):
        return f"{self.bot_name} [{self.pairing_code}]"

    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id or 'usr_01jk984',
            'botName': self.bot_name,
            'isActive': self.is_active,
            'pairingCode': self.pairing_code,
            'appearance': self.appearance_config,
            'personality': self.personality_config,
            'voice': self.voice_config,
            'permissions': self.permissions,
            'createdAt': self.created_at.strftime('%Y-%m-%d'),
        }


class BotMemory(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_memory_id)
    bot_profile = models.ForeignKey(BotProfile, on_delete=models.CASCADE, related_name='memories')
    memory_fact = models.TextField()
    category = models.CharField(max_length=50, default='preference', choices=[
        ('preference', 'Preference'),
        ('project', 'Project'),
        ('habit', 'Habit'),
        ('hardware', 'Hardware'),
    ])
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'bot_memories'
        verbose_name = 'Bot Memory'
        verbose_name_plural = 'Bot Memories'

    def __str__(self):
        return f"[{self.category}] {self.memory_fact[:50]}..."

    def to_dict(self):
        return {
            'id': self.id,
            'botProfileId': self.bot_profile_id,
            'memoryFact': self.memory_fact,
            'category': self.category,
            'createdAt': self.created_at.strftime('%Y-%m-%d'),
        }


class AppRelease(models.Model):
    version_id = models.CharField(max_length=32, primary_key=True)
    download_url = models.TextField()
    release_notes = models.TextField(blank=True, default='')
    is_mandatory_update = models.BooleanField(default=False)
    status = models.CharField(max_length=20, default='latest', choices=[
        ('latest', 'Latest'),
        ('beta', 'Beta'),
        ('deprecated', 'Deprecated'),
    ])
    released_at = models.DateField(default=timezone.now)

    class Meta:
        db_table = 'app_releases'
        verbose_name = 'App Release'
        verbose_name_plural = 'App Releases'
        ordering = ['-released_at']

    def __str__(self):
        return f"v{self.version_id} ({self.status})"

    def to_dict(self):
        return {
            'versionId': self.version_id,
            'downloadUrl': self.download_url,
            'releaseNotes': self.release_notes,
            'isMandatoryUpdate': self.is_mandatory_update,
            'status': self.status,
            'releasedAt': self.released_at.strftime('%Y-%m-%d') if self.released_at else '',
        }


class GlobalConfig(models.Model):
    key = models.CharField(max_length=100, primary_key=True)
    value = models.TextField()
    description = models.TextField(blank=True, default='')
    last_updated = models.DateField(default=timezone.now)

    class Meta:
        db_table = 'global_config'
        verbose_name = 'Global Config Item'
        verbose_name_plural = 'Global Config Items'

    def __str__(self):
        return f"{self.key}: {self.value[:30]}"

    def to_dict(self):
        return {
            'key': self.key,
            'value': self.value,
            'description': self.description,
            'lastUpdated': self.last_updated.strftime('%Y-%m-%d') if self.last_updated else '',
        }


class FeatureFlag(models.Model):
    key = models.CharField(max_length=80, primary_key=True)
    title = models.CharField(max_length=150, blank=True, default='')
    is_enabled = models.BooleanField(default=True)
    description = models.TextField(blank=True, default='')
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'feature_flags'
        verbose_name = 'Feature Flag'
        verbose_name_plural = 'Feature Flags'

    def __str__(self):
        return f"{self.key} = {self.is_enabled}"
