#!/bin/bash

image=bzl-licenses-checker
usage="$(basename "$0") [-tag <tag name>] [-prefix <tag prefix>] [-giturl <git url>]"
script_path=$(dirname "$0")

while [ $# -ne 0 ]; do
    case $1 in
        -giturl)
            shift
            GITURL=$1
            ;;
        -tag)
            shift
            tag=$1
            ;;
        -prefix)
            shift
            prefix=$1
            ;;
        *)
            echo "$usage"
            exit 1
            ;;
    esac
    shift
done

if [ -f "$script_path/docker/Dockerfile" ]; then
    dockerfile=docker/Dockerfile
elif [ -f "$script_path/Dockerfile" ]; then
    dockerfile=Dockerfile
else
    echo "Unable to find Dockerfile."
    exit 1
fi

if [ "$tag" = "" ]; then
    tag="latest"
fi

# shellcheck disable=SC2086
eval docker build -f $script_path/${dockerfile} --pull --force-rm=true -t $image $script_path || exit 1

if [ "$prefix" != "" ]; then
    docker tag ${image} "${prefix}"/${image}:${tag} || exit 1
elif [ "$tag" != "latest" ]; then
    docker tag $image ${image}:${tag} || exit 1
fi
