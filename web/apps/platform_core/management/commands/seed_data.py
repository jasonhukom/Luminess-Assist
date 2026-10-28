from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.platform_core.models import (
    PlatformUser,
    BotProfile,
    BotMemory,
    AppRelease,
    GlobalConfig,
    FeatureFlag,
    default_appearance,
    default_personality,
    default_voice,
    default_permissions,
)


class Command(BaseCommand):
    help = 'Seeds initial Luminess Assist companion data and platform tables'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Seeding Luminess Assist Platform core data...'))

        # 1. Seed Users
        admin_user, _ = PlatformUser.objects.get_or_create(
            id='usr_01jk984',
            defaults={
                'username': 'jasonhukom',
                'email': 'jason@luminess.local',
                'role': 'admin',
            }
        )
        PlatformUser.objects.get_or_create(
            id='usr_02ff712',
            defaults={
                'username': 'alex_cyber',
                'email': 'alex@luminess.local',
                'role': 'user',
            }
        )

        # 2. Seed Default Bot Profile
        profile, created = BotProfile.objects.get_or_create(
            pairing_code='LUMI-7489',
            defaults={
                'id': 'bot_active',
                'user': admin_user,
                'bot_name': 'Luminess',
                'is_active': True,
                'appearance_config': default_appearance(),
                'personality_config': default_personality(),
                'voice_config': default_voice(),
                'permissions': default_permissions(),
            }
        )

        # 3. Seed Default Memories
        initial_memories = [
            ('mem_01', 'User prefers dark mode and uses VS Code for frontend development.', 'preference'),
            ('mem_02', 'Project Luminess-Assist repository is located at ~/Documents/VSCODE/LuminessAssist/Luminess-Assist.', 'project'),
            ('mem_03', 'User runs Pomodoro sprints in 25-minute intervals.', 'habit'),
        ]
        for mem_id, fact, cat in initial_memories:
            BotMemory.objects.get_or_create(
                id=mem_id,
                defaults={
                    'bot_profile': profile,
                    'memory_fact': fact,
                    'category': cat,
                }
            )

        # 4. Seed Releases
        releases = [
            ('1.1.2', 'https://github.com/jasonhukom/Luminess-Assist/releases/download/v1.1.2/Luminess-Assist_1.1.2_x64_en-US.msi',
             'Intelligent AI Authentication with normalized error recovery, Antigravity CLI detection, dock vertical toggle, and interactive companion modes.', False, 'latest'),
            ('1.1.3-beta', 'https://github.com/jasonhukom/Luminess-Assist/releases/tag/v1.1.3-beta',
             'Early testing build for dynamic web customizer deep linking and hardware sensor reaction loop.', False, 'beta'),
            ('1.0.8', 'https://github.com/jasonhukom/Luminess-Assist/releases/tag/v1.0.8',
             'Legacy release without persistent relationships and desktop shortcuts.', False, 'deprecated'),
        ]
        for vid, url, notes, mandatory, status in releases:
            AppRelease.objects.get_or_create(
                version_id=vid,
                defaults={
                    'download_url': url,
                    'release_notes': notes,
                    'is_mandatory_update': mandatory,
                    'status': status,
                }
            )

        # 5. Seed Global Config
        configs = [
            ('active_default_ai_model', 'gemini-2.5-flash', 'Primary AI model used for zero-configuration desktop requests'),
            ('master_guardrail_prompt', 'Always reply in valid JSON { content: string, emotion: Emotion }. Never execute file deletion without explicit approval. Treat system paths respectfully.', 'Hidden master guardrail wrapped around every custom bot personality'),
            ('maintenance_mode', 'false', 'Global maintenance flag for cloud token proxying and telemetry'),
            ('pairing_code_expiry_minutes', '1440', 'Lifetime of pairing tokens generated on the Web Studio before desktop claim'),
        ]
        for k, v, desc in configs:
            GlobalConfig.objects.get_or_create(
                key=k,
                defaults={'value': v, 'description': desc}
            )

        # 6. Seed Feature Flags
        flags = [
            ('voiceModeEnabled', 'Global Voice Mode (TTS Audio)', True, 'Disables TTS globally if server latency degrades.'),
            ('webSearchEnabled', 'Web Browsing & Search Integration', True, 'Disables external search queries if rate limits are reached.'),
            ('powershellAutomationEnabled', 'PowerShell System Automation', True, 'Prevents desktop bots from running terminal commands in safe mode.'),
            ('screenOcrEnabled', 'Screen Reading & Vision OCR', False, 'Toggles screen capture processing capabilities.'),
            ('longTermMemorySyncEnabled', 'Long-Term Memory Sync', True, 'Synchronizes bot memories across cloud database tables.'),
            ('cloudCodeAssistFallback', 'Cloud Code Assist Fallback Route', False, 'Restricts legacy internal Code Assist proxy routing.'),
        ]
        for k, title, enabled, desc in flags:
            FeatureFlag.objects.get_or_create(
                key=k,
                defaults={'title': title, 'is_enabled': enabled, 'description': desc}
            )

        self.stdout.write(self.style.SUCCESS('Successfully seeded Luminess database!'))
