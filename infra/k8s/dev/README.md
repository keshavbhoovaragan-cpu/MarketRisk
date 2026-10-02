# k3d development cluster

Create the cluster and import the images built in Phase 2:

```bash
k3d cluster create marketrisk-dev --servers 1 --agents 1 --port '8080:80@loadbalancer' --port '8443:443@loadbalancer' --wait
k3d image import marketrisk-api:latest marketrisk-frontend:latest marketrisk-spark-job:latest -c marketrisk-dev
helm repo add spark-operator https://kubeflow.github.io/spark-operator
helm repo update spark-operator
helm upgrade --install spark-operator spark-operator/spark-operator --namespace spark-operator --create-namespace --version 2.5.2 --wait
helm upgrade spark-operator spark-operator/spark-operator --namespace spark-operator --version 2.5.2 --reuse-values --set 'spark.jobNamespaces={default,market-risk}' --wait
kubectl apply -f infra/k8s/dev/namespace.yaml
export MINIO_ACCESS_KEY="$(openssl rand -hex 16)"
export MINIO_SECRET_KEY="$(openssl rand -hex 32)"
kubectl -n market-risk create secret generic minio-credentials --from-literal=access-key="$MINIO_ACCESS_KEY" --from-literal=secret-key="$MINIO_SECRET_KEY"
kubectl apply -k infra/k8s/dev
```

The app preserves its existing SQLite storage model, with the database mounted on a PVC. It is deliberately not silently migrated to PostgreSQL in this phase. MinIO stores raw prices, portfolio returns, and risk outputs as Parquet under the `market-risk` bucket. The Spark driver and executor receive credentials from the Kubernetes Secret; no secret value belongs in manifests or Git. The MinIO API is internal to the namespace at `http://minio:9000`; its console is available via port-forward on 9001.

Use port forwards in separate terminals:

```bash
kubectl -n market-risk port-forward svc/frontend 3002:3002
kubectl -n market-risk port-forward svc/api 8002:8002
kubectl -n market-risk port-forward svc/minio 9001:9001
```

Check the application and job:

```bash
kubectl -n market-risk get deploy,pods,pvc,jobs,sparkapplications,scheduledsparkapplications
kubectl -n market-risk logs sparkapplication/risk-batch-manual -f
```

The nightly schedule is set to 02:00 UTC and can be paused while experimenting:

```bash
kubectl -n market-risk patch scheduledsparkapplication risk-batch-nightly --type merge -p '{"spec":{"suspend":true}}'
```

Confirm the shared Parquet objects with MinIO's console or `mc`; use the locally generated values in `$MINIO_ACCESS_KEY` and `$MINIO_SECRET_KEY` when signing into the console. Final risk-result writes to PostgreSQL are still a later data-integration step; this phase proves distributed execution plus shared MinIO storage.

Cleanup the dev workload with `kubectl delete -k infra/k8s/dev`. Delete the cluster only when you intend to remove its local state: `k3d cluster delete marketrisk-dev`.
