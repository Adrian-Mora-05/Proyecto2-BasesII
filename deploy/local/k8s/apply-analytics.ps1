# deploy/local/k8s/apply-analytics.ps1
#
# Aplica todos los manifiestos del stack de analytics en orden.
# Ejecutar desde la raíz del proyecto:
#   .\deploy\local\k8s\apply-analytics.ps1
#
# Prerequisito: el namespace "restaurant" ya debe existir.
#   kubectl apply -f deploy/local/k8s/namespace.yaml

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$ANALYTICS = "$ROOT/../../../analytics"

Write-Host "=== Generando ConfigMaps desde archivos fuente ===" -ForegroundColor Cyan

# ConfigMap con los HiveQL del star schema
kubectl create configmap hive-ddl-configmap `
  --from-file=01_star_schema.hql="$ANALYTICS/hive/ddl/01_star_schema.hql" `
  --from-file=02_vistas_olap.hql="$ANALYTICS/hive/ddl/02_vistas_olap.hql" `
  -n restaurant --dry-run=client -o yaml | kubectl apply -f -

# ConfigMap con los jobs de Spark
kubectl create configmap spark-jobs-configmap `
  --from-file="$ANALYTICS/spark/jobs/" `
  -n restaurant --dry-run=client -o yaml | kubectl apply -f -

# ConfigMap con los scripts ETL
kubectl create configmap airflow-etl-configmap `
  --from-file="$ANALYTICS/hive/etl/" `
  -n restaurant --dry-run=client -o yaml | kubectl apply -f -

# ConfigMap con los DAGs de Airflow
kubectl create configmap airflow-dags-configmap `
  --from-file="$ANALYTICS/airflow/dags/" `
  -n restaurant --dry-run=client -o yaml | kubectl apply -f -

Write-Host "=== Aplicando manifiestos de Hive ===" -ForegroundColor Cyan
kubectl apply -f "$ROOT/hive/hive-metastore-db.yaml"
kubectl apply -f "$ROOT/hive/hive.yaml"

Write-Host "=== Aplicando manifiestos de Spark ===" -ForegroundColor Cyan
kubectl apply -f "$ROOT/spark/spark.yaml"

Write-Host "=== Aplicando manifiestos de Airflow ===" -ForegroundColor Cyan
kubectl apply -f "$ROOT/airflow/airflow.yaml"

Write-Host "=== Aplicando manifiestos de Superset ===" -ForegroundColor Cyan
kubectl apply -f "$ROOT/superset/superset.yaml"

Write-Host ""
Write-Host "=== Stack de analytics aplicado ===" -ForegroundColor Green
Write-Host "Puertos expuestos (minikube):"
Write-Host "  Hive Web UI:        http://$(minikube ip):30002"
Write-Host "  Spark Master UI:    http://$(minikube ip):30081"
Write-Host "  Airflow Webserver:  http://$(minikube ip):30090  (admin/admin)"
Write-Host "  Superset:           http://$(minikube ip):30088  (admin/admin)"
Write-Host ""
Write-Host "Para escalar workers de Spark:"
Write-Host "  kubectl scale deployment spark-worker --replicas=3 -n restaurant"