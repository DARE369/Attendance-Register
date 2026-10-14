FROM python:3.12-slim

# School runs on Lagos time; services/tz.py also pins WAT explicitly.
ENV TZ=Africa/Lagos

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p logs

EXPOSE 8080

CMD ["gunicorn", "wsgi:application", "--bind", "0.0.0.0:8080", "--workers", "2", "--timeout", "120", "--access-logfile", "-"]
