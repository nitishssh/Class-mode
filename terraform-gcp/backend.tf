# Remote state in GCS — create the bucket manually once before first `terraform init`:
#   gsutil mb -l us-central1 gs://plp-terraform-state
#   gsutil versioning set on gs://plp-terraform-state
terraform {
  backend "gcs" {
    bucket = "plp-terraform-state"
    prefix = "terraform/state"
  }
}
