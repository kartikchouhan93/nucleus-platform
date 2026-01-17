
AWS_PROFILE=STX-CLOUD-PLATFORM-ADMIN aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws

export BUILDX_NO_DEFAULT_ATTESTATIONS=1


AWS_PROFILE=STX-CLOUD-PLATFORM-ADMIN  npx cdk deploy --all --require-approval never


kill -9 $(lsof -t -i:3000 -sTCP:LISTEN)
