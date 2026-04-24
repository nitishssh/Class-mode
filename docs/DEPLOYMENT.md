# PersonalLearningPro Deployment Guide

## Production Deployment

This guide covers deploying PersonalLearningPro microservices to production.

## Prerequisites

- Docker and Docker Compose installed
- Domain name (e.g., `eduai.app`)
- SSL certificates (Let's Encrypt recommended)
- Cloud provider account (AWS, GCP, Azure, or DigitalOcean)
- MongoDB Atlas or self-hosted MongoDB
- Cassandra cluster or Astra DB

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer (ALB/NLB)                  │
│                    (SSL/TLS Termination)                    │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
    ┌───▼────┐          ┌────▼────┐          ┌────▼────┐
    │ Nginx  │          │ Nginx   │          │ Nginx   │
    │ (Pod)  │          │ (Pod)   │          │ (Pod)   │
    └───┬────┘          └────┬────┘          └────┬────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
    ┌───▼────┐          ┌───▼────┐          ┌───▼────┐
    │ EduAI  │          │OpenMAIC │          │IniClaw │
    │ (Pod)  │          │ (Pod)   │          │ (Pod)  │
    └────────┘          └────────┘          └────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
    ┌───▼────┐          ┌───▼────┐          ┌───▼────┐
    │MongoDB │          │Cassandra│          │ Redis  │
    │ Atlas  │          │ Astra   │          │ Cluster│
    └────────┘          └────────┘          └────────┘
```

## Step 1: Prepare Production Environment

### 1.1 Create `.env.production`

```bash
# Copy and customize for production
cp .env.example .env.production

# Critical settings
NODE_ENV=production
PORT=5001

# Database URLs (use managed services)
MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/eduai
ASTRA_DB_APPLICATION_TOKEN=<token>
ASTRA_DB_KEYSPACE=chat

# Firebase (same as development)
VITE_FIREBASE_API_KEY=<your-key>
VITE_FIREBASE_PROJECT_ID=<your-project>
FIREBASE_SERVICE_ACCOUNT_JSON=<base64-encoded>

# OpenAI
OPENAI_API_KEY=<your-key>

# Session & Security
SESSION_SECRET=<generate-with-openssl-rand-hex-32>
BRIDGE_SECRET=<generate-with-openssl-rand-hex-32>

# CORS
CORS_ORIGIN=https://eduai.app,https://arena.eduai.app,https://gateway.eduai.app

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<sendgrid-api-key>
SMTP_FROM=EduAI <noreply@eduai.app>
APP_URL=https://eduai.app

# Service URLs
OPENMAIC_INTERNAL_URL=http://openmaic-web:3000
INICLAW_GATEWAY_URL=http://iniclaw-gateway:4000
```

### 1.2 Generate SSL Certificates

```bash
# Using Let's Encrypt with Certbot
sudo certbot certonly --standalone \
  -d eduai.app \
  -d arena.eduai.app \
  -d gateway.eduai.app

# Copy certificates to nginx-ssl/
sudo cp /etc/letsencrypt/live/eduai.app/fullchain.pem nginx-ssl/cert.pem
sudo cp /etc/letsencrypt/live/eduai.app/privkey.pem nginx-ssl/key.pem
sudo chown $USER:$USER nginx-ssl/*
```

### 1.3 Update Nginx Configuration

Update `nginx.conf` for production:

```nginx
# Change server_name from _ to your domain
server_name eduai.app arena.eduai.app gateway.eduai.app;

# Update SSL certificate paths
ssl_certificate /etc/nginx/ssl/cert.pem;
ssl_certificate_key /etc/nginx/ssl/key.pem;

# Add security headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

## Step 2: Deploy to Kubernetes (Recommended)

### 2.1 Create Kubernetes Manifests

```bash
# Create k8s directory
mkdir -p k8s/production

# Create namespace
kubectl create namespace eduai-prod
```

### 2.2 Create Deployment Manifests

**k8s/production/eduai-deployment.yaml:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: eduai-app
  namespace: eduai-prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: eduai-app
  template:
    metadata:
      labels:
        app: eduai-app
    spec:
      containers:
      - name: eduai-app
        image: eduai:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 5001
        env:
        - name: NODE_ENV
          value: "production"
        - name: MONGODB_URL
          valueFrom:
            secretKeyRef:
              name: eduai-secrets
              key: mongodb-url
        - name: FIREBASE_SERVICE_ACCOUNT_JSON
          valueFrom:
            secretKeyRef:
              name: eduai-secrets
              key: firebase-service-account
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: eduai-secrets
              key: openai-api-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 5001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 5001
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: eduai-app
  namespace: eduai-prod
spec:
  selector:
    app: eduai-app
  ports:
  - protocol: TCP
    port: 5001
    targetPort: 5001
  type: ClusterIP
```

**k8s/production/openmaic-deployment.yaml:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openmaic-web
  namespace: eduai-prod
spec:
  replicas: 2
  selector:
    matchLabels:
      app: openmaic-web
  template:
    metadata:
      labels:
        app: openmaic-web
    spec:
      containers:
      - name: openmaic-web
        image: openmaic:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: NEXT_PUBLIC_FIREBASE_PROJECT_ID
          valueFrom:
            secretKeyRef:
              name: eduai-secrets
              key: firebase-project-id
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: openmaic-web
  namespace: eduai-prod
spec:
  selector:
    app: openmaic-web
  ports:
  - protocol: TCP
    port: 3000
    targetPort: 3000
  type: ClusterIP
```

**k8s/production/iniclaw-deployment.yaml:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: iniclaw-gateway
  namespace: eduai-prod
spec:
  replicas: 2
  selector:
    matchLabels:
      app: iniclaw-gateway
  template:
    metadata:
      labels:
        app: iniclaw-gateway
    spec:
      containers:
      - name: iniclaw-gateway
        image: iniclaw:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 4000
        env:
        - name: NODE_ENV
          value: "production"
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: eduai-secrets
              key: openai-api-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 4000
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: iniclaw-gateway
  namespace: eduai-prod
spec:
  selector:
    app: iniclaw-gateway
  ports:
  - protocol: TCP
    port: 4000
    targetPort: 4000
  type: ClusterIP
```

### 2.3 Create Secrets

```bash
# Create secrets from .env.production
kubectl create secret generic eduai-secrets \
  --from-literal=mongodb-url="$(grep MONGODB_URL .env.production | cut -d= -f2)" \
  --from-literal=firebase-service-account="$(grep FIREBASE_SERVICE_ACCOUNT_JSON .env.production | cut -d= -f2)" \
  --from-literal=openai-api-key="$(grep OPENAI_API_KEY .env.production | cut -d= -f2)" \
  --from-literal=firebase-project-id="$(grep VITE_FIREBASE_PROJECT_ID .env.production | cut -d= -f2)" \
  -n eduai-prod
```

### 2.4 Deploy to Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/production/

# Check deployment status
kubectl get deployments -n eduai-prod
kubectl get pods -n eduai-prod
kubectl get services -n eduai-prod

# View logs
kubectl logs -f deployment/eduai-app -n eduai-prod
```

## Step 3: Deploy with Docker Compose (Alternative)

### 3.1 Build Images

```bash
# Build production images
docker compose build --no-cache

# Tag images
docker tag personallearningpro-eduai-app:latest myregistry/eduai:latest
docker tag personallearningpro-openmaic-web:latest myregistry/openmaic:latest
docker tag personallearningpro-iniclaw-gateway:latest myregistry/iniclaw:latest

# Push to registry
docker push myregistry/eduai:latest
docker push myregistry/openmaic:latest
docker push myregistry/iniclaw:latest
```

### 3.2 Deploy with Docker Compose

```bash
# Use production profile
docker compose --profile prod up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

## Step 4: Configure Monitoring & Logging

### 4.1 Set Up Prometheus

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'eduai'
    static_configs:
      - targets: ['localhost:5001']
  - job_name: 'openmaic'
    static_configs:
      - targets: ['localhost:3000']
  - job_name: 'iniclaw'
    static_configs:
      - targets: ['localhost:4000']
```

### 4.2 Set Up ELK Stack

```bash
# Deploy Elasticsearch, Logstash, Kibana
docker compose -f docker-compose.elk.yml up -d

# Configure log forwarding from services
# Update docker-compose.yml to include logging driver
```

## Step 5: Set Up CI/CD

### 5.1 GitHub Actions Workflow

**.github/workflows/deploy-production.yml:**

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker images
        run: docker compose build --no-cache
      
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push myregistry/eduai:latest
          docker push myregistry/openmaic:latest
          docker push myregistry/iniclaw:latest
      
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/eduai-app eduai-app=myregistry/eduai:latest -n eduai-prod
          kubectl set image deployment/openmaic-web openmaic-web=myregistry/openmaic:latest -n eduai-prod
          kubectl set image deployment/iniclaw-gateway iniclaw-gateway=myregistry/iniclaw:latest -n eduai-prod
```

## Step 6: Database Setup

### 6.1 MongoDB Atlas

```bash
# Create cluster
# Enable IP whitelist for your servers
# Create database user
# Get connection string

# Update .env.production
MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/eduai
```

### 6.2 Cassandra / Astra DB

```bash
# Create Astra DB cluster
# Download secure connect bundle
# Get application token

# Update .env.production
ASTRA_DB_APPLICATION_TOKEN=<token>
ASTRA_DB_KEYSPACE=chat
```

## Step 7: Backup & Recovery

### 7.1 MongoDB Backup

```bash
# Automated backup with MongoDB Atlas
# Or manual backup:
mongodump --uri="mongodb+srv://user:pass@cluster.mongodb.net/eduai" --out=./backup

# Restore:
mongorestore --uri="mongodb+srv://user:pass@cluster.mongodb.net/eduai" ./backup
```

### 7.2 Cassandra Backup

```bash
# Create snapshot
nodetool snapshot -t backup-$(date +%Y%m%d) eduai

# Backup snapshots
tar -czf cassandra-backup-$(date +%Y%m%d).tar.gz /var/lib/cassandra/data/*/eduai/*/snapshots/
```

## Step 8: Security Hardening

### 8.1 Network Security

```bash
# Configure firewall rules
# Allow only necessary ports:
# - 80 (HTTP redirect)
# - 443 (HTTPS)
# - 27017 (MongoDB - internal only)
# - 9042 (Cassandra - internal only)
# - 6379 (Redis - internal only)
```

### 8.2 Secrets Management

```bash
# Use AWS Secrets Manager, Azure Key Vault, or similar
# Never commit secrets to git
# Rotate secrets regularly
```

### 8.3 SSL/TLS

```bash
# Enable HSTS
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# Use strong ciphers
ssl_ciphers HIGH:!aNULL:!MD5;
ssl_prefer_server_ciphers on;

# Enable OCSP stapling
ssl_stapling on;
ssl_stapling_verify on;
```

## Monitoring & Maintenance

### Health Checks

```bash
# Monitor service health
curl https://eduai.app/api/health
curl https://eduai.app/arena/api/health
curl https://eduai.app/gateway/api/health
```

### Log Aggregation

```bash
# View logs from all services
kubectl logs -f deployment/eduai-app -n eduai-prod
kubectl logs -f deployment/openmaic-web -n eduai-prod
kubectl logs -f deployment/iniclaw-gateway -n eduai-prod
```

### Performance Monitoring

```bash
# Monitor resource usage
kubectl top nodes
kubectl top pods -n eduai-prod

# Check database performance
# MongoDB Atlas dashboard
# Cassandra nodetool commands
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
kubectl logs deployment/eduai-app -n eduai-prod

# Check resource limits
kubectl describe pod <pod-name> -n eduai-prod

# Check environment variables
kubectl exec -it <pod-name> -n eduai-prod -- env | grep FIREBASE
```

### Database Connection Issues

```bash
# Test MongoDB connection
mongosh "mongodb+srv://user:pass@cluster.mongodb.net/eduai"

# Test Cassandra connection
cqlsh -u cassandra -p password <host>
```

### SSL Certificate Issues

```bash
# Check certificate expiration
openssl x509 -in nginx-ssl/cert.pem -text -noout | grep -A 2 "Validity"

# Renew certificate
sudo certbot renew --force-renewal
```

## Rollback Procedure

```bash
# Rollback to previous deployment
kubectl rollout undo deployment/eduai-app -n eduai-prod
kubectl rollout undo deployment/openmaic-web -n eduai-prod
kubectl rollout undo deployment/iniclaw-gateway -n eduai-prod

# Check rollout status
kubectl rollout status deployment/eduai-app -n eduai-prod
```

## References

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- [Cassandra Astra DB](https://astra.datastax.com/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Nginx Documentation](https://nginx.org/en/docs/)
