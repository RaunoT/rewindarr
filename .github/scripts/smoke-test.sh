#!/usr/bin/env bash
# Starts a built Rewindarr image with an empty config directory and no
# environment, as a new install would, and checks that the server boots and
# answers requests.
#
# Usage: smoke-test.sh <image>
set -euo pipefail

image="${1:?Usage: smoke-test.sh <image>}"
port=8383
name="rewindarr-smoke-$$"
config_dir="$(mktemp -d)"

cleanup() {
  status=$?

  if [ "$status" -ne 0 ]; then
    echo '::group::Container logs'
    docker logs "$name" 2>&1 || true
    echo '::endgroup::'
  fi

  docker rm -f "$name" > /dev/null 2>&1 || true
  rm -rf "$config_dir" 2> /dev/null || true
  exit "$status"
}
trap cleanup EXIT

docker run --detach --name "$name" --publish "$port:$port" \
  --volume "$config_dir:/app/config" \
  "$image" > /dev/null

# Docker's port forwarding accepts connections before the server is listening
# and then resets them, so --retry-connrefused alone is not enough while the
# app starts; --retry-all-errors covers resets and empty replies.
health_body=$(curl --retry 20 --retry-connrefused --retry-all-errors \
  --retry-delay 2 --max-time 10 --fail --silent --show-error \
  "http://localhost:$port/api/health")
printf '/api/health -> 200 (%s)\n' "$health_body"
grep -q '"ok"' <<< "$health_body"

# Public endpoints and assets must answer directly with 200 without redirecting
for path in /api/status /manifest.json /sw.js /offline.html; do
  code=$(curl --max-time 10 --silent --show-error \
    --output /dev/null --write-out '%{http_code}' \
    "http://localhost:$port$path")
  echo "$path -> $code"
  [ "$code" = "200" ] || {
    echo "Expected 200 for $path, got $code" >&2
    exit 1
  }
done

# An unconfigured instance redirects pages to the setup page
read -r root_code location <<< "$(curl --max-time 10 --silent --show-error \
  --output /dev/null --write-out '%{http_code} %{redirect_url}' \
  "http://localhost:$port/")"
echo "/ -> $root_code ($location)"
case "$root_code" in
  301|302|303|307|308) ;;
  *)
    echo "Expected redirect from /, got $root_code" >&2
    exit 1
    ;;
esac
[[ "$location" == */settings/connection* ]] || {
  echo "Expected redirect to /settings/connection, got '$location'" >&2
  exit 1
}

setup_code=$(curl --max-time 10 --silent --show-error \
  --output /dev/null --write-out '%{http_code}' \
  "http://localhost:$port/settings/connection")
echo "/settings/connection -> $setup_code"
[ "$setup_code" = "200" ] || {
  echo "Expected 200 for /settings/connection, got $setup_code" >&2
  exit 1
}

# Image HEALTHCHECK must succeed even when outbound proxy variables are set
hc=$(docker inspect --format '{{index .Config.Healthcheck.Test 1}}' "$image")
[ -n "$hc" ] || {
  echo "Image HEALTHCHECK command is missing" >&2
  exit 1
}
docker exec -e HTTP_PROXY=http://127.0.0.1:9 -e http_proxy=http://127.0.0.1:9 "$name" \
  sh -c "$hc"

# Main process runs as non-root node user (UID 1000)
pid1_uid=$(docker exec "$name" awk '/^Uid:/ { print $2 }' /proc/1/status)
[ "$pid1_uid" = "1000" ] || {
  echo "Expected PID 1 UID 1000, got '$pid1_uid'" >&2
  exit 1
}

# Without NEXTAUTH_SECRET the app creates one alongside settings.json, both
# restricted to owner-only read/write (0600).
for file in /app/config/auth-secret /app/config/settings.json; do
  docker exec "$name" test -s "$file" || {
    echo "Missing or empty $file" >&2
    exit 1
  }
  mode=$(docker exec "$name" stat -c '%a' "$file")
  [ "$mode" = "600" ] || {
    echo "Expected mode 600 on $file, got '$mode'" >&2
    exit 1
  }
done

echo 'Smoke test passed'
