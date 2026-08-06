#!/usr/bin/env python3
import json
import subprocess

# For MOCK integrations, use single-quoted static values
# AWS API Gateway will strip the outer quotes before sending
response_params = {
    "method.response.header.Access-Control-Allow-Origin": "'*'",
    "method.response.header.Access-Control-Allow-Headers": "'Content-Type,Authorization'",
    "method.response.header.Access-Control-Allow-Methods": "'POST,OPTIONS'"
}

endpoints = {
    "31o1ix": "/batch/products",
    "4atrjj": "/batch/vendors",
    "8iak29": "/batch/manufacturers",
    "r4zpak": "/batch/lineitem-options"
}

api_id = "6extgb87v1"
region = "us-east-1"
profile = "megapros-prod"

for resource_id, path in endpoints.items():
    print(f"Updating {path}...")
    
    cmd = [
        "aws", "apigateway", "put-integration-response",
        "--rest-api-id", api_id,
        "--resource-id", resource_id,
        "--http-method", "OPTIONS",
        "--status-code", "200",
        "--response-templates", '{"application/json":""}',
        "--response-parameters", json.dumps(response_params),
        "--region", region,
        "--profile", profile
    ]
    
    subprocess.run(cmd, capture_output=True, check=True)
    print(f"  ✓ Updated")

# Deploy
print("\nDeploying...")
cmd = ["aws", "apigateway", "create-deployment", "--rest-api-id", api_id, "--stage-name", "prod", "--region", region, "--profile", profile, "--query", "id", "--output", "text"]
result = subprocess.run(cmd, capture_output=True, text=True, check=True)
print(f"✓ Deployment {result.stdout.strip()}")
