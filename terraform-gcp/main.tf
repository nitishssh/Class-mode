terraform {
  required_version = ">= 1.9.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.32"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ─── Enable required APIs ─────────────────────────────────────────────────────
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "vpcaccess.googleapis.com",
    "redis.googleapis.com",
    "monitoring.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ])
  service            = each.value
  disable_on_destroy = false
}

# ─── VPC Network ──────────────────────────────────────────────────────────────
resource "google_compute_network" "vpc" {
  name                    = "${var.service_name}-vpc"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.apis]
}

resource "google_compute_subnetwork" "subnet" {
  name                     = "${var.service_name}-subnet"
  ip_cidr_range            = "10.10.0.0/24"
  region                   = var.region
  network                  = google_compute_network.vpc.id
  private_ip_google_access = true
}

# ─── VPC Access Connector (Cloud Run → VPC) ───────────────────────────────────
resource "google_vpc_access_connector" "connector" {
  name          = "${var.service_name}-conn"
  region        = var.region
  ip_cidr_range = "10.8.0.0/28"
  network       = google_compute_network.vpc.id
  depends_on    = [google_project_service.apis]
}

# ─── Cloud Memorystore (Managed Redis 7.2 HA) ─────────────────────────────────
resource "google_redis_instance" "cache" {
  name           = "${var.service_name}-redis"
  tier           = "STANDARD_HA"
  memory_size_gb = 1
  region         = var.region

  authorized_network = google_compute_network.vpc.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"
  redis_version      = "REDIS_7_2"
  display_name       = "PLP Redis Cache"
  reserved_ip_range  = "10.9.0.0/29"

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 2
        minutes = 0
        seconds = 0
        nanos   = 0
      }
    }
  }

  depends_on = [google_project_service.apis]
}

# ─── Dedicated Service Account ────────────────────────────────────────────────
resource "google_service_account" "cloud_run_sa" {
  account_id   = "${var.service_name}-sa"
  display_name = "PersonalLearningPro Cloud Run SA"
  depends_on   = [google_project_service.apis]
}

# ─── Artifact Registry ────────────────────────────────────────────────────────
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = var.repository_name
  description   = "Docker repository for PersonalLearningPro"
  format        = "DOCKER"

  cleanup_policies {
    id     = "keep-minimum-versions"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  depends_on = [google_project_service.apis]
}

# ─── Secret Manager ───────────────────────────────────────────────────────────
resource "google_secret_manager_secret" "app_secrets" {
  for_each = toset([
    "MONGODB_URL",
    "GOOGLE_API_KEY",
    "FIREBASE_SERVICE_ACCOUNT_JSON",
    "SESSION_SECRET",
    "JWT_SECRET",
    "REFRESH_SECRET",
    "STRIPE_SECRET_KEY",
    "OPENAI_API_KEY",
    "DAILY_API_KEY",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASS",
    "BRIDGE_SECRET",
  ])

  secret_id = each.key

  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }

  depends_on = [google_project_service.apis]
}

# ─── IAM: Cloud Run SA → Secret Manager ──────────────────────────────────────
resource "google_secret_manager_secret_iam_member" "secret_access" {
  for_each  = google_secret_manager_secret.app_secrets
  project   = var.project_id
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# ─── IAM: Cloud Run SA → Artifact Registry (pull) ────────────────────────────
resource "google_artifact_registry_repository_iam_member" "ar_reader" {
  location   = google_artifact_registry_repository.repo.location
  repository = google_artifact_registry_repository.repo.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# ─── Workload Identity Pool (GitHub Actions OIDC) ─────────────────────────────
resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-actions-pool"
  display_name              = "GitHub Actions Pool"
  description               = "Identity pool for GitHub Actions OIDC — no static keys needed"
  depends_on                = [google_project_service.apis]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub Actions Provider"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  attribute_mapping = {
    "google.subject"             = "assertion.sub"
    "attribute.actor"            = "assertion.actor"
    "attribute.repository"       = "assertion.repository"
    "attribute.repository_owner" = "assertion.repository_owner"
  }

  attribute_condition = "attribute.repository_owner == '${var.github_org}'"
}

resource "google_service_account_iam_member" "github_oidc" {
  service_account_id = google_service_account.cloud_run_sa.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_org}/${var.github_repo}"
}

