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

# Install latest node 10.x without dev dependencies

RUN curl -L https://raw.githubusercontent.com/tj/n/master/bin/n -o n
RUN bash n 10
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

# steps below will always be executed if `CACHE_DATE` is changed to a unique value
ARG CACHE_DATE=2016-01-01
ARG GITURL=""

# Build license detector

RUN git clone https://github.com/go-enry/go-license-detector.git
RUN cd go-license-detector/cmd/license-detector && go build

RUN if [ "$GITURL" != "" ]; then echo -e "[url \"${GITURL%/}\"]\r\n    insteadOf = ssh://git@github.com/beezeelinx\r\n[url \"${GITURL%/}\"]\r\n    insteadOf = https://github.com/beezeelinx\n" > /home/beezeelinx/.gitconfig; fi

RUN mkdir -p bzl-licenses-checker
COPY --chown=beezeelinx:beezeelinx package*.json bzl-licenses-checker/
RUN cd bzl-licenses-checker && npm install

# COPY GIT repos locally

COPY --chown=beezeelinx:beezeelinx ./ bzl-licenses-checker/

RUN rm -rf bzl-licenses-checker/.git*

FROM base
LABEL maintainer="BeeZeeLinx"
LABEL description="BeeZeeLinx Licenses Checker"

COPY --from=builder /opt/beezeelinx/go-license-detector/cmd/license-detector/license-detector /usr/bin/

WORKDIR /opt/beezeelinx/bzl-licenses-checker
USER beezeelinx

STOPSIGNAL SIGKILL

COPY --chown=beezeelinx:beezeelinx --from=builder /opt/beezeelinx/bzl-licenses-checker/ /opt/beezeelinx/bzl-licenses-checker/

ARG GITURL=""
RUN if [ "$GITURL" != "" ]; then echo -e "[url \"${GITURL%/}\"]\r\n    insteadOf = ssh://git@github.com/beezeelinx\r\n[url \"${GITURL%/}\"]\r\n    insteadOf = https://github.com/beezeelinx\n" > /home/beezeelinx/.gitconfig; fi
