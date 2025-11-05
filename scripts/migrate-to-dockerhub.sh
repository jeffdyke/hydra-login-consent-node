#!/bin/bash
set -e

# Migrate Docker image from AWS ECR to Docker Hub
# This script pulls the latest image from ECR and pushes it to Docker Hub

# Configuration
ECR_IMAGE="668874212870.dkr.ecr.us-east-1.amazonaws.com/drone-hydra-headless-ts"
DOCKERHUB_IMAGE="jeffdyke/hydra-headless-ts"
TAG="${1:-latest}"

echo "======================================"
echo "Docker Image Migration: ECR → Docker Hub"
echo "======================================"
echo "Source:      ${ECR_IMAGE}:${TAG}"
echo "Destination: ${DOCKERHUB_IMAGE}:${TAG}"
echo "======================================"
echo ""

# Step 1: Login to AWS ECR
echo "→ Step 1: Authenticating with AWS ECR..."
if ! aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 668874212870.dkr.ecr.us-east-1.amazonaws.com; then
    echo "✗ Error: Failed to authenticate with AWS ECR"
    echo "  Make sure you have AWS CLI configured with proper credentials"
    exit 1
fi
echo "✓ Successfully authenticated with AWS ECR"
echo ""

# Step 2: Pull image from ECR
echo "→ Step 2: Pulling image from ECR..."
if ! docker pull "${ECR_IMAGE}:${TAG}"; then
    echo "✗ Error: Failed to pull image from ECR"
    echo "  Make sure the image exists: ${ECR_IMAGE}:${TAG}"
    exit 1
fi
echo "✓ Successfully pulled image from ECR"
echo ""

# Step 3: Tag image for Docker Hub
echo "→ Step 3: Tagging image for Docker Hub..."
docker tag "${ECR_IMAGE}:${TAG}" "${DOCKERHUB_IMAGE}:${TAG}"
echo "✓ Successfully tagged image"
echo ""

# Step 4: Login to Docker Hub
echo "→ Step 4: Authenticating with Docker Hub..."
echo "  Please login to Docker Hub (username: jeffdyke)"
if ! docker login; then
    echo "✗ Error: Failed to authenticate with Docker Hub"
    exit 1
fi
echo "✓ Successfully authenticated with Docker Hub"
echo ""

# Step 5: Push image to Docker Hub
echo "→ Step 5: Pushing image to Docker Hub..."
if ! docker push "${DOCKERHUB_IMAGE}:${TAG}"; then
    echo "✗ Error: Failed to push image to Docker Hub"
    exit 1
fi
echo "✓ Successfully pushed image to Docker Hub"
echo ""

# Step 6: Verify image on Docker Hub
echo "→ Step 6: Verifying image on Docker Hub..."
echo "  Image URL: https://hub.docker.com/r/${DOCKERHUB_IMAGE}"
echo "  You can pull it with: docker pull ${DOCKERHUB_IMAGE}:${TAG}"
echo ""

echo "======================================"
echo "✓ Migration Complete!"
echo "======================================"
echo ""
echo "Summary:"
echo "  Source:      ${ECR_IMAGE}:${TAG}"
echo "  Destination: ${DOCKERHUB_IMAGE}:${TAG}"
echo "  Status:      Successfully migrated"
echo ""
echo "Next steps:"
echo "  1. Update docker-compose.yml to use: ${DOCKERHUB_IMAGE}:${TAG}"
echo "  2. Test the new image: docker-compose up -d"
echo "  3. Optionally remove ECR image to save storage"
echo ""
