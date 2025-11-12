# Docker Hub Migration Guide

## Overview

The `hydra-headless-ts` Docker image has been migrated from **AWS ECR** to **Docker Hub** for easier accessibility and distribution.

## Migration Details

### Previous Image Location (ECR)

```ascii
668874212870.dkr.ecr.us-east-1.amazonaws.com/drone-hydra-headless-ts:latest
```

**Limitations:**

- Requires AWS CLI authentication
- Requires ECR permissions
- Region-specific (us-east-1)
- Not publicly accessible

### New Image Location (Docker Hub)

```ascii
jeffdyke/hydra-headless-ts:latest
```

**Benefits:**

- ✅ Publicly accessible (no authentication required for pulls)
- ✅ Platform-agnostic
- ✅ Faster pulls (Docker Hub CDN)
- ✅ Easier to share with team/community
- ✅ Version tracking via Docker Hub UI

## Migration Process

### One-Time Migration

Use the provided migration script to copy the latest image from ECR to Docker Hub:

```bash
# Run the migration script
./scripts/migrate-to-dockerhub.sh

# Or specify a specific tag
./scripts/migrate-to-dockerhub.sh v1.0.0
```

The script will:

1. ✅ Authenticate with AWS ECR
2. ✅ Pull the latest image from ECR
3. ✅ Tag the image for Docker Hub
4. ✅ Authenticate with Docker Hub
5. ✅ Push the image to Docker Hub
6. ✅ Verify the migration

### Manual Migration (Alternative)

If you prefer to migrate manually:

```bash
# 1. Login to AWS ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  668874212870.dkr.ecr.us-east-1.amazonaws.com

# 2. Pull from ECR
docker pull 668874212870.dkr.ecr.us-east-1.amazonaws.com/drone-hydra-headless-ts:latest

# 3. Tag for Docker Hub
docker tag \
  668874212870.dkr.ecr.us-east-1.amazonaws.com/drone-hydra-headless-ts:latest \
  jeffdyke/hydra-headless-ts:latest

# 4. Login to Docker Hub
docker login
# Username: jeffdyke
# Password: <your-docker-hub-password>

# 5. Push to Docker Hub
docker push jeffdyke/hydra-headless-ts:latest
```

## Using the Docker Hub Image

### With docker-compose.yml

The `docker-compose.yml` has been updated to use the Docker Hub image:

```yaml
services:
  headless-ts:
    image: jeffdyke/hydra-headless-ts:latest
    # ... rest of configuration
```

To use it:

```bash
# Pull the latest image
docker-compose pull headless-ts

# Start services
docker-compose up -d

# Or rebuild and start
docker-compose up -d --build
```

### Standalone Docker Run

```bash
# Pull the image
docker pull jeffdyke/hydra-headless-ts:latest

# Run the container
docker run -d \
  --name hydra-headless-ts \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e BASE_URL=https://auth.example.com \
  -e HYDRA_PUBLIC_URL=https://auth.example.com \
  -e GOOGLE_CLIENT_ID=your-client-id \
  -e GOOGLE_CLIENT_SECRET=your-client-secret \
  jeffdyke/hydra-headless-ts:latest
```

## Building and Pushing New Versions

### Build Locally

```bash
# Build the image
docker build -f build/Dockerfile.headless-ts -t jeffdyke/hydra-headless-ts:latest .

# Tag with version
docker tag jeffdyke/hydra-headless-ts:latest jeffdyke/hydra-headless-ts:v1.0.0

# Push to Docker Hub
  docker push jeffdyke/hydra-headless-ts:latest
docker push jeffdyke/hydra-headless-ts:v1.0.0
```

### CI/CD Pipeline (Recommended)

Update your CI/CD pipeline to push directly to Docker Hub instead of ECR:

```yaml
# Example GitHub Actions
- name: Build and push Docker image
  uses: docker/build-push-action@v5
  with:
    context: .
    file: build/Dockerfile.headless-ts
    push: true
    tags: |
      jeffdyke/hydra-headless-ts:latest
      jeffdyke/hydra-headless-ts:${{ github.sha }}
```

## Version Tagging Strategy

### Recommended Tags

1. **latest** - Always points to the most recent stable build

   ```ascii
   jeffdyke/hydra-headless-ts:latest
   ```

2. **Semantic Version** - Specific release versions

  ```ascii
   jeffdyke/hydra-headless-ts:v1.0.0
   jeffdyke/hydra-headless-ts:v1.0.1
   ```

3. **Git SHA** - Specific commit references

