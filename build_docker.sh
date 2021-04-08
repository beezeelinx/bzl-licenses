#!/bin/sh

image=bzl-licenses-checker
usage="$(basename "$0") [-tag <tag name>] [-prefix <tag prefix>] [-giturl <git url>]"

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

if [ "$GITURL" = "" ]; then
    GITURL=$(dirname "$(git config --get remote.origin.url)")
fi

build_args="--build-arg GITURL=$GITURL"

if [ -f docker/Dockerfile ]; then
    dockerfile=docker/Dockerfile
elif [ -f Dockerfile ]; then
    dockerfile=Dockerfile
else
    echo "Unable to find Dockerfile."
    exit 1
fi

if [ "$tag" = "" ]; then
    tag="latest"
fi

# shellcheck disable=SC2086
eval docker build -f ${dockerfile} --pull ${build_args} -t $image . || exit 1

if [ "$prefix" != "" ]; then
    docker tag ${image} "${prefix}"/${image}:${tag} || exit 1
elif [ "$tag" != "latest" ]; then
    docker tag $image ${image}:${tag} || exit 1
fi
