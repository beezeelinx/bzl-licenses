# Pull base image.
FROM debian:buster-slim AS base

WORKDIR /opt/beezeelinx

ARG DEBIAN_FRONTEND=noninteractive

RUN echo "deb http://deb.debian.org/debian buster-backports main" > /etc/apt/sources.list.d/buster-backports.list

RUN \
    apt-get -qq update && \
    apt-get install -yq --no-install-recommends software-properties-common

RUN \
    apt-get -qq update && \
    apt-get install -yq --no-install-recommends curl gnupg

RUN \
    apt-get -qq update && \
    apt-get install -yq --no-install-recommends git gcc make g++ python2.7 python2.7-dev libssl-dev wget

RUN \
    apt-get -qq update && \
    apt-get install -yq --no-install-recommends -t buster-backports golang build-essential pkg-config bzip2 xz-utils debian-keyring patch dpkg-dev fakeroot ed

RUN curl -sS https://dl.google.com/go/go1.17.11.linux-amd64.tar.gz -o go1.17.11.linux-amd64.tar.gz && \
    mkdir -p /usr/lib/go-1.17 && \
    tar -C /usr/lib/go-1.17 -xzf go1.17.11.linux-amd64.tar.gz && \
    mv /usr/lib/go-1.17/go/* /usr/lib/go-1.17 && \
    rm -rf /usr/lib/go-1.17/go go1.17.11.linux-amd64.tar.gz
RUN rm -rf /usr/bin/go /usr/lib/go /usr/bin/gofmt && \
    ln -sfn /usr/lib/go-1.17/bin/go /usr/bin/go && \
    ln -sfn /usr/lib/go-1.17 /usr/lib/go && \
    ln -sfn /usr/lib/go-1.17/bin/gofmt /usr/bin/gofmt

# Install latest node 14.x without dev dependencies

RUN curl -L https://raw.githubusercontent.com/tj/n/master/bin/n -o n
RUN bash n 14
RUN rm -f n

# Create ubuntu user

RUN adduser --disabled-password --gecos '' beezeelinx && adduser beezeelinx sudo && echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers
RUN chown beezeelinx $PWD
RUN rm /bin/sh && ln -sf /bin/bash /bin/sh

################################################

FROM base AS builder

WORKDIR /opt/beezeelinx

# Update npm

RUN npm i -g npm@6

# Starting from now, run everything as beezeelinx user

USER beezeelinx

RUN mkdir -p bzl-licenses-checker
COPY --chown=beezeelinx:beezeelinx package*.json bzl-licenses-checker/
RUN cd bzl-licenses-checker && npm install

# COPY GIT repos locally

COPY --chown=beezeelinx:beezeelinx ./ bzl-licenses-checker/

RUN rm -rf bzl-licenses-checker/.git*

# Build license detector

RUN git clone https://github.com/go-enry/go-license-detector.git
RUN cd go-license-detector/cmd/license-detector && go build

FROM base
LABEL maintainer="BeeZeeLinx"
LABEL description="BeeZeeLinx Licenses Checker"

COPY --from=builder /opt/beezeelinx/go-license-detector/cmd/license-detector/license-detector /usr/bin/

WORKDIR /opt/beezeelinx/bzl-licenses-checker
USER beezeelinx

STOPSIGNAL SIGKILL

COPY --chown=beezeelinx:beezeelinx --from=builder /opt/beezeelinx/bzl-licenses-checker/ /opt/beezeelinx/bzl-licenses-checker/

ENV GITURL=""
ENV GOPRIVATE github.com/beezeelinx
ENTRYPOINT [ "/opt/beezeelinx/bzl-licenses-checker/start.sh" ]
