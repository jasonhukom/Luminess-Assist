import json
from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.utils import timezone
from .models import PlatformUser, BotProfile, BotMemory, AppRelease, GlobalConfig, FeatureFlag


def health_check(request):
    """Health check endpoint for Docker Compose, Vercel, and monitoring."""
    db_ok = True
    try:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception as e:
        db_ok = False

    return JsonResponse({
        'status': 'healthy' if db_ok else 'degraded',
        'database': 'connected' if db_ok else 'disconnected',
        'service': 'luminess-web-django',
        'version': '1.1.2',
        'timestamp': timezone.now().isoformat(),
        'environment': 'vercel' if settings.IS_VERCEL else ('development' if settings.DEBUG else 'production'),
    })


def frontend_index(request):
    """
    Renders the Luminess Assist showcase single page web application.
    Tries templates/index.html first, then dist/index.html.
    """
    context = {
        'page_title': 'Luminess Assist — Living AI Desktop Companion',
        'version': '1.1.2',
    }
    try:
        return render(request, 'index.html', context)
    except Exception:
        # Fallback to direct reading of dist/index.html if template engine hasn't found it
        dist_index = settings.BASE_DIR / 'dist' / 'index.html'
        if dist_index.exists():
            return HttpResponse(dist_index.read_text(encoding='utf-8'), content_type='text/html')
        return HttpResponse("""
            <!doctype html>
            <html>
                <head><title>Luminess Assist Web</title></head>
                <body style="font-family:sans-serif;padding:40px;background:#080503;color:#fafaf9;">
                    <h1>Luminess Assist Web Platform</h1>
                    <p>Django backend is running. Run <code>npm run build</code> in the web directory to compile the frontend assets.</p>
                    <p><a href="/api/health/" style="color:#38bdf8;">Check Health API</a> &bull; <a href="/admin/" style="color:#38bdf8;">Django Admin</a></p>
                </body>
            </html>
        """, content_type='text/html')


def api_state(request):
    """Returns the full unified platform state or syncs client state."""
    if request.method == 'GET':
        profile = BotProfile.objects.filter(is_active=True).first()
        if not profile:
            profile = BotProfile.objects.first()

        flags = {flag.key: flag.is_enabled for flag in FeatureFlag.objects.all()}
        # Defaults if flags table is empty
        default_flags = {
            'voiceModeEnabled': True,
            'webSearchEnabled': True,
            'powershellAutomationEnabled': True,
            'screenOcrEnabled': False,
            'longTermMemorySyncEnabled': True,
            'cloudCodeAssistFallback': False,
        }
        for k, v in default_flags.items():
            flags.setdefault(k, v)

        releases = [r.to_dict() for r in AppRelease.objects.all()]
        configs = [c.to_dict() for c in GlobalConfig.objects.all()]
        users = [{
            'id': u.id,
            'username': u.username,
            'email': u.email,
            'role': u.role,
            'createdAt': u.created_at.strftime('%Y-%m-%d'),
        } for u in PlatformUser.objects.all()]
        memories = [m.to_dict() for m in BotMemory.objects.all()]

        return JsonResponse({
            'currentProfile': profile.to_dict() if profile else None,
            'featureFlags': flags,
            'releases': releases,
            'globalConfig': configs,
            'users': users,
            'memories': memories,
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
                        'appearance_config': profile_data.get('appearance', {}),
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
                import random
                pairing_code = f"LUMI-{random.randint(1000, 9999)}"

            profile, _ = BotProfile.objects.update_or_create(
                pairing_code=pairing_code,
                defaults={
                    'bot_name': data.get('botName', 'Luminess'),
                    'appearance_config': data.get('appearance', {}),
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
            profile = BotProfile.objects.filter(is_active=True).first()
            if not profile:
                profile = BotProfile.objects.first()

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
