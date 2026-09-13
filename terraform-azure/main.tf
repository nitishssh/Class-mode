# Class Mode — Azure production stack
#
# Mirrors what terraform-gcp/ provisioned on Google Cloud:
#   Cloud Run            -> Azure Container Apps (Consumption)
#   Cloud SQL Postgres   -> PostgreSQL Flexible Server (B1ms, pgvector)
#   Memorystore Redis    -> Azure Managed Redis (Balanced B0, Redis >= 7)
#   Secret Manager       -> ACA native secrets (values set via az CLI, never in TF state)
#   Artifact Registry    -> GHCR (kept; ACA pulls with a read:packages PAT)
#   WIF for GitHub CI    -> user-assigned identity + federated credential
#   Cloud Monitoring     -> Log Analytics + metric alerts + availability test
#
# Deliberately absent in v1: Front Door/WAF, Key Vault, VNet/private endpoints,
# zone-redundant HA. See docs/azure-migration.md.

data "azurerm_client_config" "current" {}

resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
}

# ---------------------------------------------------------------------------
# Observability
# ---------------------------------------------------------------------------

resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.app_name}-logs"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_application_insights" "main" {
  name                = "${var.app_name}-appinsights"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"
}

# ---------------------------------------------------------------------------
# Uploads — Azure Files share mounted at /app/public/uploads (zero code change:
# multer diskStorage + express.static both resolve public/uploads)
# ---------------------------------------------------------------------------

resource "azurerm_storage_account" "uploads" {
  name                            = "classmodeuploads"
  resource_group_name             = azurerm_resource_group.main.name
  location                        = azurerm_resource_group.main.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
}

resource "azurerm_storage_share" "uploads" {
  name               = "uploads"
  storage_account_id = azurerm_storage_account.uploads.id
  quota              = 5
}

# ---------------------------------------------------------------------------
# PostgreSQL Flexible Server (pgvector via azure.extensions)
# ---------------------------------------------------------------------------

resource "random_password" "pg_admin" {
  length  = 32
  special = false
}

resource "azurerm_postgresql_flexible_server" "main" {
  name                          = "classmode-pg"
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  version                       = var.pg_version
  administrator_login           = var.pg_admin_login
  administrator_password        = random_password.pg_admin.result
  sku_name                      = var.pg_sku_name
  storage_mb                    = var.pg_storage_mb
  backup_retention_days         = 7
  geo_redundant_backup_enabled  = false
  public_network_access_enabled = true
  zone                          = "1"

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_postgresql_flexible_server_configuration" "extensions" {
  name      = "azure.extensions"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "CITEXT,VECTOR"
}

