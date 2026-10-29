import uuid
from django.db import models
from django.utils import timezone
from django.contrib.auth.hashers import make_password, check_password


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


def default_frames():
    return [
        {
            'id': 'f1',
            'name': 'Idle Frame 1',
            'url': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80',
            'state': 'idle',
        },
        {
            'id': 'f2',
            'name': 'Idle Frame 2',
            'url': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80',
            'state': 'idle',
        },
        {
            'id': 'f3',
            'name': 'Speaking Frame',
            'url': 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=300&q=80',
            'state': 'talking',
        },
        {
            'id': 'f4',
            'name': 'Emote Frame',
            'url': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80',
            'state': 'happy',
        },
    ]


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
    username = models.CharField(max_length=150, unique=True, db_index=True)
    display_name = models.CharField(max_length=150, blank=True, default='')
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=255, blank=True, default='')
    role = models.CharField(max_length=20, default='user', choices=[('admin', 'Admin'), ('user', 'User')])
    bio = models.TextField(blank=True, default='')
    avatar_url = models.TextField(blank=True, default='')
    github_username = models.CharField(max_length=100, blank=True, default='')
    github_repo_url = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'platform_users'
        verbose_name = 'Platform User'
        verbose_name_plural = 'Platform Users'

    def __str__(self):
        return f"{self.display_name or self.username} (@{self.username})"

    def set_password(self, raw_password):
        self.password_hash = make_password(raw_password)

    def check_password(self, raw_password):
        if not self.password_hash:
            return True  # Allows demo access if unset
        return check_password(raw_password, self.password_hash)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'displayName': self.display_name or self.username,
            'email': self.email,
            'role': self.role,
            'bio': self.bio,
            'avatarUrl': self.avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={self.username}",
            'githubUsername': self.github_username,
            'githubRepoUrl': self.github_repo_url,
            'createdAt': self.created_at.strftime('%Y-%m-%d'),
        }


class BotProfile(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_bot_id)
    user = models.ForeignKey(PlatformUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='bot_profiles')
    bot_name = models.CharField(max_length=100, default='Luminess')
    tagline = models.CharField(max_length=255, default='Autonomous AI desktop companion')
    is_active = models.BooleanField(default=True)
    is_public = models.BooleanField(default=True, db_index=True)
    pairing_code = models.CharField(max_length=32, unique=True, db_index=True)

    # Visual look & media configuration
    VISUAL_MODES = [
        ('robot', 'Living Robot'),
        ('sprite_frames', 'Per-Frame Sprites'),
        ('video', 'Video Loop'),
        ('image', 'Custom Image'),
        ('orb', 'Cyber Orb'),
        ('vtuber', 'VTuber / Live2D'),
    ]
    visual_mode = models.CharField(max_length=30, default='robot', choices=VISUAL_MODES)
    avatar_image_url = models.TextField(blank=True, default='')
    video_url = models.TextField(blank=True, default='')
    frames_config = models.JSONField(default=list, blank=True)
    appearance_config = models.JSONField(default=default_appearance)

    # Chat & Personality
    greeting_message = models.TextField(default='Hello Pilot! I am ready to assist.')
    personality_config = models.JSONField(default=default_personality)
    voice_config = models.JSONField(default=default_voice)
    permissions = models.JSONField(default=default_permissions)

    # GitHub integration & Repository fork connection
    github_repo = models.CharField(max_length=200, blank=True, default='')
    github_repo_url = models.TextField(blank=True, default='')
    forked_from = models.CharField(max_length=200, default='jasonhukom/Luminess-Assist')
    github_branch = models.CharField(max_length=100, default='main')
    github_sync_status = models.CharField(max_length=30, default='synced', choices=[
        ('synced', 'Synced'),
        ('pending', 'Pending Sync'),
        ('disconnected', 'Disconnected'),
    ])

    # Community metrics
    likes_count = models.IntegerField(default=0)
    views_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bot_profiles'
        verbose_name = 'Bot Profile'
        verbose_name_plural = 'Bot Profiles'
        ordering = ['-likes_count', '-created_at']

    def __str__(self):
        return f"{self.bot_name} [{self.pairing_code}] (@{self.user.username if self.user else 'anon'})"

    def to_dict(self):
        creator = self.user.to_dict() if self.user else {
            'id': 'usr_anon',
            'username': 'creator',
            'displayName': 'Community Creator',
            'avatarUrl': f"https://api.dicebear.com/7.x/bottts/svg?seed={self.bot_name}",
            'githubUsername': '',
            'githubRepoUrl': '',
        }
        return {
            'id': self.id,
            'userId': self.user_id or '',
            'creator': creator,
            'botName': self.bot_name,
            'tagline': self.tagline,
            'isActive': self.is_active,
            'isPublic': self.is_public,
            'pairingCode': self.pairing_code,
            'visualMode': self.visual_mode,
            'avatarImageUrl': self.avatar_image_url,
            'videoUrl': self.video_url,
            'framesConfig': self.frames_config or [],
            'appearance': self.appearance_config,
            'greetingMessage': self.greeting_message,
            'personality': self.personality_config,
            'voice': self.voice_config,
            'permissions': self.permissions,
            'githubRepo': self.github_repo,
            'githubRepoUrl': self.github_repo_url,
            'forkedFrom': self.forked_from,
            'githubBranch': self.github_branch,
            'githubSyncStatus': self.github_sync_status,
            'likesCount': self.likes_count,
            'viewsCount': self.views_count,
            'createdAt': self.created_at.strftime('%Y-%m-%d'),
            'updatedAt': self.updated_at.strftime('%Y-%m-%d'),
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
