# 🍽️ API de Gestión de Restaurantes — Etapa 2

![Node.js](https://img.shields.io/badge/Node.js-20-green)
![Docker](https://img.shields.io/badge/Docker-Enabled-blue)
![MongoDB](https://img.shields.io/badge/MongoDB-7-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)
![Keycloak](https://img.shields.io/badge/Auth-Keycloak-orange)
![Kubernetes](https://img.shields.io/badge/Orchestration-Kubernetes-blue)
![ElasticSearch](https://img.shields.io/badge/Search-ElasticSearch-yellow)
![Redis](https://img.shields.io/badge/Cache-Redis-red)

Proyecto de **Bases de Datos II** — API REST para gestión de restaurantes, menús, reservas y pedidos con arquitectura profesional: CI/CD, sharding en MongoDB, búsqueda con ElasticSearch, caché con Redis, balanceo de carga con Nginx y escalabilidad horizontal con Kubernetes.

---

## 📌 Descripción

La API permite:
- Registro y autenticación de usuarios con JWT via Keycloak
- Gestión de restaurantes (solo administradores)
- Administración de menús y platos
- Creación y cancelación de reservas
- Realización y consulta de pedidos
- Búsqueda full-text de productos con ElasticSearch
- Caché de respuestas frecuentes con Redis

---

## 🏗️ Arquitectura del Sistema

```
         Cliente (Postman / Navegador)
                      ↓
              ┌───────────────┐
              │  Nginx (LB)   │  ← Balanceador de carga
              └───┬───────┬───┘
                  ↓       ↓
          ┌───────────┐ ┌────────────────┐
          │  API x5   │ │  Search x4     │
          │ Node.js   │ │  Node.js       │
          └─────┬─────┘ └──────┬─────────┘
                ↓              ↓
    ┌───────────────┐   ┌──────────────────┐
    │  PostgreSQL / │   │                  │
    │  MongoDB      │   │   ElasticSearch  │
    │  (Sharded)    │   │                  │
    │  configsvr    │   └──────────────────┘
    │  shard rs0    │
    │  mongos       │   ┌──────────────────┐
    └───────────────┘   │  Redis (Caché)   │
                        └──────────────────┘
    ┌──────────────────────────────────────┐
    │  Keycloak + PostgreSQL (Auth)        │
    └──────────────────────────────────────┘
```

---

## 🚀 Tecnologías

| Componente | Tecnología |
|---|---|
| API principal | Node.js + Express |
| Microservicio búsqueda | Node.js + Express |
| Base de datos principal | MongoDB 7 (sharded) o PostgreSQL 16 |
| Búsqueda | ElasticSearch 8 |
| Caché | Redis 7 |
| Autenticación | Keycloak 24 + JWT (RS256) |
| Balanceador | Nginx |
| Orquestación | Kubernetes (Minikube) |
| CI/CD | GitHub Actions |
| Pruebas | Jest + Supertest |

---

## ⚙️ Requisitos previos

- Docker Desktop (con al menos 8GB de RAM asignados)
- Minikube
- kubectl
- Git

---

## 🐳 Opción 1 — Docker Compose (desarrollo rápido)

### Con MongoDB
```bash
docker compose -f docker-compose.mongo.yml up --build
```

### Con PostgreSQL
```bash
docker compose -f docker-compose.postgres.yml up --build
```

### Detener y limpiar
```bash
docker compose -f docker-compose.mongo.yml down -v
```
# o bien
```bash
docker compose -f docker-compose.postgres.yml down -v
```

### Servicios disponibles (Docker Compose)

| Servicio | URL |
|---|---|
| API | http://localhost:3000 |
| Search | http://localhost:4000 |
| Nginx (balanceador) | http://localhost:80 |
| Keycloak | http://localhost:8080 |
| ElasticSearch | http://localhost:9200 |

---

## ☸️ Opción 2 — Kubernetes con Minikube (producción local)

### Construcción de imágenes

Antes del primer despliegue, construí las imágenes:

```powershell
docker build -t restaurantes/api:latest ./api
docker build -t restaurantes/search:latest ./search-service
```

### Despliegue completo (primera vez o reinicio limpio)

```powershell
.\deploy.ps1 -Clean
```

> ⚠️ El flag `-Clean` elimina el cluster anterior. Usalo solo si querés empezar de cero.

### Despliegue sin borrar el cluster

```powershell
.\deploy.ps1
```

### Limpiar todo manualmente

```powershell
minikube delete
```

### Acceso a los servicios (Kubernetes)

**Paso 1** — Abrir el tunnel en una terminal separada y dejarla abierta:
```powershell
minikube tunnel
```

**Paso 2** — Todos los endpoints van por Nginx en `http://localhost`:

| Endpoint | Descripción |
|---|---|
| `GET http://localhost/health` | Health check de Nginx |
| `GET http://localhost/api/restaurants` | API principal |
| `GET http://localhost/search/products?q=pizza` | Búsqueda |
| `POST http://localhost/search/reindex` | Reindexar productos |

**Paso 3** — Para obtener tokens de Keycloak, abrí un port-forward en otra terminal:
```powershell
kubectl port-forward svc/keycloak-service 9999:8080 -n restaurantes
```

Luego obtené el token:
```
POST http://localhost:9999/realms/restaurant/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=password
client_id=api-restaurant
client_secret=api-restaurant-secret
username=admin1
password=admin123
```

Usá el `access_token` en el header de todas las requests protegidas:
```
Authorization: Bearer <access_token>
```

---

## 🔄 Cambiar entre motores de base de datos

El sistema soporta MongoDB y PostgreSQL sin cambiar código. Solo cambiá `DB_ENGINE` en `k8s/configmap.yaml`:

```yaml
# Para MongoDB (default en K8s):
DB_ENGINE: "mongodb"

# Para PostgreSQL:
DB_ENGINE: "postgres"
```

Luego reiniciá los pods de la API:
```powershell
kubectl rollout restart deployment/api -n restaurantes
```

En Docker Compose, usá el archivo correspondiente:
```bash
# MongoDB:
docker compose -f docker-compose.mongo.yml up

# PostgreSQL:
docker compose -f docker-compose.postgres.yml up
```

---

## 📡 Endpoints de la API

Todos los endpoints van prefijados con `/api/` cuando se accede via Nginx/Kubernetes.

### 🔐 Auth

| Método | Endpoint | Descripción | Auth |
|---|---|---|---|
| POST | /api/auth/register | Registro de usuario | No |
| POST | /api/auth/login | Login y obtención de JWT | No |

### 👤 Usuarios

| Método | Endpoint | Descripción | Rol |
|---|---|---|---|
| GET | /api/users/me | Usuario autenticado | Cualquiera |
| PUT | /api/users/:id | Actualizar usuario | admin |
| DELETE | /api/users/:id | Eliminar usuario | admin |

### 🍽️ Restaurantes

| Método | Endpoint | Descripción | Rol |
|---|---|---|---|
| POST | /api/restaurants | Crear restaurante | admin |
| GET | /api/restaurants | Listar restaurantes | autenticado |

### 📋 Menús

| Método | Endpoint | Descripción | Rol |
|---|---|---|---|
| POST | /api/menus | Crear menú | admin |
| GET | /api/menus/:id | Obtener menú | autenticado |
| PUT | /api/menus/:id | Actualizar menú | admin |
| DELETE | /api/menus/:id | Eliminar menú | admin |

### 📅 Reservas

| Método | Endpoint | Descripción | Rol |
|---|---|---|---|
| POST | /api/reservations | Crear reserva | autenticado |
| DELETE | /api/reservations/:id | Cancelar reserva | autenticado |

### 🧾 Pedidos

| Método | Endpoint | Descripción | Rol |
|---|---|---|---|
| POST | /api/orders | Crear pedido | autenticado |
| GET | /api/orders/:id | Obtener pedido | autenticado |

### 🔍 Búsqueda (microservicio search)

| Método | Endpoint | Descripción |
|---|---|---|
| GET | /search/products?q=texto | Búsqueda full-text |
| GET | /search/products/category/:categoria | Filtrar por categoría |
| POST | /search/reindex | Reindexar productos |

---

## 🔐 Usuarios de prueba

| Usuario | Contraseña | Rol |
|---|---|---|
| admin1 | admin123 | admin |
| cliente1 | cliente123 | cliente |

---

## 📈 Escalabilidad horizontal

### Escalar manualmente en Kubernetes

```powershell
# Escalar API a 5 instancias
kubectl scale deployment api --replicas=5 -n restaurantes

# Escalar Search a 4 instancias
kubectl scale deployment search --replicas=4 -n restaurantes

# Ver distribución de pods
kubectl get pods -n restaurantes -l app=api
```

### HPA (Auto-scaling)

El cluster tiene HPA configurado — escala automáticamente según CPU/memoria:

```powershell
kubectl get hpa -n restaurantes
```

### Escalar en Docker Compose

```bash
docker compose -f docker-compose.mongo.yml up --scale api=3 --scale search=2
```

---

## 🧪 Pruebas

```bash
cd api

# Todas las pruebas con cobertura
npm test

# Solo unitarias
npm run test:unit

# Solo integración (requiere BD corriendo)
npm run test:integration
```

Cobertura mínima requerida: **90%** en statements, branches, functions y lines.

---

## 🗄️ Estructura de bases de datos

| BD | Propósito | Motor |
|---|---|---|
| `restaurantdb` | Datos de la aplicación | MongoDB o PostgreSQL |
| `keycloakdb` | Autenticación | PostgreSQL (exclusivo de Keycloak) |

---

## ⚠️ Notas importantes

- Keycloak corre en modo `start-dev` 
- Los tokens expiran — si obtenés 401, generá uno nuevo
- Al hacer `minikube delete` se pierden todos los datos del cluster
- En Windows, el tunnel de minikube debe mantenerse abierto en una terminal separada
- Las imágenes locales deben cargarse con `minikube image load` después de cada `minikube delete`
- Enlace al video demo: https://youtu.be/vNMVTh52BFw
---

## 👨‍💻 Autores

Proyecto desarrollado para el curso de **Bases de Datos II**.

- Tamara Robles Camacho — 2024099342
- Adrián Mora Rivera — 2024800149