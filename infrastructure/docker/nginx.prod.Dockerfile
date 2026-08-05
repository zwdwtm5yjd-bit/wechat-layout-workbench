# syntax=docker/dockerfile:1.7

ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.29.5-alpine@sha256:42a7d7f2ee23e9f5a1dcdf3647ba5c585bbd18f79e79cd817e70e8cd61c55779

FROM ${NGINX_IMAGE}

USER root

RUN install -d -o 101 -g 101 /etc/nginx/tls

COPY --chown=101:101 infrastructure/nginx/app.conf.template /etc/nginx/templates/default.conf.template

USER 101:101