```ascii
  jeffdyke/hydra-headless-ts:9077c27
``

4. **Environment-specific** - For different deployment stages
   ```
   jeffdyke/hydra-headless-ts:staging
   jeffdyke/hydra-headless-ts:production
   ```

### Tagging Best Practices

```bash
# Tag and push multiple versions
docker tag jeffdyke/hydra-headless-ts:latest jeffdyke/hydra-headless-ts:v1.0.0
docker tag jeffdyke/hydra-headless-ts:latest jeffdyke/hydra-headless-ts:$(git rev-parse --short HEAD)

docker push jeffdyke/hydra-headless-ts:latest
docker push jeffdyke/hydra-headless-ts:v1.0.0
docker push jeffdyke/hydra-headless-ts:$(git rev-parse --short HEAD)
```

## Security Considerations

### Docker Hub Repository Settings

1. **Make Repository Public** (for open-source projects)
   - Navigate to: https://hub.docker.com/r/jeffdyke/hydra-headless-ts/settings
   - Set visibility to "Public"

2. **Or Keep Private** (for proprietary code)
   - Keep visibility as "Private"
   - Team members need Docker Hub account to pull

### Authentication for Private Repositories

If the repository is private, users need to authenticate:

```bash
# Login to Docker Hub
docker login

# Pull private image
docker pull jeffdyke/hydra-headless-ts:latest
```

In docker-compose.yml:

```bash
# Login before docker-compose
docker login

# Then start services
docker-compose up -d
```

## Dockerfile Location

The Dockerfile used to build this image:

```ascii
build/Dockerfile.headless-ts
```

See the Dockerfile for build details and dependencies.

## Image Contents

The Docker image includes:

- **Node.js Application**: OAuth2 headless login/consent provider
- **Effect-ts Runtime**: Functional effects framework
- **Dependencies**: All production npm packages
- **Configuration**: Environment-based config support
- **Healthcheck**: Built-in health monitoring

### Environment Variables

Required environment variables (set via `env_file` or `-e` flags):

```bash
# Application
BASE_URL=https://auth.example.com
APP_ENV=production
PORT=3000

# Hydra OAuth2 Server
HYDRA_PUBLIC_URL=https://auth.example.com
HYDRA_ADMIN_HOST=hydra
HYDRA_ADMIN_PORT=4445

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://auth.example.com/callback

# Database
DSN=postgres://hydra:password@postgres:5432/hydra
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Security
SESSION_SECRET=your-session-secret
COOKIE_SECRET=your-cookie-secret
```

## Troubleshooting

### Image Pull Fails

**Problem**: `Error response from daemon: pull access denied`

**Solution**:

1. For public repository: No authentication needed, check image name spelling
2. For private repository: Login first with `docker login`

### Wrong Architecture

**Problem**: `WARNING: The requested image's platform (linux/amd64) does not match`

**Solution**: Build multi-platform images

```bash
# Enable buildx
docker buildx create --use

# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t jeffdyke/hydra-headless-ts:latest \
  -f build/Dockerfile.headless-ts \
  --push .
```

### Image Size Too Large

**Problem**: Image size is very large (>1GB)

**Solution**: Optimize Dockerfile with multi-stage build (already implemented in `build/Dockerfile.headless-ts`)

## Monitoring and Maintenance

### Check Image Size

```bash
docker images jeffdyke/hydra-headless-ts
```

### View Image History

```bash
docker history jeffdyke/hydra-headless-ts:latest
```

### Inspect Image Details

```bash
docker inspect jeffdyke/hydra-headless-ts:latest
```

### Clean Up Old Images

```bash
# Remove old ECR image locally
docker rmi 668874212870.dkr.ecr.us-east-1.amazonaws.com/drone-hydra-headless-ts:latest

# Remove unused images
docker image prune -a
```

## Migration Checklist

- [x] Run migration script to copy image from ECR to Docker Hub
- [x] Update docker-compose.yml to use Docker Hub image
- [x] Test pulling and running the new image
- [ ] Update CI/CD pipeline to push to Docker Hub
- [ ] Update deployment documentation
- [ ] Notify team of new image location
- [ ] (Optional) Deprecate ECR repository

## Resources

- **Docker Hub Repository**: https://hub.docker.com/r/jeffdyke/hydra-headless-ts
- **Docker Hub Documentation**: https://docs.docker.com/docker-hub/
- **Dockerfile**: [build/Dockerfile.headless-ts](../build/Dockerfile.headless-ts)
- **OAuth2 Architecture**: [OAUTH2_ARCHITECTURE.md](../OAUTH2_ARCHITECTURE.md)

## Support

For issues with the Docker image:

1. Check image logs: `docker logs <container-name>`
2. Verify environment variables are set correctly
3. Check Docker Hub for latest version
4. Review Dockerfile for build configuration
