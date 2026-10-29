import json
from django.test import TestCase, Client
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
            display_name='Test Pilot',
            email='test@luminess.local',
            role='user',
            github_username='testpilot',
            github_repo_url='https://github.com/testpilot/Luminess-Assist',
        )
        self.user.set_password('secret123')
        self.user.save()

        self.profile = BotProfile.objects.create(
            id='bot_test01',
            user=self.user,
            bot_name='LumiTest',
            pairing_code='LUMI-9999',
            is_active=True,
            is_public=True,
            visual_mode='sprite_frames',
            frames_config=[
                {'id': 'f1', 'name': 'Frame 1', 'url': 'https://example.com/1.png', 'state': 'idle'},
                {'id': 'f2', 'name': 'Frame 2', 'url': 'https://example.com/2.png', 'state': 'talking'},
            ],
            greeting_message='Greetings test subject!',
            github_repo='testpilot/Luminess-Assist',
            github_repo_url='https://github.com/testpilot/Luminess-Assist',
            forked_from='jasonhukom/Luminess-Assist',
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
        self.assertIn('communityBots', data)
        self.assertEqual(data['currentProfile']['pairingCode'], 'LUMI-9999')

    def test_auth_register_and_login(self):
        # Register new user
        reg_payload = {
            'username': 'newuser',
            'email': 'newuser@luminess.local',
            'password': 'password123',
            'displayName': 'New Pilot',
            'githubUsername': 'newuser-gh',
        }
        res_reg = self.client.post('/api/auth/register/', data=json.dumps(reg_payload), content_type='application/json')
        self.assertEqual(res_reg.status_code, 201)
        data = res_reg.json()
        self.assertEqual(data['status'], 'registered')
        self.assertEqual(data['user']['username'], 'newuser')

        # Login
        login_payload = {
            'username': 'newuser',
            'password': 'password123',
        }
        res_login = self.client.post('/api/auth/login/', data=json.dumps(login_payload), content_type='application/json')
        self.assertEqual(res_login.status_code, 200)
        login_data = res_login.json()
        self.assertEqual(login_data['status'], 'logged_in')

    def test_bot_showcase_and_creation(self):
        # Browse bots
        res = self.client.get('/api/bots/')
        self.assertEqual(res.status_code, 200)
        bots = res.json()['bots']
        self.assertGreaterEqual(len(bots), 1)

        # Create custom bot with video look & github fork
        create_payload = {
            'userId': self.user.id,
            'botName': 'Nebula Live Bot',
            'tagline': 'Lo-Fi Video Companion',
            'visualMode': 'video',
            'videoUrl': 'https://assets.mixkit.co/preview.mp4',
            'greetingMessage': 'Welcome to the stars.',
            'githubRepo': 'testpilot/Luminess-Assist',
            'forkedFrom': 'jasonhukom/Luminess-Assist',
        }
        res_create = self.client.post('/api/bots/create/', data=json.dumps(create_payload), content_type='application/json')
        self.assertEqual(res_create.status_code, 201)
        new_bot = res_create.json()['bot']
        self.assertEqual(new_bot['botName'], 'Nebula Live Bot')
        self.assertEqual(new_bot['visualMode'], 'video')
        self.assertEqual(new_bot['forkedFrom'], 'jasonhukom/Luminess-Assist')

    def test_bot_chat_endpoint(self):
        res = self.client.post(
            f'/api/bots/{self.profile.id}/chat/',
            data=json.dumps({'message': 'Hello test bot!'}),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)
        chat_data = res.json()
        self.assertIn('reply', chat_data)
        self.assertIn('emotion', chat_data)

    def test_github_fork_endpoint(self):
        res = self.client.post(
            '/api/github/fork/',
            data=json.dumps({'githubUsername': 'jasonhukom'}),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)
        fork_data = res.json()
        self.assertEqual(fork_data['status'], 'connected')
        self.assertEqual(fork_data['baseRepository'], 'jasonhukom/Luminess-Assist')
        self.assertEqual(fork_data['forkedRepository'], 'jasonhukom/Luminess-Assist')
