#!/bin/sh
set -e

echo "Applying Django database migrations..."
python manage.py migrate --noinput

echo "Seeding platform default data..."
python manage.py seed_data

echo "Starting Gunicorn on 0.0.0.0:8000..."
exec gunicorn luminess_web.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120
