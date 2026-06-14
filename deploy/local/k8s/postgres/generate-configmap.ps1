kubectl create configmap postgres-init-scripts `
  --from-file=../../../../db/postgres/init `
  -n restaurantes `
  --dry-run=client -o yaml | kubectl apply -f -