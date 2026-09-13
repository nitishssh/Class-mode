# terraform-azure

Infrastructure for `classmode-app` (and, once applied, `classmode-studio`) in the
`classmode-rg` resource group. State lives in Azure Storage — see `backend.tf`.

## Provider version is pinned to 4.x deliberately

Do not raise it, and do not merge a bot PR that does. The full reasoning is in
`backend.tf`, but the short version: the live state was written by azurerm 4.x,
5.0 removed attributes that state still carries, and **a 5.x provider responds to
state it cannot decode with an empty plan rather than an error**. The failure is
silent. #411 raised the constraint to `~> 5.1` on 2026-08-19 without anyone
running terraform, and every plan in this directory returned empty from then until
the pin was restored.

`.github/dependabot.yml` now ignores major updates for `hashicorp/azurerm`. Minor
and patch bumps still come through.

Moving to 5.x is its own change: 5.0 reworks the storage resources
(`queue_properties` splits out of `azurerm_storage_account`), so it needs a
migration plan reviewed against this state.

## Running it

Two variables have no default and change what a plan does. Set both, or the plan
will lie to you:

```bash
export TF_VAR_ghcr_token=...        # fine-grained GitHub PAT, read:packages
export TF_VAR_admin_client_ip=...   # your workstation IP
terraform init
terraform plan
```

**`admin_client_ip` is the trap.** `azurerm_postgresql_flexible_server_firewall_rule.admin_workstation`
is `count = var.admin_client_ip == "" ? 0 : 1`. Plan without it and terraform
proposes destroying the rule that allows your workstation through the Postgres
firewall — it looks like a real intended change and it is not. It is just the
variable being unset.

`ghcr_token` is only read by the container apps' `secret` blocks, which carry
`ignore_changes`, so a placeholder is safe for reading a plan but never for an
apply.

## Secrets are not managed here

`CLASSMODE_AI_SERVICE_SECRET`, `DATABASE_URL` and the model-provider keys are set
after apply with `az containerapp secret set` and wired as secretrefs. The
container apps declare `lifecycle { ignore_changes = [secret, ...] }` so terraform
does not fight that.

## GitHub OIDC

CI authenticates to Azure with a federated credential — no static keys. GitHub
embeds the repository owner in the OIDC subject it issues, so **transferring the
repository breaks deploys**: the presented subject changes and Azure's credential
still names the old owner, failing with `AADSTS700213`. That happened when the
repo moved from `NitishKumar-ai` to `nitishssh`.

`var.github_repo` uses the immutable `owner@ownerId/repo@repoId` form for this
reason. To inspect or correct the credentials without terraform:

```bash
az identity federated-credential list \
  --identity-name github-actions-deployer -g classmode-rg \
  --query "[].{name:name,subject:subject}" -o tsv
```
