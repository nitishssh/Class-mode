variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "centralindia"
}

variable "resource_group_name" {
  description = "Resource group holding every Class Mode resource"
  type        = string
  default     = "classmode-rg"
}

variable "app_name" {
  description = "Container App name (also used as a prefix for related resources)"
  type        = string
  default     = "classmode-app"
}

variable "container_image" {
  description = "Initial container image. Day-to-day deploys are done by CI (az containerapp update); Terraform ignores drift on this."
  type        = string
  default     = "ghcr.io/nitishkumar-ai/class-mode/personallearningpro:main"
}

variable "container_port" {
  description = "Port the server binds (server/index.ts reads PORT, default 5001)"
  type        = number
  default     = 5001
}

variable "min_replicas" {
  description = "Minimum replicas. Keep >= 1 so BullMQ workers and Redis Streams consumers stay alive."
  type        = number
  default     = 1
}

variable "max_replicas" {
  type    = number
  default = 3
}

variable "pg_version" {
  type    = string
  default = "16"
}

variable "pg_sku_name" {
  description = "Postgres Flexible Server SKU (B_Standard_B1ms = burstable 1 vCPU / 2 GiB)"
  type        = string
  default     = "B_Standard_B1ms"
}

variable "pg_storage_mb" {
  type    = number
  default = 32768
}

variable "pg_admin_login" {
  type    = string
  default = "plpadmin"
}

variable "pg_database_name" {
  type    = string
  default = "eduai"
}

variable "admin_client_ip" {
  description = "Your workstation IP, allowed through the Postgres firewall for psql/migration work. Set via TF_VAR_admin_client_ip."
  type        = string
  default     = ""
}

variable "ghcr_username" {
  description = "GitHub username for GHCR image pulls"
  type        = string
  default     = "nitishkumar-ai"
}

variable "ghcr_token" {
  description = "Fine-grained GitHub PAT with read:packages, used by ACA to pull images. Set via TF_VAR_ghcr_token."
  type        = string
  sensitive   = true
}

variable "github_repo" {
  description = "GitHub org/repo slug for the Actions OIDC federated credential"
  type        = string
  default     = "NitishKumar-ai/Class-mode"
}

variable "alert_email" {
  description = "Email address for monitoring alerts"
  type        = string
  default     = "alerts@inmodel.in"
}

variable "custom_domain" {
  description = "Production hostname (bound to ACA at cutover via az CLI; kept here for reference/outputs)"
  type        = string
  default     = "classmode.inmodel.in"
}
