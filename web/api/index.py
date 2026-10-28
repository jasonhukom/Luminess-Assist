"""
Vercel Serverless Function entry point for Luminess Django Web Application.
"""
import os
import sys
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'luminess_web.settings')

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
app = application
