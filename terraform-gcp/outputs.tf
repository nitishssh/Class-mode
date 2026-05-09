output "cloud_run_url" {
  description = "The URL of the Cloud Run service"
  value       = google_cloud_run_v2_service.default.uri
}

output "artifact_registry_repo" {
  description = "The Artifact Registry repository"
  value       = google_artifact_registry_repository.repo.name
}
