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
