FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN useradd --create-home --shell /usr/sbin/nologin appuser && chown -R appuser:appuser /app

USER appuser

CMD ["sh", "start.sh"]