# ─── IAM: Cloud Run SA → deploy permissions ───────────────────────────────────
resource "google_project_iam_member" "cloud_run_deployer" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_project_iam_member" "ar_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# ─── Cloud Armor WAF ──────────────────────────────────────────────────────────
resource "google_compute_security_policy" "waf" {
  name        = "${var.service_name}-waf"
  description = "OWASP top-10 protection for PersonalLearningPro"

  rule {
    action   = "deny(403)"
    priority = 1000
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('xss-v33-stable')"
      }
    }
    description = "Block XSS"
  }

  rule {
    action   = "deny(403)"
    priority = 1001
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sqli-v33-stable')"
      }
    }
    description = "Block SQL injection"
  }

  rule {
    action   = "deny(403)"
    priority = 1002
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('lfi-v33-stable')"
      }
    }
    description = "Block LFI"
  }

  rule {
    action   = "deny(403)"
    priority = 1003
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('rce-v33-stable')"
      }
    }
    description = "Block RCE"
  }

  rule {
    action   = "allow"
    priority = 2147483647
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow"
  }

  depends_on = [google_project_service.apis]
}

# ─── Cloud Run v2 Service ─────────────────────────────────────────────────────
resource "google_cloud_run_v2_service" "default" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloud_run_sa.email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    max_instance_request_concurrency = 80

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${var.repository_name}/${var.service_name}:latest"

      ports {
        container_port = 5001
      }

      resources {
        limits = {
          memory = var.memory_limit
          cpu    = var.cpu_limit
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      liveness_probe {
        http_get {
          path = "/api/health"
          port = 5001
        }
        initial_delay_seconds = 20
        period_seconds        = 30
        timeout_seconds       = 10
        failure_threshold     = 3
      }

      startup_probe {
        http_get {
          path = "/api/health"
          port = 5001
        }
        initial_delay_seconds = 10
        period_seconds        = 10
        timeout_seconds       = 5
        failure_threshold     = 12
      }

      dynamic "env" {
        for_each = google_secret_manager_secret.app_secrets
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value.secret_id
              version = "latest"
            }
          }
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "PORT"
        value = "5001"
      }
      env {
        name  = "CORS_ORIGIN"
        value = "https://${var.app_domain}"
      }
      env {
        name  = "APP_URL"
        value = "https://${var.app_domain}"
      }
      env {
        name  = "DNS_IPV4_FIRST"
        value = "true"
      }
      env {
        name  = "REDIS_HOST"
        value = google_redis_instance.cache.host
      }
      env {
        name  = "REDIS_PORT"
        value = tostring(google_redis_instance.cache.port)
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_vpc_access_connector.connector,
    google_redis_instance.cache,
    google_secret_manager_secret_iam_member.secret_access,
  ]
}

# ─── Public access ────────────────────────────────────────────────────────────
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  location = google_cloud_run_v2_service.default.location
  name     = google_cloud_run_v2_service.default.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ─── Cloud Monitoring: Uptime Check ───────────────────────────────────────────
resource "google_monitoring_uptime_check_config" "uptime" {
  display_name = "${var.service_name}-uptime"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/api/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.app_domain
    }
  }

  depends_on = [google_project_service.apis]
}

# ─── Cloud Monitoring: Alert notification channel ─────────────────────────────
resource "google_monitoring_notification_channel" "email" {
  display_name = "PLP Alerts"
  type         = "email"
  labels = {
    email_address = var.alert_email
  }
  depends_on = [google_project_service.apis]
}

# ─── Cloud Monitoring: High error rate alert ──────────────────────────────────
resource "google_monitoring_alert_policy" "high_error_rate" {
  display_name = "${var.service_name}: High 5xx Error Rate"
  combiner     = "OR"

  conditions {
    display_name = "5xx rate > 5%"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class=\"5xx\""
      duration        = "60s"
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]
  alert_strategy {
    auto_close = "1800s"
  }

  depends_on = [google_project_service.apis]
}

# ─── Cloud Monitoring: High latency alert ─────────────────────────────────────
resource "google_monitoring_alert_policy" "high_latency" {
  display_name = "${var.service_name}: p95 Latency > 5s"
  combiner     = "OR"

  conditions {
    display_name = "p95 latency > 5000ms"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_latencies\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 5000
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_95"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]
  alert_strategy {
    auto_close = "1800s"
  }

  depends_on = [google_project_service.apis]
}
