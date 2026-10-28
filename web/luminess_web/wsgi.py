"""
WSGI config for luminess_web project.

It exposes the WSGI callable as a module-level variable named ``application``.
Also exposes ``app`` alias for Vercel Serverless Function detection.
"""
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'luminess_web.settings')

application = get_wsgi_application()

# Alias for Vercel WSGI detection
app = application
