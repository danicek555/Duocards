#!/bin/bash

# Cloud SQL Proxy Startup Script
# This script starts Cloud SQL Proxy to connect to your Cloud SQL instance

CONNECTION_NAME="duocards-478723:us-central1:duocards"
PROXY_PORT=5433

echo "🚀 Starting Cloud SQL Proxy..."
echo "Connection: $CONNECTION_NAME"
echo "Local port: $PROXY_PORT"
echo ""
echo "Press Ctrl+C to stop the proxy"
echo ""

# Start Cloud SQL Proxy
cloud-sql-proxy "$CONNECTION_NAME" --port=$PROXY_PORT