resource "azurerm_postgresql_flexible_server_database" "eduai" {
  name      = var.pg_database_name
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

# Allow Azure-internal services (incl. ACA outbound) — coarse but v1-acceptable;
# VNet integration is the documented v2 hardening.
resource "azurerm_postgresql_flexible_server_firewall_rule" "azure_services" {
  name             = "allow-azure-services"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "admin_workstation" {
  count            = var.admin_client_ip == "" ? 0 : 1
  name             = "allow-admin-workstation"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = var.admin_client_ip
  end_ip_address   = var.admin_client_ip
}

# ---------------------------------------------------------------------------
# Azure Managed Redis (Redis 7.x — bullmq 5.x requires >= 6.2, which rules out
# classic Azure Cache Basic).
#
# NOT managed by Terraform: azurerm 4.x cannot express the Balanced_B0 SKU
# (its redis_enterprise resource only accepts Enterprise_E*/Flash SKUs, and
# the replacement azurerm_managed_redis_cluster lands in provider 5.x).
# Provisioned via CLI instead — see scripts/setup-azure-redis.sh:
#
#   az redisenterprise create --cluster-name classmode-redis \
#     --resource-group classmode-rg --location centralindia \
#     --sku Balanced_B0 --no-database
#   az redisenterprise database create --cluster-name classmode-redis \
#     --resource-group classmode-rg --client-protocol Encrypted \
#     --clustering-policy EnterpriseCluster --eviction-policy NoEviction \
#     --port 10000
#
# Revisit (import into TF) when azurerm 5.x is adopted.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Container Apps
# ---------------------------------------------------------------------------

resource "azurerm_container_app_environment" "main" {
  name                = "classmode-env"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  # azurerm 5.x requires logs_destination to be declared before it will accept
  # log_analytics_workspace_id; setting the workspace alone is an error now.
  # This is the behaviour that was already implicit, made explicit.
  logs_destination           = "log-analytics"
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
}

resource "azurerm_container_app_environment_storage" "uploads" {
  name                         = "uploads"
  container_app_environment_id = azurerm_container_app_environment.main.id
  account_name                 = azurerm_storage_account.uploads.name
  share_name                   = azurerm_storage_share.uploads.name
  access_key                   = azurerm_storage_account.uploads.primary_access_key
  access_mode                  = "ReadWrite"
}

resource "azurerm_container_app" "main" {
  name                         = var.app_name
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"

  registry {
    server               = "ghcr.io"
    username             = var.ghcr_username
    password_secret_name = "ghcr-token"
  }

  secret {
    name  = "ghcr-token"
    value = var.ghcr_token
  }

  ingress {
    external_enabled = true
    target_port      = var.container_port
    transport        = "auto"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

    container {
      name   = "app"
      image  = var.container_image
      cpu    = 0.5
      memory = "1Gi"

      # Non-secret env. Secrets (~20: POSTGRESQL_URL, REDIS_URL, JWT_SECRET, …)
      # are added post-apply via `az containerapp secret set` + secretref env
      # wiring (scripts/setup-azure-secrets.sh) so values never touch TF state.
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "PORT"
        value = tostring(var.container_port)
      }
      env {
        name  = "PG_SSL"
        value = "true"
      }
      env {
        name  = "AUTO_MIGRATE"
        value = "true"
      }
      env {
        name  = "ENABLE_LOCAL_PASSWORD_AUTH"
        value = "true"
      }
      # Both OAuth clients in GCP project 114646596478 (sign-in and Classroom)
      # were deleted along with the project; Google answers the consent screen
      # with "Error 401: deleted_client", which strands the user on Google's
      # own error page instead of returning them to /login. Having the client
      # id + secret set does not prove the client still exists, so this switch
      # is what actually hides the button. Flip to "true" once a replacement
      # OAuth client exists and GOOGLE_SIGNIN_CLIENT_ID/SECRET are rotated.
      env {
        name  = "ENABLE_GOOGLE_SIGNIN"
        value = "false"
      }

      volume_mounts {
        name = "uploads"
        path = "/app/public/uploads"
      }

      liveness_probe {
        transport = "HTTP"
        path      = "/api/health"
        port      = var.container_port
      }

      readiness_probe {
        transport = "HTTP"
        path      = "/api/health"
        port      = var.container_port
      }
    }

    volume {
      name         = "uploads"
      storage_name = azurerm_container_app_environment_storage.uploads.name
      storage_type = "AzureFile"
    }
  }

  lifecycle {
    # CI owns the image (az containerapp update); az CLI owns secret values and
    # the secretref env vars it wires up. Terraform must not fight either.
    ignore_changes = [
      template[0].container[0].image,
      template[0].container[0].env,
      secret,
    ]
  }
}

# ---------------------------------------------------------------------------
# GitHub Actions OIDC (mirrors the GCP Workload Identity Federation setup)
# ---------------------------------------------------------------------------

resource "azurerm_user_assigned_identity" "github_actions" {
  name                = "github-actions-deployer"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
}

resource "azurerm_federated_identity_credential" "github_main" {
  name                      = "github-main-branch"
  user_assigned_identity_id = azurerm_user_assigned_identity.github_actions.id
  audience                  = ["api://AzureADTokenExchange"]
  issuer                    = "https://token.actions.githubusercontent.com"
  subject                   = "repo:${var.github_repo}:ref:refs/heads/main"
}

# The deploy job runs in the `production` GitHub environment; Actions issues
# environment-scoped subjects for those jobs.
resource "azurerm_federated_identity_credential" "github_prod_env" {
  name                      = "github-production-environment"
  user_assigned_identity_id = azurerm_user_assigned_identity.github_actions.id
  audience                  = ["api://AzureADTokenExchange"]
  issuer                    = "https://token.actions.githubusercontent.com"
  subject                   = "repo:${var.github_repo}:environment:production"
}

resource "azurerm_role_assignment" "github_actions_contributor" {
  scope                = azurerm_resource_group.main.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_user_assigned_identity.github_actions.principal_id
}

# ---------------------------------------------------------------------------
# Alerts (replaces Cloud Monitoring uptime check + alert policies)
# ---------------------------------------------------------------------------

resource "azurerm_monitor_action_group" "email" {
  name                = "classmode-alerts"
  resource_group_name = azurerm_resource_group.main.name
  short_name          = "clsmode"

  email_receiver {
    name          = "ops"
    email_address = var.alert_email
  }
}

resource "azurerm_application_insights_standard_web_test" "health" {
  name                    = "classmode-health"
  resource_group_name     = azurerm_resource_group.main.name
  location                = azurerm_resource_group.main.location
  application_insights_id = azurerm_application_insights.main.id
  geo_locations           = ["apac-sg-sin-azr", "apac-hk-hkn-azr", "emea-au-syd-edge"]
  frequency               = 300
  enabled                 = true

  request {
    url = "https://${var.custom_domain}/api/health"
  }

  validation_rules {
    expected_status_code = 200
    ssl_check_enabled    = true
  }
}

resource "azurerm_monitor_metric_alert" "availability" {
  name                = "classmode-availability"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_application_insights.main.id, azurerm_application_insights_standard_web_test.health.id]
  description         = "Health endpoint availability below 90%"
  severity            = 1
  frequency           = "PT5M"
  window_size         = "PT15M"

  application_insights_web_test_location_availability_criteria {
    web_test_id           = azurerm_application_insights_standard_web_test.health.id
    component_id          = azurerm_application_insights.main.id
    failed_location_count = 2
  }

  action {
    action_group_id = azurerm_monitor_action_group.email.id
  }
}

resource "azurerm_monitor_metric_alert" "pg_cpu" {
  name                = "classmode-pg-cpu"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_postgresql_flexible_server.main.id]
  description         = "Postgres CPU above 90% for 15 minutes"
  severity            = 2
  frequency           = "PT5M"
  window_size         = "PT15M"

  criteria {
    metric_namespace = "Microsoft.DBforPostgreSQL/flexibleServers"
    metric_name      = "cpu_percent"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 90
  }

  action {
    action_group_id = azurerm_monitor_action_group.email.id
  }
}

resource "azurerm_monitor_metric_alert" "pg_storage" {
  name                = "classmode-pg-storage"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_postgresql_flexible_server.main.id]
  description         = "Postgres storage above 80%"
  severity            = 2
  frequency           = "PT15M"
  window_size         = "PT1H"

  criteria {
    metric_namespace = "Microsoft.DBforPostgreSQL/flexibleServers"
    metric_name      = "storage_percent"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 80
  }

  action {
    action_group_id = azurerm_monitor_action_group.email.id
  }
}
