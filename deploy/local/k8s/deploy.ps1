# deploy.ps1
# Script de despliegue completo para Kubernetes con Minikube
#
# Uso:
#   .\deploy\local\k8s\deploy.ps1                    → MongoDB (default)
#   .\deploy\local\k8s\deploy.ps1 -Engine postgres   → PostgreSQL
#   .\deploy\local\k8s\deploy.ps1 -Clean             → Borra cluster antes (MongoDB)
#   .\deploy\local\k8s\deploy.ps1 -Engine postgres -Clean → Borra cluster y usa PostgreSQL


param(
    [ValidateSet("mongodb", "postgres")]
    [string]$Engine = "mongodb",
    [switch]$Clean
)

$BASE_PATH = Split-Path -Parent $MyInvocation.MyCommand.Path

$NS = "restaurantes"

# ── Limpieza opcional ─────────────────────────────────────────────
if ($Clean) {
    Write-Host "`nLimpiando cluster anterior..." -ForegroundColor Yellow
    minikube delete
    Write-Host "Cluster eliminado." -ForegroundColor Green
}

# ── Arrancar minikube ─────────────────────────────────────────────
Write-Host "`nArrancando Minikube..." -ForegroundColor Yellow
minikube start --memory=9500 --cpus=4
if ($LASTEXITCODE -ne 0) { Write-Host "Error arrancando Minikube" -ForegroundColor Red; exit 1 }

# ── Cargar imágenes locales ───────────────────────────────────────
Write-Host "`nCargando imágenes en Minikube..." -ForegroundColor Yellow
minikube image load restaurantes/api:latest
minikube image load restaurantes/search:latest
Write-Host "Imágenes cargadas." -ForegroundColor Green

# ── Namespace ─────────────────────────────────────────────────────
Write-Host "`nCreando namespace..." -ForegroundColor Yellow
kubectl apply -f "$BASE_PATH/namespace.yaml"

# ── ConfigMap y Secrets ───────────────────────────────────────────
Write-Host "Aplicando configuración (motor: $Engine)..." -ForegroundColor Yellow

if ($Engine -eq "mongodb") {
    kubectl apply -f "$BASE_PATH/configmap.mongo.yaml" -n $NS
   
}
else {
    kubectl apply -f "$BASE_PATH/configmap.postgres.yaml" -n $NS
}

kubectl apply -f "$BASE_PATH/secrets.yaml" -n $NS

# ── Realm de Keycloak ─────────────────────────────────────────────
Write-Host "Cargando realm de Keycloak..." -ForegroundColor Yellow
kubectl create configmap keycloak-realm-config `
    --from-file=realm-export.json="$BASE_PATH/../keycloak/realm-export.json" `
   -n $NS --dry-run=client -o yaml | kubectl apply -f -

# ── Infraestructura base ──────────────────────────────────────────
Write-Host "`nLevantando infraestructura base..." -ForegroundColor Yellow
kubectl apply -f "$BASE_PATH/redis/deployment.yaml"          -n $NS
kubectl apply -f "$BASE_PATH/elasticsearch/statefulset.yaml" -n $NS
kubectl apply -f "$BASE_PATH/keycloak/keycloak-stack.yaml"   -n $NS

