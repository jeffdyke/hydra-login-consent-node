#!/usr/bin/env bash
set -xe
if [ "$1" = "force" ]; then
  sudo docker stop hydra-headless-ts-1
  sudo docker system prune -a -f
fi
docker build -f Dockerfile.headless-ts -t jeffdyke/hydra-headless-ts:latest .
docker push jeffdyke/hydra-headless-ts:latest
sudo docker compose up -d --force-recreate headless-ts
