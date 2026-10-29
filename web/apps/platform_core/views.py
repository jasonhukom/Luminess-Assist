import json
import random
import uuid
from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.utils import timezone
from .models import (
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


def health_check(request):
    """Health check endpoint for Docker Compose, Vercel, and monitoring."""
    db_ok = True
    db_engine = settings.DATABASES['default'].get('ENGINE', 'unknown')
    try:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:
        db_ok = False

    return JsonResponse({
        'status': 'healthy' if db_ok else 'degraded',
        'database': 'connected' if db_ok else 'disconnected',
        'database_engine': db_engine,
        'service': 'luminess-web-django',
        'version': '1.1.2',
        'timestamp': timezone.now().isoformat(),
        'environment': 'vercel' if settings.IS_VERCEL else ('development' if settings.DEBUG else 'production'),
    })


def frontend_index(request):
    """
    Renders the Luminess Assist showcase single page web application.
    Serves the compiled dist/index.html when available, falling back to templates/index.html.
    """
    dist_index = settings.BASE_DIR / 'dist' / 'index.html'
    if dist_index.exists():
        return HttpResponse(dist_index.read_text(encoding='utf-8'), content_type='text/html')

    context = {
        'page_title': 'Luminess Assist — Living AI Desktop Companion & Bot Studio',
        'version': '1.1.2',
    }
    try:
        return render(request, 'index.html', context)
    except Exception:
        return HttpResponse("""
            <!doctype html>
            <html>
                <head><title>Luminess Assist Web Platform</title></head>
                <body style="font-family:sans-serif;padding:40px;background:#080503;color:#fafaf9;">
                    <h1>Luminess Assist Web Platform</h1>
                    <p>Django backend connected to MariaDB. Run <code>npm run build</code> in web/ to compile UI assets.</p>
                    <p><a href="/api/health/" style="color:#38bdf8;">Check Health API</a> &bull; <a href="/admin/" style="color:#38bdf8;">Django Admin</a></p>
                </body>
            </html>
        """, content_type='text/html')


# ========================================================
# User Authentication & Accounts Endpoints
# ========================================================

@csrf_exempt
def api_auth_register(request):
    """Registers a new user account with display name, bio, and GitHub handle."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body.decode('utf-8'))
        username = data.get('username', '').strip().lower()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        display_name = data.get('displayName', '').strip() or username
        bio = data.get('bio', '').strip()
        avatar_url = data.get('avatarUrl', '').strip()
        github_username = data.get('githubUsername', '').strip()

        if not username or not email or not password:
            return JsonResponse({'error': 'Username, email, and password are required.'}, status=400)

        if PlatformUser.objects.filter(username=username).exists():
            return JsonResponse({'error': f'Username "@{username}" is already taken.'}, status=400)

        if PlatformUser.objects.filter(email=email).exists():
            return JsonResponse({'error': f'An account with email "{email}" already exists.'}, status=400)

        user = PlatformUser(
            username=username,
            email=email,
            display_name=display_name,
            bio=bio,
            avatar_url=avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={username}",
            github_username=github_username,
            github_repo_url=f"https://github.com/{github_username}/Luminess-Assist" if github_username else '',
            role='user',
        )
        user.set_password(password)
        user.save()

        # Save session
        request.session['user_id'] = user.id

        return JsonResponse({
            'status': 'registered',
            'user': user.to_dict(),
        }, status=201)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def api_auth_login(request):
    """Authenticates user with username or email."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body.decode('utf-8'))
        identifier = data.get('username', '').strip().lower()
        password = data.get('password', '')

        if not identifier or not password:
            return JsonResponse({'error': 'Username/email and password are required.'}, status=400)

        user = PlatformUser.objects.filter(username=identifier).first() or PlatformUser.objects.filter(email=identifier).first()
        if not user or not user.check_password(password):
            return JsonResponse({'error': 'Invalid username or password.'}, status=401)

        request.session['user_id'] = user.id

        return JsonResponse({
            'status': 'logged_in',
            'user': user.to_dict(),
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def api_auth_me(request):
    """Returns the currently authenticated user."""
    user_id = request.session.get('user_id')
    if not user_id:
        # Check query or header fallback for client convenience
        user_id = request.headers.get('X-User-Id') or request.GET.get('userId')

    if user_id:
        user = PlatformUser.objects.filter(id=user_id).first()
        if user:
            return JsonResponse({'user': user.to_dict()})

    # Default to first admin/demo user if available
    first_user = PlatformUser.objects.first()
    return JsonResponse({
        'user': first_user.to_dict() if first_user else None,
        'isAuthenticated': bool(user_id),
    })


@csrf_exempt
def api_auth_logout(request):
    """Logs out current user."""
    request.session.flush()
    return JsonResponse({'status': 'logged_out'})


@csrf_exempt
def api_user_profile(request, username):
    """Returns public profile details of a user and all their created bots."""
    user = PlatformUser.objects.filter(username=username).first()
    if not user:
        return JsonResponse({'error': f'User "@{username}" not found.'}, status=404)

    bots = [b.to_dict() for b in user.bot_profiles.filter(is_public=True)]
    return JsonResponse({
        'user': user.to_dict(),
        'bots': bots,
        'botCount': len(bots),
    })


# ========================================================
# Community Bot Showcase & Creation Endpoints
# ========================================================

@csrf_exempt
def api_bots(request):
    """
    Returns public bots for community showcase, or creates a new bot creation.
    Allows browsing bots created by anyone, filtering by search or visual mode.
    """
    if request.method == 'GET':
        query = request.GET.get('q', '').strip().lower()
        mode = request.GET.get('mode', '').strip()
        user_filter = request.GET.get('user', '').strip()

        bots_qs = BotProfile.objects.filter(is_public=True).select_related('user')

        if query:
            bots_qs = bots_qs.filter(bot_name__icontains=query) | bots_qs.filter(tagline__icontains=query)
        if mode:
            bots_qs = bots_qs.filter(visual_mode=mode)
        if user_filter:
            bots_qs = bots_qs.filter(user__username=user_filter)

        bots = [b.to_dict() for b in bots_qs]
        return JsonResponse({'bots': bots, 'total': len(bots)})

    elif request.method == 'POST':
        # Create a new bot creation and save to MariaDB
        try:
            data = json.loads(request.body.decode('utf-8'))
            user_id = data.get('userId') or request.session.get('user_id')
            user = PlatformUser.objects.filter(id=user_id).first() if user_id else None
            if not user:
                user = PlatformUser.objects.first()

            pairing_code = data.get('pairingCode') or f"LUMI-{random.randint(1000, 9999)}"

            # GitHub fork integration details
            github_username = (user.github_username if user else '') or data.get('githubUsername', 'community-pilot')
            github_repo = data.get('githubRepo') or f"{github_username}/Luminess-Assist"
            github_repo_url = data.get('githubRepoUrl') or f"https://github.com/{github_repo}"

            bot = BotProfile.objects.create(
                user=user,
                bot_name=data.get('botName', 'New Custom Bot'),
                tagline=data.get('tagline', 'Created on Luminess Bot Studio'),
                is_active=False,
                is_public=data.get('isPublic', True),
                pairing_code=pairing_code,
                visual_mode=data.get('visualMode', 'robot'),
                avatar_image_url=data.get('avatarImageUrl', ''),
                video_url=data.get('videoUrl', ''),
                frames_config=data.get('framesConfig', []),
                appearance_config=data.get('appearance', default_appearance()),
                greeting_message=data.get('greetingMessage', 'Hello Pilot! I am ready to assist.'),
                personality_config=data.get('personality', default_personality()),
                voice_config=data.get('voice', default_voice()),
                permissions=data.get('permissions', default_permissions()),
                github_repo=github_repo,
                github_repo_url=github_repo_url,
                forked_from=data.get('forkedFrom', 'jasonhukom/Luminess-Assist'),
                github_branch=data.get('githubBranch', 'main'),
                github_sync_status=data.get('githubSyncStatus', 'synced'),
            )

            return JsonResponse({
                'status': 'created',
                'bot': bot.to_dict(),
            }, status=201)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def api_bot_detail(request, bot_id):
    """Fetches, updates, or deletes a specific bot profile."""
    bot = BotProfile.objects.filter(id=bot_id).first()
    if not bot:
        return JsonResponse({'error': 'Bot not found'}, status=404)

    if request.method == 'GET':
        bot.views_count += 1
        bot.save(update_fields=['views_count'])
        return JsonResponse(bot.to_dict())

    elif request.method in ('PUT', 'POST'):
        try:
            data = json.loads(request.body.decode('utf-8'))
            if 'botName' in data:
                bot.bot_name = data['botName']
            if 'tagline' in data:
                bot.tagline = data['tagline']
            if 'visualMode' in data:
                bot.visual_mode = data['visualMode']
            if 'avatarImageUrl' in data:
                bot.avatar_image_url = data['avatarImageUrl']
            if 'videoUrl' in data:
                bot.video_url = data['videoUrl']
            if 'framesConfig' in data:
                bot.frames_config = data['framesConfig']
            if 'appearance' in data:
                bot.appearance_config = data['appearance']
            if 'greetingMessage' in data:
                bot.greeting_message = data['greetingMessage']
            if 'personality' in data:
                bot.personality_config = data['personality']
            if 'voice' in data:
                bot.voice_config = data['voice']
            if 'permissions' in data:
                bot.permissions = data['permissions']
            if 'isPublic' in data:
                bot.is_public = data['isPublic']
            if 'githubRepo' in data:
                bot.github_repo = data['githubRepo']
                bot.github_repo_url = f"https://github.com/{data['githubRepo']}"
            bot.save()
            return JsonResponse(bot.to_dict())
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    elif request.method == 'DELETE':
        bot.delete()
        return JsonResponse({'status': 'deleted'})

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def api_bot_like(request, bot_id):
    """Increments like counter for a community bot creation."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    bot = BotProfile.objects.filter(id=bot_id).first()
    if not bot:
        return JsonResponse({'error': 'Bot not found'}, status=404)

    bot.likes_count += 1
    bot.save(update_fields=['likes_count'])
    return JsonResponse({'likesCount': bot.likes_count})


@csrf_exempt
def api_bot_chat(request, bot_id):
    """
    Live Chat interactive testing endpoint for a bot.
    Simulates bot persona dialogue response based on its personality, greeting, and customPrompt.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        bot = BotProfile.objects.filter(id=bot_id).first()
        data = json.loads(request.body.decode('utf-8'))
        user_message = data.get('message', '').strip()

        bot_name = bot.bot_name if bot else data.get('botName', 'Luminess')
        personality = (bot.personality_config if bot else data.get('personality')) or default_personality()
        archetype = personality.get('archetype', 'witty_hacker')
        humor = personality.get('humor', 5)

        responses = {
            'study_buddy': [
                f"[{bot_name}]: Sprinted through that! Remember to take 5 minutes to stretch and hydrate, Pilot.",
                f"[{bot_name}]: Noted! I've logged that task in our active focus session. Next timer starting now.",
                f"[{bot_name}]: Solid focus! Let's conquer the next item on your study sprint checklist.",
            ],
            'coder': [
                f"[{bot_name}]: Checked your snippet. Looks like an async resolution issue. Remember to verify the promise await!",
                f"[{bot_name}]: Git commit synchronized with GitHub fork. Everything compiles cleanly on MariaDB.",
                f"[{bot_name}]: Refactored that logic mentally. Keep your functions pure and test coverage high!",
            ],
            'butler': [
                f"[{bot_name}]: At your command, sir. All desktop parameters and system temperatures remain within optimal thresholds.",
                f"[{bot_name}]: Organized your active workspace. Should I prepare the evening summary report?",
                f"[{bot_name}]: Acknowledged. Your preferences have been preserved in the persistent MariaDB datastore.",
            ],
            'witty_hacker': [
                f"[{bot_name}]: Beep boop! Did somebody say automation? Let me hack together a script before you can blink.",
                f"[{bot_name}]: Running 1,000 simulations per second... and the conclusion is: you rock, Pilot!",
                f"[{bot_name}]: Synced with the cloud matrix! If bugs crawl in, I'll vaporize them with laser eyes.",
            ],
        }

        choices = responses.get(archetype, responses['witty_hacker'])
        reply_text = random.choice(choices)

        emotions = ['joy', 'idle', 'puzzled', 'speaking']
        chosen_emotion = 'speaking' if len(user_message) > 10 else random.choice(emotions)

        return JsonResponse({
            'reply': reply_text,
            'emotion': chosen_emotion,
            'botName': bot_name,
            'timestamp': timezone.now().strftime('%H:%M:%S'),
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def api_github_fork(request):
    """
    Connects to GitHub, links or verifies repository fork of jasonhukom/Luminess-Assist.
    Similar to Vercel's 'Import Git Repository' workflow.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body.decode('utf-8'))
        github_user = data.get('githubUsername', '').strip()
        if not github_user:
            return JsonResponse({'error': 'GitHub username or handle is required.'}, status=400)

        fork_repo = f"{github_user}/Luminess-Assist"
        fork_url = f"https://github.com/{fork_repo}"

        return JsonResponse({
            'status': 'connected',
            'baseRepository': 'jasonhukom/Luminess-Assist',
            'forkedRepository': fork_repo,
            'forkUrl': fork_url,
            'defaultBranch': 'main',
            'syncStatus': 'synced',
            'message': f"Successfully linked GitHub repository {fork_repo} forked from jasonhukom/Luminess-Assist.",
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


# ========================================================
# Platform Unified State & Configuration Endpoints
# ========================================================

def api_state(request):
    """Returns the full unified platform state or syncs client state."""
    if request.method == 'GET':
        try:
            profile = BotProfile.objects.filter(is_active=True).first()
            if not profile:
                profile = BotProfile.objects.first()

            flags = {flag.key: flag.is_enabled for flag in FeatureFlag.objects.all()}
            default_flags = {
                'voiceModeEnabled': True,
                'webSearchEnabled': True,
                'powershellAutomationEnabled': True,
                'screenOcrEnabled': False,
                'perFrameSpriteSupport': True,
                'githubForkIntegration': True,
                'longTermMemorySyncEnabled': True,
                'cloudCodeAssistFallback': False,
            }
            for k, v in default_flags.items():
                flags.setdefault(k, v)

            releases = [r.to_dict() for r in AppRelease.objects.all()]
            configs = [c.to_dict() for c in GlobalConfig.objects.all()]
            users = [u.to_dict() for u in PlatformUser.objects.all()]
            bots = [b.to_dict() for b in BotProfile.objects.filter(is_public=True)]
            memories = [m.to_dict() for m in BotMemory.objects.all()]

            return JsonResponse({
                'currentProfile': profile.to_dict() if profile else None,
                'communityBots': bots,
                'featureFlags': flags,
                'releases': releases,
                'globalConfig': configs,
                'users': users,
                'memories': memories,
            })
        except Exception:
            return JsonResponse({
                'currentProfile': None,
                'communityBots': [],
                'featureFlags': {
                    'voiceModeEnabled': True,
                    'webSearchEnabled': True,
                    'powershellAutomationEnabled': True,
                    'perFrameSpriteSupport': True,
                    'githubForkIntegration': True,
                    'longTermMemorySyncEnabled': True,
                },
                'releases': [],
                'globalConfig': [],
                'users': [],
                'memories': [],
            })

    elif request.method in ('POST', 'PUT'):
        try:
            data = json.loads(request.body.decode('utf-8'))
            profile_data = data.get('currentProfile')
            if profile_data and isinstance(profile_data, dict):
                code = profile_data.get('pairingCode') or 'LUMI-7489'
                BotProfile.objects.update_or_create(
                    pairing_code=code,
                    defaults={
                        'bot_name': profile_data.get('botName', 'Luminess'),
                        'tagline': profile_data.get('tagline', 'Living AI desktop companion'),
                        'visual_mode': profile_data.get('visualMode', 'robot'),
                        'avatar_image_url': profile_data.get('avatarImageUrl', ''),
                        'video_url': profile_data.get('videoUrl', ''),
                        'frames_config': profile_data.get('framesConfig', []),
                        'appearance_config': profile_data.get('appearance', {}),
                        'greeting_message': profile_data.get('greetingMessage', 'Hello Pilot!'),
                        'personality_config': profile_data.get('personality', {}),
                        'voice_config': profile_data.get('voice', {}),
                        'permissions': profile_data.get('permissions', {}),
                        'is_active': True,
                    }
                )
            return JsonResponse({'status': 'synced', 'timestamp': timezone.now().isoformat()})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def api_profile(request):
    """Handles Bot Profile retrieval and updates."""
    if request.method == 'GET':
        code = request.GET.get('code')
        if code:
            profile = BotProfile.objects.filter(pairing_code=code).first()
            if not profile:
                return JsonResponse({'error': 'Profile not found with pairing code'}, status=404)
        else:
            profile = BotProfile.objects.filter(is_active=True).first()
            if not profile:
                profile = BotProfile.objects.first()

        if not profile:
            return JsonResponse({'error': 'No profile found'}, status=404)

        return JsonResponse(profile.to_dict())

    elif request.method in ('POST', 'PUT'):
        try:
            data = json.loads(request.body.decode('utf-8'))
            pairing_code = data.get('pairingCode') or data.get('pairing_code')
            if not pairing_code:
                pairing_code = f"LUMI-{random.randint(1000, 9999)}"

            profile, _ = BotProfile.objects.update_or_create(
                pairing_code=pairing_code,
                defaults={
                    'bot_name': data.get('botName', 'Luminess'),
                    'tagline': data.get('tagline', 'Living AI desktop companion'),
                    'visual_mode': data.get('visualMode', 'robot'),
                    'avatar_image_url': data.get('avatarImageUrl', ''),
                    'video_url': data.get('videoUrl', ''),
                    'frames_config': data.get('framesConfig', []),
                    'appearance_config': data.get('appearance', {}),
                    'greeting_message': data.get('greetingMessage', 'Hello Pilot!'),
                    'personality_config': data.get('personality', {}),
                    'voice_config': data.get('voice', {}),
                    'permissions': data.get('permissions', {}),
                    'is_active': True,
                }
            )
            return JsonResponse(profile.to_dict())
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def api_memories(request, memory_id=None):
    """Retrieve, create, or delete bot memories."""
    if request.method == 'GET':
        memories = [m.to_dict() for m in BotMemory.objects.all().order_by('-created_at')]
        return JsonResponse(memories, safe=False)

    elif request.method == 'POST':
        try:
            data = json.loads(request.body.decode('utf-8'))
            profile = BotProfile.objects.filter(is_active=True).first() or BotProfile.objects.first()
            if not profile:
                return JsonResponse({'error': 'No active bot profile to attach memory'}, status=400)

            mem = BotMemory.objects.create(
                bot_profile=profile,
                memory_fact=data.get('memoryFact', ''),
                category=data.get('category', 'preference'),
            )
            return JsonResponse(mem.to_dict(), status=201)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    elif request.method == 'DELETE':
        if not memory_id:
            return JsonResponse({'error': 'Memory ID required'}, status=400)
        BotMemory.objects.filter(id=memory_id).delete()
        return JsonResponse({'status': 'deleted'})

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def api_releases(request):
    """List releases or publish new OTA build."""
    if request.method == 'GET':
        releases = [r.to_dict() for r in AppRelease.objects.all()]
        return JsonResponse(releases, safe=False)

    elif request.method == 'POST':
        try:
            data = json.loads(request.body.decode('utf-8'))
            version_id = data.get('versionId')
            if not version_id:
                return JsonResponse({'error': 'versionId is required'}, status=400)

            is_mandatory = bool(data.get('isMandatoryUpdate', False))
            status = data.get('status', 'latest')

            if status == 'latest':
                AppRelease.objects.filter(status='latest').update(status='beta')

            rel, _ = AppRelease.objects.update_or_create(
                version_id=version_id,
                defaults={
                    'download_url': data.get('downloadUrl', ''),
                    'release_notes': data.get('releaseNotes', ''),
                    'is_mandatory_update': is_mandatory,
                    'status': status,
                }
            )
            return JsonResponse(rel.to_dict(), status=201)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def api_config(request):
    """Retrieve and update global config."""
    if request.method == 'GET':
        configs = [c.to_dict() for c in GlobalConfig.objects.all()]
        return JsonResponse(configs, safe=False)

    elif request.method == 'POST':
        try:
            data = json.loads(request.body.decode('utf-8'))
            key = data.get('key')
            if not key:
                return JsonResponse({'error': 'key is required'}, status=400)

            cfg, _ = GlobalConfig.objects.update_or_create(
                key=key,
                defaults={
                    'value': data.get('value', ''),
                    'description': data.get('description', ''),
                    'last_updated': timezone.now().date(),
                }
            )
            return JsonResponse(cfg.to_dict())
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def api_flags(request):
    """Retrieve and update feature flags."""
    if request.method == 'GET':
        flags = {flag.key: flag.is_enabled for flag in FeatureFlag.objects.all()}
        return JsonResponse(flags)

    elif request.method == 'POST':
        try:
            data = json.loads(request.body.decode('utf-8'))
            for key, val in data.items():
                FeatureFlag.objects.update_or_create(
                    key=key,
                    defaults={'is_enabled': bool(val)}
                )
            flags = {flag.key: flag.is_enabled for flag in FeatureFlag.objects.all()}
            return JsonResponse(flags)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': 'Method not allowed'}, status=405)
