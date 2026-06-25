# deploy/local/k8s/apply-neo4j.ps1
#
# Despliega Neo4J y rutas-service en Kubernetes.
# Requiere que el namespace 'restaurantes' y los secrets/configmaps
# base ya estén creados (correr deploy.ps1 primero).
#
# Uso:
#   # Con Postgres (default):
#   .\apply-neo4j.ps1
#
#   # Con MongoDB:
#   .\apply-neo4j.ps1 -Engine mongo
#
# Acceso:
#   Neo4J Browser:   kubectl port-forward svc/neo4j-service 7474:7474 -n restaurantes
#   rutas-service:   kubectl port-forward svc/rutas-service 5050:5000 -n restaurantes

param(
    [ValidateSet("postgres", "mongo")]
    [string]$Engine = "postgres"
)

$ErrorActionPreference = "Stop"
$K8S_DIR = "$PSScriptRoot"
$NEO4J_DIR = "$K8S_DIR\neo4j"
$RUTAS_DIR = "$K8S_DIR\rutas-service"

Write-Host "=== Desplegando Neo4J y rutas-service ===" -ForegroundColor Cyan
Write-Host "Motor de BD: $Engine" -ForegroundColor Yellow

# ── 1. ConfigMap de Neo4J ─────────────────────────────────────────
Write-Host "`n[1/6] Aplicando ConfigMap de Neo4J..." -ForegroundColor Green
kubectl apply -f "$NEO4J_DIR\configmap.yaml"

# ── 2. PersistentVolumeClaims ─────────────────────────────────────
Write-Host "`n[2/6] Aplicando PVCs de Neo4J..." -ForegroundColor Green
kubectl apply -f "$NEO4J_DIR\pvc.yaml"

# ── 3. Deployment y Service de Neo4J ─────────────────────────────
Write-Host "`n[3/6] Aplicando Deployment y Service de Neo4J..." -ForegroundColor Green
kubectl apply -f "$NEO4J_DIR\deployment.yaml"

# ── 4. Esperar a que Neo4J esté listo ────────────────────────────
Write-Host "`n[4/6] Esperando que Neo4J esté listo..." -ForegroundColor Yellow
kubectl rollout status deployment/neo4j -n restaurantes --timeout=180s
Write-Host "Neo4J listo." -ForegroundColor Green

# ── 5. Seed de ubicaciones ────────────────────────────────────────
Write-Host "`n[5/6] Cargando ubicaciones en Neo4J..." -ForegroundColor Green

# Borrar job previo si existe (jobs son inmutables)
kubectl delete job neo4j-seed -n restaurantes --ignore-not-found=true
kubectl apply -f "$NEO4J_DIR\seed-job.yaml"

Write-Host "Esperando que el seed complete..." -ForegroundColor Yellow
kubectl wait --for=condition=complete job/neo4j-seed -n restaurantes --timeout=120s
Write-Host "Seed completado." -ForegroundColor Green

# ── 6. Deployment de rutas-service ───────────────────────────────
Write-Host "`n[6/6] Aplicando rutas-service..." -ForegroundColor Green
kubectl apply -f "$RUTAS_DIR\deployment.yaml"

kubectl rollout status deployment/rutas-service -n restaurantes --timeout=120s

# ── Resumen ───────────────────────────────────────────────────────
Write-Host "`n=== Despliegue completado ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pods corriendo:" -ForegroundColor Yellow
kubectl get pods -n restaurantes -l "app in (neo4j, rutas-service)"

Write-Host ""
Write-Host "Para acceder a los servicios:" -ForegroundColor Yellow
Write-Host "  Neo4J Browser:  kubectl port-forward svc/neo4j-service 7474:7474 -n restaurantes"
Write-Host "  Bolt protocol:  kubectl port-forward svc/neo4j-service 7687:7687 -n restaurantes"
Write-Host "  rutas-service:  kubectl port-forward svc/rutas-service 5050:5000 -n restaurantes"
Write-Host ""
Write-Host "Credenciales Neo4J: neo4j / password123"
Write-Host ""

# ── Migración de datos (opcional) ────────────────────────────────
$migrar = Read-Host "Migrar datos desde $Engine a Neo4J ahora? (s/n)"
if ($migrar -eq "s" -or $migrar -eq "S") {
    Write-Host "`nEjecutando migración..." -ForegroundColor Green
    kubectl delete job neo4j-migrate -n restaurantes --ignore-not-found=true
    kubectl apply -f "$NEO4J_DIR\migrate-job.yaml"
    Write-Host "Esperando migración..." -ForegroundColor Yellow
    kubectl wait --for=condition=complete job/neo4j-migrate -n restaurantes --timeout=300s
    Write-Host "Migración completada." -ForegroundColor Green
} else {
    Write-Host "Podés migrar después con:" -ForegroundColor Yellow
    Write-Host "  kubectl apply -f $NEO4J_DIR\migrate-job.yaml"
}