# Observability Setup for PersonalLearningPro

We use **kube-prometheus-stack** to deploy Prometheus, Grafana, and Alertmanager via Helm.

## Prerequisites

- Helm v3 installed
- Kubeconfig pointing to the EKS cluster (`terraform output cluster_endpoint`)

## Installation

```bash
# 1. Add the prometheus-community Helm repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# 2. Create a dedicated namespace for monitoring
kubectl create namespace monitoring

# 3. Install the stack using custom values
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  -f values-prometheus.yaml
```

## `values-prometheus.yaml`

```yaml
grafana:
  adminPassword: "admin" # Change in production (use external secret)
  ingress:
    enabled: true
    ingressClassName: nginx
    hosts:
      - grafana.app.personallearningpro.com
    tls:
      - secretName: grafana-tls
        hosts:
          - grafana.app.personallearningpro.com

prometheus:
  prometheusSpec:
    retention: 15d
    storageSpec:
      volumeClaimTemplate:
        spec:
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 50Gi
```

## Accessing Dashboards

Once deployed, navigate to `https://grafana.app.personallearningpro.com`.
The stack automatically discovers metrics from Kubernetes nodes, pods, and any ServiceMonitors we configure.
