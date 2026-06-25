# 🍽️ Sistema de Reserva Inteligente de Restaurantes — Etapa 3

![Node.js](https://img.shields.io/badge/Node.js-20-green)
![Docker](https://img.shields.io/badge/Docker-Enabled-blue)
![MongoDB](https://img.shields.io/badge/MongoDB-7-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)
![Keycloak](https://img.shields.io/badge/Auth-Keycloak-orange)
![Kubernetes](https://img.shields.io/badge/Orchestration-Kubernetes-blue)
![ElasticSearch](https://img.shields.io/badge/Search-ElasticSearch-yellow)
![Redis](https://img.shields.io/badge/Cache-Redis-red)
![Apache Hive](https://img.shields.io/badge/DW-Apache%20Hive-yellow)
![Apache Spark](https://img.shields.io/badge/Processing-Apache%20Spark-orange)
![Apache Airflow](https://img.shields.io/badge/Orchestration-Airflow-teal)
![Superset](https://img.shields.io/badge/Viz-Superset-blue)
![Neo4J](https://img.shields.io/badge/Graphs-Neo4J-green)

Proyecto de **Bases de Datos II** — Sistema completo de reserva inteligente de restaurantes con arquitectura de microservicios, pipeline de datos OLAP, análisis de grafos con Neo4J y asignación optimizada de rutas de entrega.

---

## 📌 Descripción

El sistema tiene dos grandes capas:

**Capa operacional (Etapas 1 y 2):**
- Registro y autenticación de usuarios con JWT via Keycloak
- Gestión de restaurantes, menús, reservaciones y pedidos
- Búsqueda full-text con ElasticSearch
- Caché distribuida con Redis
- Base de datos intercambiable: PostgreSQL 16 o MongoDB 7 (sharded cluster)
- Análisis de grafos con Neo4J: co-compras, usuarios influyentes, caminos mínimos
- Asignación optimizada de rutas de entrega con vecino más cercano

**Capa analítica OLAP (Etapa 3):**
- Data Warehouse con Apache Hive (esquema estrella, ORC + Snappy)
- Pipeline ETL diario orquestado con Apache Airflow
- Procesamiento batch con Apache Spark (tendencias, horarios pico, crecimiento)
- Visualización con Apache Superset (3 dashboards)

---

## 🏗️ Arquitectura del sistema

```
         Cliente (Postman / Navegador)
                      ↓
              ┌───────────────┐
              │  Nginx :80    │  ← Único punto de entrada
              └──┬──────┬──┬──┘
                 ↓      ↓   ↓
        ┌────────────┐ ┌──────────┐ ┌──────────────────┐
        │  API :3000 │ │ Search   │ │  rutas-service   │
        │  Node.js   │ │  :4000   │ │  :5000 (Neo4J)   │
        └─────┬──────┘ └────┬─────┘ └────────┬─────────┘
              ↓             ↓                  ↓
    ┌──────────────────┐ ┌──────────┐  ┌─────────────┐
    │  PostgreSQL 16   │ │  Elastic │  │   Neo4J     │
    │     — o —        │ │  Search  │  │  :7474/7687 │
    │  MongoDB 7       │ └──────────┘  └─────────────┘
    │  (sharded)       │
    └──────────────────┘ ┌──────────┐  ┌─────────────────────────┐
                         │  Redis   │  │  Keycloak + PostgreSQL  │
                         │  :6379   │  │  (Auth)                 │
                         └──────────┘  └─────────────────────────┘

════════════════ CAPA ANALÍTICA OLAP ════════════════════════════
  PostgreSQL/MongoDB ──ETL diario──▶ Airflow ──▶ Hive (DW)
                                                      │
                                                 Spark ──▶ Superset
═════════════════════════════════════════════════════════════════
```

---

## 🚀 Tecnologías

| Componente | Tecnología | Versión |
|---|---|---|
| API principal | Node.js + Express | 20 LTS |
| Microservicio búsqueda | Node.js + Express | 20 LTS |
| Microservicio rutas/grafos | Node.js + Express + neo4j-driver | 20 LTS |
| Base de datos principal | PostgreSQL o MongoDB (intercambiable) | 16 / 7 |
| Sharding MongoDB | mongos + configsvr + shard rs0 | 7 |
| Búsqueda | ElasticSearch | 8.13 |
| Caché | Redis | 7 |
| Autenticación | Keycloak + JWT RS256 | 24.0 |
| Balanceador | Nginx | Alpine |
| Orquestación | Kubernetes (Minikube) | — |
| CI/CD | GitHub Actions | — |
| Pruebas | Jest + Supertest | 29 |
| Base de datos de grafos | Neo4J + APOC + GDS | 5.18 |
| Data Warehouse | Apache Hive (ORC + Snappy) | 4.0.0 |
| Procesamiento batch | Apache Spark | 3.5.6 |
| Orquestación ETL | Apache Airflow | 2.9.1 |
| Visualización | Apache Superset | 3.1.0 |

---

## ⚙️ Requisitos previos

- Docker Desktop con al menos 8 GB de RAM asignados (12 GB recomendados para el stack completo con analytics)
- Minikube (para despliegue en Kubernetes)
- kubectl
- Git
- PowerShell 7+ (Windows)

---

## 🐳 Docker Compose — Desarrollo local

El sistema tiene tres archivos Compose separados que se usan en combinación:

| Archivo | Propósito |
|---|---|
| `deploy/local/docker/docker-compose.postgres.yml` | Stack principal con PostgreSQL |
| `deploy/local/docker/docker-compose.mongo.yml` | Stack principal con MongoDB sharded |
| `deploy/local/docker/docker-compose.analytics.yml` | Stack OLAP (Hive, Spark, Airflow, Superset) |
| `deploy/local/docker/docker-compose.neo4j.yml` | Neo4J + rutas-service |

### Opción A — Stack con PostgreSQL + OLAP

```powershell
# 1. Levantar el stack principal con PostgreSQL
docker compose --project-directory . `
  -f deploy/local/docker/docker-compose.postgres.yml `
  up -d

# 2. Copiar el driver JDBC de PostgreSQL al volumen de Hive (necesario una vez)
docker run --rm `
  -v "${PWD}/analytics/hive/drivers/postgresql.jar:/source/postgresql.jar" `
  -v "proyecto2-basesii_hive_warehouse_data:/dest" `
  alpine sh -c "cp /source/postgresql.jar /dest/postgresql.jar && chmod 777 /dest"

# 3. Levantar el stack de analytics
docker compose --project-directory . `
  -f deploy/local/docker/docker-compose.analytics.yml `
  up -d

# 4. Esperar ~3 minutos y verificar que todo esté healthy
docker ps --format "{{.Names}}: {{.Status}}"
```

### Opción B — Stack con MongoDB + OLAP

```powershell
# 1. Cambiar DB_ENGINE en .env
# DB_ENGINE=mongodb
# MONGO_URL=mongodb://mongos:27017/

# 2. Levantar el stack principal con MongoDB
docker compose --project-directory . `
  -f deploy/local/docker/docker-compose.mongo.yml `
  up -d

# Nota: el stack de MongoDB tarda ~5 minutos en inicializar el sharding.
# Verificar que mongo-init haya completado antes de continuar:
docker logs mongo-init --tail 5
# Debe mostrar: === mongo-init completado ===

# 3. Copiar el driver JDBC y levantar analytics (igual que opción A)
docker run --rm `
  -v "${PWD}/analytics/hive/drivers/postgresql.jar:/source/postgresql.jar" `
  -v "proyecto2-basesii_hive_warehouse_data:/dest" `
  alpine sh -c "cp /source/postgresql.jar /dest/postgresql.jar && chmod 777 /dest"

docker compose --project-directory . `
  -f deploy/local/docker/docker-compose.analytics.yml `
  up -d
```

### Opción C — Neo4J y rutas de entrega

```powershell
# Levantar Neo4J y rutas-service (se conecta a la red del stack principal)
docker compose --project-directory . `
  -f deploy/local/docker/docker-compose.neo4j.yml `
  up -d neo4j rutas-service

# Cargar ubicaciones de Cartago en Neo4J (solo la primera vez)
docker compose --project-directory . `
  -f deploy/local/docker/docker-compose.neo4j.yml `
  exec neo4j cypher-shell -u neo4j -p password123 `
  -f /var/lib/neo4j/import/ubicaciones.cypher

# Migrar datos del OLTP a Neo4J
docker compose --project-directory . `
  -f deploy/local/docker/docker-compose.neo4j.yml `
  run neo4j-migrate
```

### Inicializar el star schema de Hive (solo la primera vez o si se reinicia)

```powershell
docker compose --project-directory . `
  -f deploy/local/docker/docker-compose.analytics.yml `
  run --rm hive-init
```

### Cambiar entre motores de base de datos

```powershell
# 1. Pausar el DAG de Airflow
docker exec airflow-scheduler airflow dags pause restaurant_pipeline

# 2. Editar .env: cambiar DB_ENGINE=postgres <-> DB_ENGINE=mongodb

# 3. Bajar el stack actual y levantar el nuevo
docker compose --project-directory . `
  -f deploy/local/docker/docker-compose.postgres.yml `  # o mongo.yml
  down

docker compose --project-directory . `
  -f deploy/local/docker/docker-compose.mongodb.yml `   # o postgres.yml
  up -d

# 4. Reiniciar el scheduler de Airflow para que tome el nuevo DB_ENGINE
docker rm -f airflow-scheduler
docker compose --project-directory . `
  -f deploy/local/docker/docker-compose.analytics.yml `
  up airflow-scheduler -d

# 5. Despausar y triggerear el DAG
docker exec airflow-scheduler airflow dags unpause restaurant_pipeline
docker exec airflow-scheduler airflow dags trigger restaurant_pipeline
```

### Detener todos los stacks

```powershell
docker compose --project-directory . `
  -f deploy/local/docker/docker-compose.analytics.yml down

docker compose --project-directory . `
  -f deploy/local/docker/docker-compose.neo4j.yml down

# Y el stack principal (postgres o mongo)
docker compose --project-directory . `
  -f deploy/local/docker/docker-compose.postgres.yml down
```

---

## 🌐 URLs de acceso (Docker Compose)

| Servicio | URL | Credenciales |
|---|---|---|
| API REST | http://localhost:3000 | JWT via Keycloak |
| Nginx (balanceador) | http://localhost:80 | — |
| Keycloak | http://localhost:8080 | admin / admin |
| ElasticSearch | http://localhost:9200 | — |
| Redis | localhost:6379 | — |
| Neo4J Browser | http://localhost:7474 | neo4j / password123 |
| rutas-service | http://localhost:5050 | — |
| Airflow UI | http://localhost:8090 | admin / admin |
| Hive Web UI | http://localhost:10002 | — |
| Spark Master UI | http://localhost:8081 | — |
| Superset | http://localhost:8089 | admin / admin |

---

## ☸️ Kubernetes — Despliegue local con Minikube

### Primera vez (despliegue limpio)

```powershell
# Construir las imágenes locales primero
docker build -t restaurantes/api:latest ./api
docker build -t restaurantes/search:latest ./search-service
docker build -t restaurantes/rutas-service:latest ./rutas-service

# Despliegue completo
cd deploy/local/k8s
.\deploy.ps1 -Clean
```

> ⚠️ El flag `-Clean` elimina el cluster anterior. Usalo solo si querés empezar desde cero.

### Despliegue sin borrar el cluster

```powershell
.\deploy.ps1
```

### Despliegue del stack analytics en Kubernetes

```powershell
.\apply-analytics.ps1
```

### Despliegue de Neo4J y rutas-service en Kubernetes

```powershell
# Con PostgreSQL (default)
.\apply-neo4j.ps1

# Con MongoDB
.\apply-neo4j.ps1 -Engine mongo
```

### Acceder a los servicios (Kubernetes)

**Paso 1** — Abrir el tunnel en una terminal separada y dejarla abierta:

```powershell
minikube tunnel
```

**Paso 2** — Todos los endpoints del stack principal van por Nginx en `http://localhost`:

| Endpoint | Descripción |
|---|---|
| `GET http://localhost/health` | Health check de Nginx |
| `GET http://localhost/api/restaurants` | API principal |
| `GET http://localhost/search/products?q=pizza` | Búsqueda |
| `GET http://localhost/grafos/co-compras` | Co-compras (Neo4J) |
| `POST http://localhost/rutas/asignar` | Asignación de rutas |

**Paso 3** — Port-forwards para servicios internos:

```powershell
# Keycloak
kubectl port-forward svc/keycloak-service 9999:8080 -n restaurantes

# Neo4J Browser
kubectl port-forward svc/neo4j-service 7474:7474 -n restaurantes
kubectl port-forward svc/neo4j-service 7687:7687 -n restaurantes

# Airflow
kubectl port-forward svc/airflow-webserver 8090:8080 -n restaurantes

# Superset
kubectl port-forward svc/superset 8089:8088 -n restaurantes

# Hive
kubectl port-forward svc/hive-server 10000:10000 -n restaurantes
```

### Escalar en Kubernetes

```powershell
# Escalar API a 5 instancias
kubectl scale deployment api --replicas=5 -n restaurantes

# Escalar Search a 4 instancias
kubectl scale deployment search --replicas=4 -n restaurantes

# Ver pods
kubectl get pods -n restaurantes

# Ver HPA (auto-scaling configurado)
kubectl get hpa -n restaurantes
```

### Limpiar todo

```powershell
minikube delete
```

---

## 📊 Pipeline OLAP

### Cómo funciona

```
BD operacional (Postgres o MongoDB)
    ↓ extracción diaria 02:00 AM
Apache Airflow (DAG: restaurant_pipeline)
    ↓ transformación + carga
Apache Hive — Data Warehouse (star schema)
    ↓ procesamiento batch
Apache Spark (3 jobs paralelos)
    ↓ resultados precalculados
Apache Superset — 3 dashboards
```

### Triggerear el DAG manualmente

```powershell
# Pausar (recomendado durante desarrollo)
docker exec airflow-scheduler airflow dags pause restaurant_pipeline

# Triggerear una corrida manual
docker exec airflow-scheduler airflow dags trigger restaurant_pipeline

# Ver estado de los runs
docker exec airflow-scheduler airflow dags list-runs -d restaurant_pipeline --state success
```

### Verificar integridad del Data Warehouse

En Superset SQL Lab (`http://localhost:8089`) o en Hive directamente:

```sql
SELECT 'fact_pedido'                          AS tabla, COUNT(*) AS filas FROM fact_pedido
UNION ALL SELECT 'fact_reservacion',                    COUNT(*) FROM fact_reservacion
UNION ALL SELECT 'resultado_tendencias_mes_categoria',  COUNT(*) FROM resultado_tendencias_mes_categoria
UNION ALL SELECT 'resultado_tasa_cancelacion_mensual',  COUNT(*) FROM resultado_tasa_cancelacion_mensual
UNION ALL SELECT 'resultado_demanda_por_hora',          COUNT(*) FROM resultado_demanda_por_hora
UNION ALL SELECT 'resultado_crecimiento_mensual',       COUNT(*) FROM resultado_crecimiento_mensual;
```

### Tablas del Data Warehouse

**Hechos:**
- `fact_pedido` — una fila por ítem de pedido (particionada por año/mes)
- `fact_reservacion` — una fila por reservación (particionada por año/mes)

**Dimensiones:**
- `dim_tiempo`, `dim_restaurante`, `dim_usuario`, `dim_plato`, `dim_tipo_pedido`, `dim_estado_pedido`

**Vistas OLAP (5):**
- `v_ingresos_mes_categoria`, `v_actividad_zona`, `v_estado_pedidos`, `v_horarios_pico`, `v_ocupacion_mesas`

**Tablas resultado de Spark:**
- `resultado_tendencias_mes_categoria`, `resultado_top_platos_mes`
- `resultado_demanda_por_hora`, `resultado_pico_dia_semana`, `resultado_fin_semana_vs_semana`
- `resultado_crecimiento_mensual`, `resultado_crecimiento_ytd`, `resultado_tasa_cancelacion_mensual`

---

## 🕸️ Neo4J — Análisis de Grafos

### Modelo del grafo

**Nodos:** `Usuario`, `Pedido`, `Plato`, `Restaurante`, `Ubicacion`

**Relaciones:**
- `(Usuario)-[HIZO]->(Pedido)`
- `(Pedido)-[CONTIENE]->(Plato)`
- `(Pedido)-[ES_DE]->(Restaurante)`
- `(Usuario)-[RECOMIENDA]->(Usuario)`
- `(Ubicacion)-[CONECTA { distancia_km, tiempo_min }]->(Ubicacion)`

### Consultas Cypher principales

**Co-compras — los 5 pares de platos más pedidos juntos:**
```cypher
MATCH (p1:Plato)<-[:CONTIENE]-(ped:Pedido)-[:CONTIENE]->(p2:Plato)
WHERE id(p1) < id(p2)
RETURN p1.nombre AS producto_1, p2.nombre AS producto_2, COUNT(ped) AS veces_juntos
ORDER BY veces_juntos DESC LIMIT 5;
```

**Usuarios influyentes:**
```cypher
MATCH (u1:Usuario)-[:RECOMIENDA]->(u2:Usuario)
RETURN u1.nombre AS usuario, COUNT(u2) AS total_recomendados, COLLECT(u2.nombre) AS recomienda_a
ORDER BY total_recomendados DESC;
```

**Camino mínimo con Dijkstra:**
```cypher
-- Paso 1: proyectar el grafo (una vez por sesión)
CALL gds.graph.project('rutasGraph', 'Ubicacion',
  { CONECTA: { orientation: 'UNDIRECTED', properties: ['distancia_km', 'tiempo_min'] } });

-- Paso 2: camino mínimo
MATCH (inicio:Ubicacion { id: 'cartago-centro' })
MATCH (fin:Ubicacion { id: 'tres-rios' })
CALL gds.shortestPath.dijkstra.stream('rutasGraph', {
  sourceNode: inicio, targetNode: fin, relationshipWeightProperty: 'distancia_km'
})
YIELD nodeIds, costs
RETURN [id IN nodeIds | gds.util.asNode(id).id] AS paradas, costs[-1] AS km_totales;
```

### Endpoints de rutas-service

| Método | Endpoint | Descripción |
|---|---|---|
| GET | /grafos/co-compras | 5 pares de platos más comprados juntos |
| GET | /grafos/usuarios-influyentes | Usuarios ordenados por recomendaciones |
| GET | /grafos/camino-minimo?origen=X&destino=Y | Camino más corto entre ubicaciones |
| POST | /rutas/asignar | Asignar pedidos a repartidores con ruta optimizada |
| GET | /health | Health check |

### Asignar rutas de entrega

```bash
POST http://localhost:5050/rutas/asignar
Content-Type: application/json

{
  "repartidores": [
    { "id": "rep-001", "nombre": "Carlos Solano", "ubicacion_base": "cartago-centro" },
    { "id": "rep-002", "nombre": "Marcela Brenes", "ubicacion_base": "tres-rios" }
  ]
}
```

---

## 📡 Endpoints de la API principal

Todos los endpoints van prefijados con `/api/` cuando se accede via Nginx.

### 🔐 Auth

| Método | Endpoint | Auth |
|---|---|---|
| POST | /api/auth/register | No |
| POST | /api/auth/login | No |

### 👤 Usuarios

| Método | Endpoint | Rol |
|---|---|---|
| GET | /api/users/me | Cualquiera |
| PUT | /api/users/:id | admin |
| DELETE | /api/users/:id | admin |

### 🍽️ Restaurantes y Menús

| Método | Endpoint | Rol |
|---|---|---|
| POST | /api/restaurants | admin |
| GET | /api/restaurants | autenticado |
| POST | /api/menus | admin |
| GET | /api/menus/:id | autenticado |
| PUT | /api/menus/:id | admin |
| DELETE | /api/menus/:id | admin |

### 📅 Reservaciones y Pedidos

| Método | Endpoint | Rol |
|---|---|---|
| POST | /api/reservations | autenticado |
| DELETE | /api/reservations/:id | autenticado |
| POST | /api/orders | autenticado |
| GET | /api/orders/:id | autenticado |

### 🔍 Búsqueda

| Método | Endpoint | Descripción |
|---|---|---|
| GET | /search/products?q=texto | Búsqueda full-text |
| GET | /search/products/category/:cat | Filtrar por categoría |
| POST | /search/reindex | Reindexar productos en ElasticSearch |

### Obtener un token JWT

```powershell
# Port-forward de Keycloak primero (solo en K8s)
kubectl port-forward svc/keycloak-service 9999:8080 -n restaurantes

# Obtener token
POST http://localhost:9999/realms/restaurant/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=password&client_id=api-restaurant&client_secret=api-restaurant-secret&username=admin1&password=admin123
```

Usar el `access_token` en todas las requests protegidas:
```
Authorization: Bearer <access_token>
```

---

## 🔐 Usuarios de prueba

| Usuario | Contraseña | Rol |
|---|---|---|
| admin1 | admin123 | admin |
| cliente1 | cliente123 | cliente |

---

## 🧪 Pruebas

```bash
cd api
npm test                   # Todas las pruebas con cobertura
npm run test:unit          # Solo unitarias
npm run test:integration   # Solo integración (requiere BD corriendo)
```

Cobertura mínima requerida: **90%** en statements, branches, functions y lines.

---

## 📂 Estructura del repositorio

```
Proyecto2-BasesII/
├── api/                          # API principal (Node.js)
├── search-service/               # Microservicio de búsqueda
├── rutas-service/                # Microservicio Neo4J + rutas
│   └── src/
│       ├── config/               # Conexión a Neo4J y BD
│       ├── controllers/          # grafos.controller, rutas.controller
│       ├── services/             # grafos.service, rutas.service
│       └── routes/               # grafos.routes, rutas.routes
├── neo4j/
│   ├── migrate.js                # Migración OLTP → Neo4J
│   ├── seed/ubicaciones.cypher   # 8 zonas de Cartago con coordenadas
│   └── queries/                  # Consultas Cypher documentadas
│       ├── co-compras.cypher
│       ├── usuarios-influyentes.cypher
│       └── camino-minimo.cypher
├── analytics/
│   ├── airflow/
│   │   ├── dags/restaurant_pipeline.py   # DAG principal
│   │   └── scripts/airflow-scheduler.sh
│   ├── hive/
│   │   ├── ddl/01_star_schema.hql        # Schema estrella
│   │   │   └── 02_vistas_olap.hql        # 5 vistas OLAP
│   │   ├── etl/etl_postgres.py           # Extractor PostgreSQL
│   │   │   ├── etl_mongo.py              # Extractor MongoDB
│   │   │   └── transform.py              # Transformación + carga Hive
│   │   └── drivers/postgresql.jar        # JDBC driver
│   ├── spark/
│   │   ├── jobs/                         # Jobs de producción
│   │   │   ├── tendencias_consumo.py
│   │   │   ├── horarios_pico.py
│   │   │   └── crecimiento_mensual.py
│   │   └── notebooks/                    # Notebooks interactivos
│   │       ├── tendencias_consumo.ipynb
│   │       ├── horarios_pico.ipynb
│   │       └── crecimiento_mensual.ipynb
│   └── superset/dashboards/              # Exports YAML de Superset
├── db/
│   ├── postgres/init/                    # Scripts SQL iniciales
│   └── seed/generate_test_data.py        # Generador de datos de prueba
└── deploy/
    └── local/
        ├── docker/
        │   ├── docker-compose.postgres.yml
        │   ├── docker-compose.mongo.yml
        │   ├── docker-compose.analytics.yml
        │   └── docker-compose.neo4j.yml
        └── k8s/
            ├── namespace.yaml
            ├── secrets.yaml
            ├── configmap.postgres.yaml
            ├── configmap.mongo.yaml
            ├── api/
            ├── search/
            ├── nginx/
            ├── postgres/
            ├── mongodb/
            ├── elasticsearch/
            ├── redis/
            ├── keycloak/
            ├── hive/
            ├── airflow/
            ├── superset/
            ├── neo4j/
            ├── rutas-service/
            ├── deploy.ps1            # Despliega el stack principal
            ├── apply-analytics.ps1   # Despliega Hive + Spark + Airflow + Superset
            └── apply-neo4j.ps1       # Despliega Neo4J + rutas-service
```

---

## ⚠️ Notas importantes

- **RAM**: El stack completo (principal + analytics + Neo4J) requiere ~10 GB de RAM libre en Docker Desktop.
- **MongoDB init**: El contenedor `mongo-init` tarda ~5 minutos en inicializar el sharding. Verificar con `docker logs mongo-init`.
- **Hive startup**: Hive tarda ~3 minutos en arrancar. El DAG fallará si se triggerrea antes de que `hive-server` esté healthy.
- **DAG idempotente**: El DAG se puede triggerear múltiples veces sin duplicar datos. Cada corrida limpia y recarga desde cero.
- **Keycloak**: Los tokens JWT expiran — si recibís 401, generá uno nuevo.
- **DB_ENGINE**: Limpiar variables de sesión en PowerShell antes de cambiar el motor: `Remove-Item Env:MONGO_URL -ErrorAction SilentlyContinue`
- **Kubernetes**: Las imágenes locales deben cargarse con `minikube image load` después de cada `minikube delete`.
- **Neo4J GDS**: El grafo proyectado `rutasGraph` se pierde al reiniciar Neo4J. Hay que proyectarlo de nuevo con `CALL gds.graph.project(...)` antes de usar Dijkstra.

---

## 📹 Video demo

[Ver demo en YouTube](https://youtu.be/vNMVTh52BFw)

---

## 👨‍💻 Autores

Proyecto desarrollado para el curso de **Bases de Datos II** — I Semestre 2026.

- **Tamara Robles Camacho** — 2024099342
- **Adrián Mora Rivera** — 2024800149

Profesor: Kenneth Obando | Instituto Tecnológico de Costa Rica
