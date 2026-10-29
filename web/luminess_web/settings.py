"""
Django settings for luminess_web project.

Configured for local development, MariaDB Docker Compose, and Vercel serverless deployment.
"""
from pathlib import Path
import os
import sys

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Quick-start development settings - unsuitable for production
SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    'django-insecure-luminess-assist-companion-secret-key-prod-change-me#892'
)

IS_VERCEL = os.environ.get('VERCEL') == '1' or bool(os.environ.get('VERCEL_ENV'))
DEBUG = os.environ.get('DJANGO_DEBUG', str(not IS_VERCEL)).lower() in ('true', '1', 'yes')

ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', '*').split(',')
if '*' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.extend(['.vercel.app', 'localhost', '127.0.0.1', '0.0.0.0', 'testserver'])

CSRF_TRUSTED_ORIGINS = [
    'https://*.vercel.app',
    'http://localhost:3000',
    'http://localhost:8000',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8000',
    'http://127.0.0.1:8080',
    'http://0.0.0.0:3000',
    'http://0.0.0.0:8000',
]
custom_csrf = os.environ.get('DJANGO_CSRF_TRUSTED_ORIGINS')
if custom_csrf:
    CSRF_TRUSTED_ORIGINS.extend([origin.strip() for origin in custom_csrf.split(',') if origin.strip()])


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'whitenoise.runserver_nostatic',
    'django.contrib.staticfiles',

    # Luminess Core Application
    'apps.platform_core.apps.PlatformCoreConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'luminess_web.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            BASE_DIR / 'templates',
            BASE_DIR / 'dist',
        ],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'luminess_web.wsgi.application'
ASGI_APPLICATION = 'luminess_web.asgi.application'


# Database Configuration
# Supports MariaDB / MySQL (via PyMySQL), PostgreSQL, and SQLite fallback for Vercel preview

DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL:
    import dj_database_url
    normalized_db_url = DATABASE_URL
    if normalized_db_url.startswith('mariadb://'):
        normalized_db_url = 'mysql://' + normalized_db_url[len('mariadb://'):]

    is_local_db = any(h in normalized_db_url for h in ['localhost', '127.0.0.1', 'db:3306', 'mariadb:3306', 'db:5432'])
    db_config = dj_database_url.config(
        default=normalized_db_url,
        conn_max_age=0 if IS_VERCEL else 600,
        ssl_require=False if (is_local_db or normalized_db_url.startswith('sqlite')) else True,
    )
    if 'mysql' in db_config.get('ENGINE', ''):
        db_config.setdefault('OPTIONS', {})
        db_config['OPTIONS'].setdefault('charset', 'utf8mb4')
        db_config['OPTIONS'].setdefault('init_command', "SET sql_mode='STRICT_TRANS_TABLES'")
    DATABASES = {'default': db_config}
else:
    # On Vercel without DATABASE_URL, fallback to /tmp/db.sqlite3
    db_file = '/tmp/db.sqlite3' if IS_VERCEL else (BASE_DIR / 'db.sqlite3')
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': db_file,
        }
    }


# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True


# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

STATICFILES_DIRS = []
if (BASE_DIR / 'static').exists():
    STATICFILES_DIRS.append(BASE_DIR / 'static')
if (BASE_DIR / 'dist').exists():
    STATICFILES_DIRS.append(BASE_DIR / 'dist')

STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'
WHITENOISE_ROOT = BASE_DIR / 'dist'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
