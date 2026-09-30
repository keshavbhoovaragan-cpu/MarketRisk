# ArgoCD GitOps setup

This directory contains the bootstrapping resources for the GitOps layer of the MarketRisk project.

## Root application

The file `app-of-apps/root-app.yaml` is the ArgoCD Application resource that points at the infra repository's app-of-apps tree. In a real setup, the `repoURL` should point to a dedicated infrastructure repo such as `https://github.com/<user>/marketrisk-infra.git`.

## Intended structure

```text
infra/
  argocd/
    app-of-apps/
      root-app.yaml
    manifests/
      market-risk-dev.yaml
```

The root app should recurse into an `apps/` directory in the infra repo, where separate child Applications manage:

- cluster bootstrap and namespaces
- MinIO / Postgres / shared platform services
- the frontend and backend apps
- the SparkOperator job and any scheduled batch workloads

This keeps the deployment order explicit and lets ArgoCD self-heal drift back to Git.