# ── Base de datos según motor ─────────────────────────────────────
if ($Engine -eq "mongodb") {
    Write-Host "`nDesplegando MongoDB sharded..." -ForegroundColor Yellow
    kubectl apply -f "$BASE_PATH/mongodb/statefulset.yaml" -n $NS

    Write-Host "Esperando config server (TCP ready)..." -ForegroundColor Yellow
    kubectl wait --for=condition=ready pod -l app=configsvr --timeout=180s -n $NS
    
    Write-Host "Inicializando configReplSet..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    kubectl exec configsvr-0 -n $NS -- mongosh --port 27019 --eval "try { rs.status(); print('ya init'); } catch(e) { rs.initiate({_id:'configReplSet',configsvr:true,members:[{_id:0,host:'configsvr-0.configsvr-headless.$NS.svc.cluster.local:27019'}]}); print('iniciado'); }"
    
    Write-Host "Esperando eleccion de primario en configReplSet (20s)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 20

    Write-Host "Esperando shards (TCP ready)..." -ForegroundColor Yellow
    kubectl wait --for=condition=ready pod -l app=shard --timeout=180s -n $NS

    Write-Host "Inicializando shard rs0..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    kubectl exec shard-0 -n $NS -- mongosh --port 27018 --eval "try { rs.status(); print('ya init'); } catch(e) { rs.initiate({_id:'rs0',members:[{_id:0,host:'shard-0.shard-headless.$NS.svc.cluster.local:27018',priority:2},{_id:1,host:'shard-1.shard-headless.$NS.svc.cluster.local:27018',priority:1},{_id:2,host:'shard-2.shard-headless.$NS.svc.cluster.local:27018',priority:1}]}); print('iniciado'); }"

    Write-Host "Esperando eleccion de primario en rs0 (25s)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 25

    Write-Host "Esperando mongos..." -ForegroundColor Yellow
    kubectl wait --for=condition=ready pod -l app=mongos --timeout=180s -n $NS
    Write-Host "Mongos listo." -ForegroundColor Green

    Write-Host "Registrando shard y configurando sharding..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    kubectl exec deployment/mongos -n $NS -- mongosh --eval "sh.addShard('rs0/shard-0.shard-headless.$NS.svc.cluster.local:27018,shard-1.shard-headless.$NS.svc.cluster.local:27018,shard-2.shard-headless.$NS.svc.cluster.local:27018')"
    kubectl exec deployment/mongos -n $NS -- mongosh --eval "sh.enableSharding('restaurantdb'); sh.shardCollection('restaurantdb.pedidos',{id_restaurante:'hashed'}); sh.shardCollection('restaurantdb.reservaciones',{id_restaurante:'hashed'}); print('Sharding listo')"
    
    Write-Host "MongoDB listo." -ForegroundColor Green
} 
else {
    Write-Host "`nDesplegando PostgreSQL..." -ForegroundColor Yellow
    kubectl apply -f "$BASE_PATH/postgres/init-configmap.yaml" -n $NS
    kubectl apply -f "$BASE_PATH/postgres/statefulset.yaml" -n $NS
    kubectl wait --for=condition=ready pod -l app=postgres --timeout=120s -n $NS
    Write-Host "PostgreSQL listo." -ForegroundColor Green
}

# ── Esperar Keycloak PostgreSQL ───────────────────────────────────
Write-Host "`nEsperando PostgreSQL de Keycloak..." -ForegroundColor Yellow
kubectl wait --for=condition=ready pod -l app=keycloak-postgres --timeout=120s -n $NS
Write-Host "PostgreSQL de Keycloak listo." -ForegroundColor Green

# ── Esperar Keycloak ──────────────────────────────────────────────
Write-Host "`nEsperando Keycloak (puede tardar 2-3 minutos)..." -ForegroundColor Yellow
kubectl wait --for=condition=ready pod -l app=keycloak --timeout=300s -n $NS
Write-Host "Keycloak listo." -ForegroundColor Green

# ── Microservicios ────────────────────────────────────────────────
Write-Host "`nLevantando microservicios..." -ForegroundColor Yellow
kubectl apply -f "$BASE_PATH/api/deployment.yaml"    -n $NS
kubectl apply -f "$BASE_PATH/api/hpa.yaml"           -n $NS
kubectl apply -f "$BASE_PATH/search/deployment.yaml" -n $NS
kubectl apply -f "$BASE_PATH/nginx/deployment.yaml"  -n $NS

Write-Host "`nEsperando API, Search y Nginx..." -ForegroundColor Yellow
kubectl wait --for=condition=ready pod -l app=api    --timeout=120s -n $NS
kubectl wait --for=condition=ready pod -l app=search --timeout=120s -n $NS
kubectl wait --for=condition=ready pod -l app=nginx  --timeout=60s  -n $NS
Write-Host "Servicios listos." -ForegroundColor Green

# ── Resumen ───────────────────────────────────────────────────────
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  DESPLIEGUE COMPLETADO - Motor: $Engine" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
kubectl get pods -n $NS
Write-Host "`nPasos para acceder:" -ForegroundColor Yellow
Write-Host "  1. En otra terminal (dejarla abierta): minikube tunnel"
Write-Host "  2. En otra terminal (dejarla abierta): kubectl port-forward svc/keycloak-service 9999:8080 -n restaurantes"
Write-Host "`nEndpoints:"
Write-Host "  GET  http://localhost/health"
Write-Host "  GET  http://localhost/api/restaurants        (requiere token)"
Write-Host "  GET  http://localhost/search/products?q=pizza"
Write-Host "  POST http://localhost/search/reindex"
Write-Host "`nObtener token:"
Write-Host "  POST http://localhost:9999/realms/restaurant/protocol/openid-connect/token"
Write-Host "  Body (x-www-form-urlencoded):"
Write-Host "    grant_type=password  client_id=api-restaurant"
Write-Host "    client_secret=api-restaurant-secret"
Write-Host "    username=admin1  password=admin123"