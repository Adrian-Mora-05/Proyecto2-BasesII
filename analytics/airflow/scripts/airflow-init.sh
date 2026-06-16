#!/bin/bash
# analytics/airflow/scripts/airflow-init.sh
set -e

echo "=== Instalando dependencias de Airflow ==="
pip install --quiet \
  "pyhive==0.7.0" \
  "thrift==0.16.0" \
  "thrift-sasl==0.4.3" \
  "psycopg2-binary==2.9.9" \
  "pymongo==4.6.3" \
  "apache-airflow-providers-apache-spark==4.7.1"

echo "=== Migrando base de datos ==="
airflow db migrate

echo "=== Creando usuario admin ==="
airflow users create \
  --username admin \
  --password admin \
  --firstname Admin \
  --lastname User \
  --role Admin \
  --email admin@restaurant.local || true

echo "=== Airflow Init completado ==="