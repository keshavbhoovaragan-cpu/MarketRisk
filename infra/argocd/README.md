# ArgoCD GitOps setup

This directory contains the ArgoCD root Application bootstrap. The app-of-apps manifests currently live in this application repository for the learning setup; they can move to a dedicated infra repository later.

## Root application

The file `app-of-apps/root-app.yaml` points at `infra/gitops/apps` in the MarketRisk repository. ArgoCD discovers the child Applications from that directory.

## Intended structure

```text
infra/
  argocd/
    app-of-apps/
      root-app.yaml
  gitops/
    apps/
      market-risk-dev.yaml
      market-risk-prod.yaml
  k8s/
    base/
    dev/
    prod/
```

The root app recurses into `infra/gitops/apps`, where child Applications manage:

- cluster bootstrap and namespaces
- MinIO / Postgres / shared platform services
- the frontend and backend apps
- the SparkOperator job and any scheduled batch workloads

This keeps the deployment order explicit and lets ArgoCD self-heal drift back to Git.

The production child Application has automated sync disabled. Its overlay is only a reviewable promotion template: GHCR tags must be replaced with a verified immutable SHA, the pull secret must be provisioned securely, and the API must be migrated from SQLite before anyone manually syncs it.
