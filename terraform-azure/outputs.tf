output "container_app_fqdn" {
  description = "Default ACA hostname (smoke-test target; CNAME target at cutover)"
  value       = azurerm_container_app.main.ingress[0].fqdn
}

output "postgres_fqdn" {
  value = azurerm_postgresql_flexible_server.main.fqdn
}

output "postgres_admin_login" {
  value = var.pg_admin_login
}

output "postgres_admin_password" {
  value     = random_password.pg_admin.result
  sensitive = true
}

output "postgresql_url_app" {
  description = "Template for the app's POSTGRESQL_URL secret (swap in the plpapp role + password created during data migration)"
  value       = "postgresql://plpapp:<PLPAPP_PASSWORD>@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${var.pg_database_name}?sslmode=require"
}

# Redis is CLI-managed (see main.tf note). Hostname/key after provisioning:
#   az redisenterprise show -g classmode-rg --cluster-name classmode-redis --query hostName -o tsv
#   az redisenterprise database list-keys -g classmode-rg --cluster-name classmode-redis --database-name default
# REDIS_URL = rediss://:<ACCESS_KEY>@<hostName>:10000

output "github_actions_client_id" {
  description = "AZURE_CLIENT_ID GitHub secret for azure/login"
  value       = azurerm_user_assigned_identity.github_actions.client_id
}

output "tenant_id" {
  description = "AZURE_TENANT_ID GitHub secret"
  value       = data.azurerm_client_config.current.tenant_id
}

output "subscription_id" {
  description = "AZURE_SUBSCRIPTION_ID GitHub secret"
  value       = data.azurerm_client_config.current.subscription_id
}

output "log_analytics_workspace_id" {
  value = azurerm_log_analytics_workspace.main.workspace_id
}

# ── ClassMode Studio ─────────────────────────────────────────────────────────

output "studio_internal_fqdn" {
  description = <<-DESC
    Studio's INTERNAL hostname, reachable only from inside classmode-env.
    This is the value for Class-mode's CLASSMODE_AI_BASE_URL — prefix it with
    https:// . There is no public route to Studio by design; see studio.tf.
  DESC
  value       = azurerm_container_app.studio.ingress[0].fqdn
}

output "studio_database_name" {
  description = "Studio's database on the shared Postgres flexible server."
  value       = azurerm_postgresql_flexible_server_database.studio.name
}
