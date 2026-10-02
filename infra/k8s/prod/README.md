# Production-shaped overlay

This overlay is a gated deployment template for reviewing environment-specific Kubernetes configuration. The ArgoCD `marketrisk-prod` Application is registered without automated sync, so merely adding it to Git does not launch workloads.

## What it contains

- The shared API and frontend workload definitions from `../base`.
- A separate `market-risk-prod` namespace.
- Two frontend replicas and GHCR pull-secret references.
- Explicit GHCR image tag placeholders that must be replaced with a verified immutable build SHA before any manual sync.

Dev-only MinIO, its PVC/bucket job, sample yfinance Spark jobs, and the dev Spark schedule are intentionally excluded.

## Production blockers

Do not sync this overlay as a production service yet. The API currently persists to SQLite on a single PVC, so it is not safe for HA scaling or a managed production database workflow. The application must first support PostgreSQL and have migration/backup procedures. The frontend/API images must be successfully published to GHCR, pinned to the same validated commit SHA, and `ghcr-pull-credentials` must be provisioned in `market-risk-prod` through a secret manager or another secure process. Production ingress/TLS, domain/DNS, monitoring, resource sizing, and storage policies also need environment-specific configuration.

The Spark job is intentionally absent: its current arguments use sample holdings/tickers and the Spark writer expects the current S3-compatible endpoint configuration. Add a production batch application only after real portfolio input, object-store endpoint/region, credential handling, output retention, and PostgreSQL result ingestion are designed and tested.

## Render and review

```bash
kubectl kustomize infra/k8s/prod
```

Before manually syncing the ArgoCD app, replace both `REPLACE_WITH_VERIFIED_SHA` image tags with a published build SHA and verify every prerequisite above. Never commit registry credentials or database passwords to this repository.
