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
    help = 'Seeds initial Luminess Assist companion data, MariaDB tables, and community bots'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Seeding Luminess Assist MariaDB Platform core data...'))

        # 1. Seed Users
        admin_user, _ = PlatformUser.objects.get_or_create(
            id='usr_01jk984',
            defaults={
                'username': 'jasonhukom',
                'display_name': 'Jason Hukom',
                'email': 'jason@luminess.local',
                'role': 'admin',
                'bio': 'Creator of Luminess Assist — AI Desktop Companion',
                'avatar_url': 'https://avatars.githubusercontent.com/u/104183858?v=4',
                'github_username': 'jasonhukom',
                'github_repo_url': 'https://github.com/jasonhukom/Luminess-Assist',
            }
        )
        if not admin_user.password_hash:
            admin_user.set_password('luminess123')
            admin_user.save()

        cyber_user, _ = PlatformUser.objects.get_or_create(
            id='usr_02ff712',
            defaults={
                'username': 'aria_cyber',
                'display_name': 'Aria Vance',
                'email': 'aria@luminess.local',
                'role': 'user',
                'bio': 'Visual designer & pixel sprite animator. Building custom live bots.',
                'avatar_url': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
                'github_username': 'aria-cyber',
                'github_repo_url': 'https://github.com/aria-cyber/Luminess-Assist',
            }
        )
        if not cyber_user.password_hash:
            cyber_user.set_password('luminess123')
            cyber_user.save()

        # 2. Seed Default Bot Profiles (Robot, Frame-by-Frame Sprites, Video Animation)
        luminess_bot, _ = BotProfile.objects.get_or_create(
            pairing_code='LUMI-7489',
            defaults={
                'id': 'bot_active',
                'user': admin_user,
                'bot_name': 'Luminess Prime',
                'tagline': 'Official Luminess flagship desktop companion with procedural reactions.',
                'is_active': True,
                'is_public': True,
                'visual_mode': 'robot',
                'avatar_image_url': 'https://raw.githubusercontent.com/jasonhukom/Luminess-Assist/main/public/robot-icon.svg',
                'video_url': '',
                'frames_config': [],
                'appearance_config': default_appearance(),
                'greeting_message': 'Hello Pilot! Luminess Prime is online and synced with your system dock.',
                'personality_config': default_personality(),
                'voice_config': default_voice(),
                'permissions': default_permissions(),
                'github_repo': 'jasonhukom/Luminess-Assist',
                'github_repo_url': 'https://github.com/jasonhukom/Luminess-Assist',
                'forked_from': 'jasonhukom/Luminess-Assist',
                'github_branch': 'main',
                'github_sync_status': 'synced',
                'likes_count': 42,
                'views_count': 380,
            }
        )

        BotProfile.objects.get_or_create(
            pairing_code='KIKI-9021',
            defaults={
                'id': 'bot_pixel_kiki',
                'user': cyber_user,
                'bot_name': 'Kiki Pixel Sprite',
                'tagline': 'Frame-by-frame animated 16-bit retro study buddy with frame cycle emotes.',
                'is_active': False,
                'is_public': True,
                'visual_mode': 'sprite_frames',
                'avatar_image_url': 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=300&q=80',
                'video_url': '',
                'frames_config': [
                    {'id': 'f1', 'name': 'Idle Frame 1', 'url': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80', 'state': 'idle'},
                    {'id': 'f2', 'name': 'Idle Frame 2', 'url': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80', 'state': 'idle'},
                    {'id': 'f3', 'name': 'Speaking Frame', 'url': 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=300&q=80', 'state': 'talking'},
                    {'id': 'f4', 'name': 'Happy Emote', 'url': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80', 'state': 'happy'},
                ],
                'appearance_config': {
                    'model': 'pixel',
                    'color': '#ec4899',
                    'paletteName': 'Rose Quartz',
                    'accessory': 'cat_ears',
                    'scale': 1.1,
                },
                'greeting_message': 'Beep boop! Ready for another focused sprint together?',
                'personality_config': {
                    'botName': 'Kiki Pixel Sprite',
                    'userName': 'Coder',
                    'archetype': 'study_buddy',
                    'formality': 2,
                    'humor': 7,
                    'verbosity': 5,
                    'customPrompt': 'Cheer on the user during study intervals, celebrate git commits, and provide gentle rest reminders.',
                },
                'voice_config': {
                    'voiceId': 'nova-cyber',
                    'voiceName': 'Nova Synth',
                    'pitch': 1.25,
                    'speed': 1.05,
                },
                'permissions': default_permissions(),
                'github_repo': 'aria-cyber/Luminess-Assist',
                'github_repo_url': 'https://github.com/aria-cyber/Luminess-Assist',
                'forked_from': 'jasonhukom/Luminess-Assist',
                'github_branch': 'main',
                'github_sync_status': 'synced',
                'likes_count': 89,
                'views_count': 620,
            }
        )

        BotProfile.objects.get_or_create(
            pairing_code='NEBU-3342',
            defaults={
                'id': 'bot_nebula_live',
                'user': admin_user,
                'bot_name': 'Nebula Hologram Loop',
                'tagline': 'High-resolution cinematic ambient video loop companion for lofi focus sessions.',
                'is_active': False,
                'is_public': True,
                'visual_mode': 'video',
                'avatar_image_url': 'https://images.unsplash.com/photo-1507499739999-097706ad8914?auto=format&fit=crop&w=300&q=80',
                'video_url': 'https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1610-large.mp4',
                'frames_config': [],
                'appearance_config': {
                    'model': 'vtuber',
                    'color': '#a855f7',
                    'paletteName': 'Neon Violet',
                    'accessory': 'halo',
                    'scale': 1.0,
                },
                'greeting_message': 'Cosmic greetings. I am your calm ambient focus companion.',
                'personality_config': {
                    'botName': 'Nebula Hologram',
                    'userName': 'Traveler',
                    'archetype': 'butler',
                    'formality': 8,
                    'humor': 2,
                    'verbosity': 2,
                    'customPrompt': 'Deliver calm, concise, and philosophical assistance while maintaining an ambient background presence.',
                },
                'voice_config': {
                    'voiceId': 'echo-soft',
                    'voiceName': 'Echo Soft',
                    'pitch': 0.95,
                    'speed': 0.9,
                },
                'permissions': default_permissions(),
                'github_repo': 'jasonhukom/Luminess-Assist',
                'github_repo_url': 'https://github.com/jasonhukom/Luminess-Assist',
                'forked_from': 'jasonhukom/Luminess-Assist',
                'github_branch': 'main',
                'github_sync_status': 'synced',
                'likes_count': 115,
                'views_count': 940,
            }
        )

        # 3. Seed Default Memories
        initial_memories = [
            ('mem_01', 'User prefers dark mode and uses VS Code for frontend development.', 'preference'),
            ('mem_02', 'Project Luminess-Assist repository is forked from jasonhukom/Luminess-Assist.', 'project'),
            ('mem_03', 'User runs Pomodoro sprints in 25-minute intervals.', 'habit'),
        ]
        for mem_id, fact, cat in initial_memories:
            BotMemory.objects.get_or_create(
                id=mem_id,
                defaults={
                    'bot_profile': luminess_bot,
                    'memory_fact': fact,
                    'category': cat,
                }
            )

        # 4. Seed Releases
        releases = [
            ('1.1.2', 'https://github.com/jasonhukom/Luminess-Assist/releases/download/v1.1.2/Luminess-Assist_1.1.2_x64_en-US.msi',
             'Intelligent AI Authentication with normalized error recovery, MariaDB database persistence, Docker Compose stack, and community bot fork integration.', False, 'latest'),
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
            ('github_template_repository', 'jasonhukom/Luminess-Assist', 'Base template repository forked when users create a new bot creation'),
            ('database_engine', 'mariadb:11.4', 'Primary database engine running on Docker Compose port 3306 and Vercel serverless'),
        ]
        for k, v, desc in configs:
            GlobalConfig.objects.get_or_create(
                key=k,
                defaults={'value': v, 'description': desc}
            )

        # 6. Seed Feature Flags
        flags = [
            ('voiceModeEnabled', 'Voice Audio Synthesis', True, 'Real-time text-to-speech companion voice generation'),
            ('webSearchEnabled', 'Web Search Real-Time Tool', True, 'Allows bot to browse search results for updated answers'),
            ('powershellAutomationEnabled', 'PowerShell System Execution', True, 'Permissioned desktop automation scripting'),
            ('perFrameSpriteSupport', 'Per-Frame Sprite & Video Avatars', True, 'Custom visual sprite frames and video loops in bot creations'),
            ('githubForkIntegration', 'GitHub Fork & Repository Link', True, 'Connects user account and forks template repo like Vercel'),
            ('longTermMemorySyncEnabled', 'Long-Term Memory Sync', True, 'Saves learned user facts into MariaDB'),
        ]
        for k, title, enabled, desc in flags:
            FeatureFlag.objects.get_or_create(
                key=k,
                defaults={'title': title, 'is_enabled': enabled, 'description': desc}
            )

        self.stdout.write(self.style.SUCCESS('Successfully seeded MariaDB tables and initial community bots.'))
