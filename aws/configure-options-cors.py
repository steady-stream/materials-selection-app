#!/usr/bin/env python3
"""
Configure OPTIONS CORS responses for batch endpoints.
Use response templates with Velocity Template Language to inject headers.
"""
import json
import subprocess

endpoints = {
    "31o1ix": "/batch/products",
    "4atrjj": "/batch/vendors",
    "8iak29": "/batch/manufacturers",
    "r4zpak": "/batch/lineitem-options"
}

api_id = "6extgb87v1"
region = "us-east-1"
profile = "megapros-prod"

# For OPTIONS MOCK integration, use a response template that returns the headers
# This is a workaround for the response-parameters quoting issue
response_template = json.dumps({
    "application/json": '#set($headers = $input.params().header)\n#set($methods = "POST,OPTIONS")\n#set($headers_map = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type,Authorization", "Access-Control-Allow-Methods": $methods})\n{}'
})

for resource_id, path in endpoints.items():
    print(f"Configuring {path}...")
    
    cmd = [
        "aws", "apigateway", "put-integration-response",
        "--rest-api-id", api_id,
        "--resource-id", resource_id,
        "--http-method", "OPTIONS",
        "--status-code", "200",
        "--response-templates", '{"application/json":""}',
        # Use single quotes for literal values (AWS format for static values in MOCK)
        "--response-parameters", json.dumps({
            "method.response.header.Access-Control-Allow-Origin": "'*'",
            "method.response.header.Access-Control-Allow-Headers": "'Content-Type,Authorization'",
            "method.response.header.Access-Control-Allow-Methods": "'POST,OPTIONS'"
        }, separators=(',', ':')),
        "--region", region,
        "--profile", profile
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if result.returncode == 0:
            print(f"  ✓ Success")
        else:
            print(f"  ✗ Error: {result.stderr}")
    except Exception as e:
        print(f"  ✗ Exception: {e}")

print("\n--- Deploying ---")
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
print(f"Deployment: {result.stdout.strip()}")

# Verify
print("\n--- Verifying ---")
cmd = [
    "aws", "apigateway", "get-integration-response",
    "--rest-api-id", api_id,
    "--resource-id", "31o1ix",
    "--http-method", "OPTIONS",
    "--status-code", "200",
    "--region", region,
    "--profile", profile
]
result = subprocess.run(cmd, capture_output=True, text=True, check=True)
data = json.loads(result.stdout)
print("Response parameters:")
print(json.dumps(data.get("responseParameters", {}), indent=2))
