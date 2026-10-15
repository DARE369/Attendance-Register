FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p logs

EXPOSE 8080

# Cloud Run sets $PORT (8080 by default); Fly uses 8080.
CMD exec gunicorn wsgi:application --bind 0.0.0.0:${PORT:-8080} --workers 2 --timeout 120 --access-logfile -
