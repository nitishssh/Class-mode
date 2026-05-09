terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ─── Artifact Registry ────────────────────────────────────────────────────────
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = var.repository_name
  description   = "Docker repository for PersonalLearningPro"
  format        = "DOCKER"
}

# ─── Secret Manager ───────────────────────────────────────────────────────────
# We create a single secret that will hold the entire .env content or 
# individual secrets. For simplicity and security, individual secrets are better.

resource "google_secret_manager_secret" "app_secrets" {
  for_each = toset([
    "MONGODB_URL",
    "GOOGLE_API_KEY",
    "FIREBASE_SERVICE_ACCOUNT_JSON",
    "SESSION_SECRET",
    "JWT_SECRET",
    "REFRESH_SECRET"
  ])

  secret_id = each.key

  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }
}

# ─── Cloud Run Service ────────────────────────────────────────────────────────
resource "google_cloud_run_v2_service" "default" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${var.repository_name}/${var.service_name}:latest"

      ports {
        container_port = 5001
      }

      # Environment variables from Secret Manager
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

      # Static environment variables
      env {
        name  = "NODE_ENV"
        value = "production"
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# ─── IAM Bindings ─────────────────────────────────────────────────────────────
# Allow Cloud Run to access secrets
resource "google_secret_manager_secret_iam_member" "secret_access" {
  for_each  = google_secret_manager_secret.app_secrets
  project   = var.project_id
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
}

# Allow public access to Cloud Run service (optional, based on security needs)
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  location = google_cloud_run_v2_service.default.location
  name     = google_cloud_run_v2_service.default.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

data "google_project" "project" {}
