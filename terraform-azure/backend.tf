terraform {
  required_version = ">= 1.5"

  required_providers {
    # PINNED TO 4.x ON PURPOSE. Do not let a dependency bot raise this.
    #
    # The live state was written by azurerm 4.x, and 5.0 removed attributes that
    # state still carries, so a 5.x provider cannot decode it. Five resources
    # fail with "unsupported attribute": container_app's
    # termination_grace_period_seconds, storage_account's queue_properties,
    # storage_share's resource_manager_id, log_analytics_workspace's
    # internet_ingestion_enabled, application_insights's
    # daily_data_cap_notifications_disabled. (`terraform state show` fails the
    # same way on federated_identity_credential's parent_id.)
    #
    # What makes this dangerous rather than merely broken: under 5.x
    # `terraform plan` does NOT error on an undecodable resource. It emits a
    # warning and then prints an EMPTY plan. That reads as "no changes" when it
    # actually means "could not read state" — so the drift hides itself, and an
    # operator can conclude the infrastructure is up to date when terraform
    # never managed to look at it.
    #
    # How it got here: #411 (3edfeda, 2026-08-19) was a dependency-bot bump from
    # ~> 4.0 to ~> 5.1 that was merged without anyone running terraform. A major
    # provider bump is a state migration, not a dependency update. Between that
    # merge and this pin, every plan in this directory silently returned empty.
    #
    # Moving to 5.x is real work and belongs in its own change: 5.0 reworks the
    # storage resources (queue_properties splits out of azurerm_storage_account),
    # so it needs a migration plan reviewed against this state, not a version
    # bump. Until then 4.x is what owns the infrastructure, so 4.x is what this
    # file declares.
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # State lives in Azure Storage (bootstrapped once via az CLI — see README).
  backend "azurerm" {
    resource_group_name  = "classmode-rg"
    storage_account_name = "classmodetfstate"
    container_name       = "tfstate"
    key                  = "prod.tfstate"
    use_azuread_auth     = true
  }
}

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = true
    }
  }
}
