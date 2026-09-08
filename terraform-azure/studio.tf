# ClassMode Studio — the AI lesson-generation service.
#
# Deployed as a SECOND container app in the existing classmode-env rather than
# its own environment: the environment is the expensive part and it already
# exists, both apps want the same region as classmode-pg, and app-to-app calls
# inside one environment never leave it.
#
# INGRESS IS INTERNAL, ON PURPOSE. Studio's v1 API is called only by
# Class-mode's SERVER (server/services/study-arena-client.ts), never by a
# browser or the mobile app, and it is authenticated with a shared service
# secret. .env.example states the rule plainly: "ClassMode AI is called only by
# this backend. Never expose the secret through Vite variables or ship it to
# web/mobile clients." Internal ingress makes that structural instead of a
# convention — there is no public route to reach, so a leaked secret is not
# enough to call it from outside.
#
# Class-mode reaches it at the FQDN in outputs.tf, wired as CLASSMODE_AI_BASE_URL.

# Studio's own database on the EXISTING flexible server. A second database, not
# a second server: same cost envelope, same backup policy, same firewall rules.
# Studio only needs this once document persistence or the agent runtime is on —
# lib/server/config-validation.ts:164 treats a missing DATABASE_URL as a
# configuration error only when CLASSMODE_AGENT_RUNTIME_ENABLED is set, so the
# app boots without it and degrades rather than crashing.
resource "azurerm_postgresql_flexible_server_database" "studio" {
  name      = var.studio_database_name
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

resource "azurerm_container_app" "studio" {
  name                         = var.studio_app_name
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"

  # Same GHCR credentials as the main app — one registry, one PAT.
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
    # Internal only. See the header comment — this is a security boundary, not
    # a default. Flipping this to true publishes the generation API.
    external_enabled = false
    target_port      = var.studio_container_port
    transport        = "auto"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    # min 1: a cold start in the middle of lesson generation is a teacher
    # watching a spinner, and Next.js standalone is not a fast boot.
    min_replicas = var.studio_min_replicas
    max_replicas = var.studio_max_replicas

    container {
      name = "studio"
      # Day-to-day deploys are CI's (az containerapp update); see the lifecycle
      # block. This value only matters for the very first apply.
      image = var.studio_container_image

      # Deliberately larger than classmode-app's 0.5/1Gi. Studio is a heavier
      # Next.js app and generation is CPU-bound; the API's own routes declare a
      # 300s maxDuration, which is not work that fits in half a core.
      cpu    = 1.0
      memory = "2Gi"

      # Non-secret env only. Secrets — CLASSMODE_AI_SERVICE_SECRET, DATABASE_URL,
      # and whichever model-provider key is chosen — are set post-apply with
      # `az containerapp secret set` and wired as secretrefs, exactly as
      # classmode-app does, so no value ever lands in Terraform state.
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "PORT"
        value = tostring(var.studio_container_port)
      }
      # next.config.ts:4 is `output: process.env.VERCEL ? undefined : 'standalone'`.
      # VERCEL must stay UNSET here or the image loses its standalone server.js
      # and the container has nothing to run.

      # /api/health is unauthenticated and touches no database, so it answers
      # before DATABASE_URL or any provider key is configured. That matters:
      # the probes must pass on the very first revision, before the post-apply
      # secret wiring has happened, or the app never goes healthy and there is
      # nothing to attach secrets to.
      liveness_probe {
        transport = "HTTP"
        path      = "/api/health"
        port      = var.studio_container_port
      }

      readiness_probe {
        transport = "HTTP"
        path      = "/api/health"
        port      = var.studio_container_port
      }
    }
  }

  lifecycle {
    # Same split of ownership as classmode-app: CI owns the image, the az CLI
    # owns secret values and the secretref env vars it wires. Terraform must not
    # revert either on the next apply.
    ignore_changes = [
      template[0].container[0].image,
      template[0].container[0].env,
      secret,
    ]
  }
}

# ── CI identity ───────────────────────────────────────────────────────────────
#
# Studio's deploy job (.github/workflows/cd.yml in the classmode-studio repo)
# runs `az containerapp update` against the app above. It reuses the SAME
# user-assigned identity as Class-mode's CI — `github_actions_contributor` is
# scoped to the whole resource group, so it already covers this container app,
# and a second identity would only mean a second set of secrets to rotate.
#
# What it cannot reuse is the subject. A federated credential matches one exact
# `sub`, and Studio is a different repository, so its token is rejected by the
# two credentials in main.tf no matter how the identity is shared.
#
# One credential, not two: the deploy job declares `environment: production`, and
# Actions issues the environment-scoped subject for those jobs — the branch-scoped
# form is never presented from that repo.
resource "azurerm_federated_identity_credential" "studio_github_prod_env" {
  name                      = "github-studio-production-environment"
  user_assigned_identity_id = azurerm_user_assigned_identity.github_actions.id
  audience                  = ["api://AzureADTokenExchange"]
  issuer                    = "https://token.actions.githubusercontent.com"
  subject                   = "repo:${var.studio_github_repo}:environment:production"
}
