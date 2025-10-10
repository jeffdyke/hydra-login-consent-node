#!/usr/bin/env bash
sudo bash build.sh clean && \
  aws ecr get-login-password | sudo docker login --username AWS --password-stdin https://668874212870.dkr.ecr.us-east-1.amazonaws.com && \
  sudo docker system prune -a -f && \
  sudo bash build.sh build hydra-consent-node && \
  sudo bash build.sh push hydra-consent-node
