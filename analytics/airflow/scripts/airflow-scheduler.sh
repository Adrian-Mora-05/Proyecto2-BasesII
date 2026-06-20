#!/bin/bash
# analytics/airflow/scripts/airflow-scheduler.sh
set -e

echo "=== Instalando dependencias en scheduler ==="
pip install --quiet \
  "pyhive==0.7.0" \
  "thrift==0.16.0" \
  "thrift-sasl==0.4.3" \
  "psycopg2-binary==2.9.9" \
  "pymongo==4.6.3" \
  "apache-airflow-providers-apache-spark==4.7.1"

echo "=== Instalando docker CLI ==="
apt-get update -qq && apt-get install -y -qq docker.io 2>/dev/null || \
  curl -fsSL https://get.docker.com | sh 2>/dev/null || \
  echo "Docker CLI no instalado Ã¢â‚¬â€ docker exec no disponible"

echo "=== Arrancando scheduler ==="
exec airflow scheduler