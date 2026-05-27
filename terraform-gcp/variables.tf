variable "project_id" {
  description = "The GCP project ID"
  type        = string
  default     = "plp-prod-2026"
}

variable "region" {
  description = "The GCP region to deploy to"
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "The name of the Cloud Run service"
  type        = string
  default     = "personallearningpro"
}

variable "repository_name" {
  description = "The name of the Artifact Registry repository"
  type        = string
  default     = "plp-repo"
}

variable "app_domain" {
  description = "Production domain for CORS_ORIGIN and APP_URL"
  type        = string
  default     = "inmodel.in"
}

variable "min_instances" {
  description = "Minimum number of Cloud Run instances (0 = scale to zero)"
  type        = number
  default     = 1
}

variable "max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 20
}

variable "memory_limit" {
  description = "Memory limit for Cloud Run container"
  type        = string
  default     = "2Gi"
}

variable "cpu_limit" {
  description = "CPU limit for Cloud Run container"
  type        = string
  default     = "2"
}

variable "github_org" {
  description = "GitHub organization or username for Workload Identity Federation"
  type        = string
  default     = "nitishkumar-ai"
}

variable "github_repo" {
  description = "GitHub repository name for Workload Identity Federation"
  type        = string
  default     = "PersonalLearningPro"
}

variable "alert_email" {
  description = "Email address for Cloud Monitoring alert notifications"
  type        = string
  default     = "alerts@inmodel.in"
}

variable "cloud_sql_instance_name" {
  description = "Cloud SQL PostgreSQL instance name"
  type        = string
  default     = "plp-pg"
}

variable "cloud_sql_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-custom-1-3840"
}

variable "postgres_database_name" {
  description = "Application PostgreSQL database name"
  type        = string
  default     = "eduai"
}

variable "postgres_user_name" {
  description = "Application PostgreSQL user name"
  type        = string
  default     = "plpapp"
}
