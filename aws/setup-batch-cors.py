#!/usr/bin/env python3
import json
import subprocess

# Configure all batch endpoints with OPTIONS integration responses
endpoints = {
    "31o1ix": "/batch/products",
    "4atrjj": "/batch/vendors",
    "8iak29": "/batch/manufacturers",
    "r4zpak": "/batch/lineitem-options"
}

api_id = "6extgb87v1"
region = "us-east-1"
profile = "megapros-prod"

# CORS response parameters - values must be quoted strings
response_params = {
    "method.response.header.Access-Control-Allow-Headers": "'Content-Type,Authorization'",
    "method.response.header.Access-Control-Allow-Methods": "'POST,OPTIONS'",
    "method.response.header.Access-Control-Allow-Origin": "'*'"
}

for resource_id, path in endpoints.items():
    print(f"\nConfiguring OPTIONS for {path} (ID: {resource_id})...")
    
    # Put integration response with proper JSON formatting
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
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(f"  ✓ Success")
    except subprocess.CalledProcessError as e:
        print(f"  ✗ Error: {e.stderr}")

print("\n--- Creating deployment ---")
cmd = [
    "aws", "apigateway", "create-deployment",
    "--rest-api-id", api_id,
    "--stage-name", "prod",
    "--region", region,
    "--profile", profile,
    "--query", "id",
    "--output", "text"
]
result = subprocess.run(cmd, capture_output=True, text=True, check=True)
deployment_id = result.stdout.strip()
print(f"✓ Deployment created: {deployment_id}")
