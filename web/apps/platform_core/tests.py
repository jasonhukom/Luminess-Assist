import json
from django.test import TestCase, Client
from django.urls import reverse
from apps.platform_core.models import (
    PlatformUser,
    BotProfile,
    BotMemory,
    AppRelease,
    GlobalConfig,
    FeatureFlag,
)


class PlatformCoreTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = PlatformUser.objects.create(
            id='usr_test01',
            username='testpilot',
            email='test@luminess.local',
            role='user'
        )
        self.profile = BotProfile.objects.create(
            id='bot_test01',
            user=self.user,
            bot_name='LumiTest',
            pairing_code='LUMI-9999',
            is_active=True,
        )

    def test_health_check(self):
        response = self.client.get('/health/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'healthy')
        self.assertEqual(data['database'], 'connected')

    def test_api_state(self):
        response = self.client.get('/api/state/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('currentProfile', data)
        self.assertIn('featureFlags', data)
        self.assertIn('releases', data)
        self.assertEqual(data['currentProfile']['pairingCode'], 'LUMI-9999')

    def test_api_profile_get_and_post(self):
        # GET by code
        res = self.client.get('/api/profile/?code=LUMI-9999')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['botName'], 'LumiTest')

        # POST update
        payload = {
            'pairingCode': 'LUMI-9999',
            'botName': 'LumiUpdated',
            'appearance': {'color': '#10b981'},
        }
        res_post = self.client.post(
            '/api/profile/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(res_post.status_code, 200)
        self.assertEqual(res_post.json()['botName'], 'LumiUpdated')

    def test_api_memories(self):
        # Create memory
        create_res = self.client.post(
            '/api/memories/',
            data=json.dumps({'memoryFact': 'Loves dark mode and Rust', 'category': 'preference'}),
            content_type='application/json'
        )
        self.assertEqual(create_res.status_code, 201)
        mem_id = create_res.json()['id']

        # List memories
        list_res = self.client.get('/api/memories/')
        self.assertEqual(list_res.status_code, 200)
        self.assertTrue(any(m['id'] == mem_id for m in list_res.json()))

        # Delete memory
        del_res = self.client.delete(f'/api/memories/{mem_id}/')
        self.assertEqual(del_res.status_code, 200)

    def test_api_releases(self):
        # Publish release
        rel_payload = {
            'versionId': '1.2.0',
            'downloadUrl': 'https://github.com/test/release.msi',
            'releaseNotes': 'New tests added',
            'isMandatoryUpdate': False,
            'status': 'latest',
        }
        post_res = self.client.post(
            '/api/releases/',
            data=json.dumps(rel_payload),
            content_type='application/json'
        )
        self.assertEqual(post_res.status_code, 201)

        # GET releases
        get_res = self.client.get('/api/releases/')
        self.assertEqual(get_res.status_code, 200)
        self.assertTrue(any(r['versionId'] == '1.2.0' for r in get_res.json()))

    def test_frontend_index_view(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Luminess Assist', response.content)
