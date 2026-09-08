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
  default     = "ghcr.io/nitishssh/personallearningpro/personallearningpro:main"
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
  description = "GitHub username for GHCR image pulls. Must be the package OWNER — the nitishkumar-ai namespace does not exist, and pointing here published to a package that could never be pulled."
  type        = string
  default     = "nitishssh"
}

variable "ghcr_token" {
  description = "Fine-grained GitHub PAT with read:packages, used by ACA to pull images. Set via TF_VAR_ghcr_token."
  type        = string
  sensitive   = true
}

# GitHub issues IMMUTABLE OIDC subject claims: the `sub` embeds numeric ids as
# `owner@ownerId/repo@repoId`, so renaming an account can no longer hand trust to
# whoever claims the freed name. This variable is that identifier, NOT a slug — a
# plain `owner/repo` here mints tokens Entra rejects.
#
# The account was renamed NitishKumar-ai -> nitishssh while the credential still
# carried the old plain slug, so every production deploy since has failed at
# `azure/login` with AADSTS700213. The claim the runner actually presented:
#   repo:nitishssh@99980274/Class-mode@961982550:environment:production
#
# The ids survive renames and moves; re-derive them with:
#   gh api user --jq '.id'                        # or /orgs/<org>
#   gh api repos/<owner>/<repo> --jq '.id'
variable "github_repo" {
  description = "Immutable OIDC subject identifier for the Class-mode repo, as owner@ownerId/repo@repoId."
  type        = string
  default     = "nitishssh@99980274/Class-mode@961982550"
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

# ── ClassMode Studio ─────────────────────────────────────────────────────────

variable "studio_app_name" {
  description = "Container App name for ClassMode Studio"
  type        = string
  default     = "classmode-studio"
}

variable "studio_container_image" {
  description = "Initial Studio image. CI owns it thereafter; Terraform ignores drift."
  type        = string
  default     = "ghcr.io/nitishssh/classmode-studio:main"
}

variable "studio_container_port" {
  description = "Port Studio binds. Its Dockerfile sets ENV PORT=3000 and EXPOSEs 3000."
  type        = number
  default     = 3000
}

variable "studio_min_replicas" {
  description = "Keep >= 1. A cold Next.js standalone boot during lesson generation is a teacher watching a spinner."
  type        = number
  default     = 1
}

variable "studio_max_replicas" {
  type    = number
  default = 2
}

variable "studio_database_name" {
  description = "Studio's database on the shared flexible server (separate from Class-mode's `eduai`)."
  type        = string
  default     = "classmode_studio"
}

# Same immutable form as `github_repo` above. Studio is a separate repository, so
# it presents a different subject and needs its own federated credential; see
# studio.tf.
variable "studio_github_repo" {
  description = "Immutable OIDC subject identifier for the classmode-studio repo, as owner@ownerId/repo@repoId."
  type        = string
  default     = "nitishssh@99980274/classmode-studio@1351348662"
}
