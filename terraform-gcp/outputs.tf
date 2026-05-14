output "cloud_run_url" {
  description = "The URL of the Cloud Run service"
  value       = google_cloud_run_v2_service.default.uri
}

output "artifact_registry_repo" {
  description = "Full Artifact Registry repository path"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${var.repository_name}"
}

output "redis_host" {
  description = "Cloud Memorystore Redis host (private IP, accessible via VPC connector)"
  value       = google_redis_instance.cache.host
  sensitive   = true
}

output "redis_port" {
  description = "Cloud Memorystore Redis port"
  value       = google_redis_instance.cache.port
}

output "workload_identity_provider" {
  description = "Workload Identity provider resource name — use in GitHub Actions google-github-actions/auth"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "service_account_email" {
  description = "Cloud Run service account email — use as service_account in google-github-actions/auth"
  value       = google_service_account.cloud_run_sa.email
}

output "vpc_connector_id" {
  description = "VPC Access connector ID"
  value       = google_vpc_access_connector.connector.id
}
