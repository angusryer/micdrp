# PocketBase is a single static binary, so the image is just that binary plus
# the migrations it applies on boot. No runtime, no package manager, no app
# server — which is most of why this backend is cheap to host.
FROM alpine:3.20

ARG PB_VERSION=0.39.11
ARG TARGETARCH

RUN apk add --no-cache ca-certificates unzip wget

# TARGETARCH is amd64/arm64; PocketBase publishes both under those names.
RUN wget -q -O /tmp/pb.zip \
      "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" \
    && unzip -q /tmp/pb.zip -d /usr/local/bin \
    && rm /tmp/pb.zip \
    && chmod +x /usr/local/bin/pocketbase

# The schema. Applied on every boot; already-applied migrations are no-ops.
COPY migrations /pb/migrations

# /pb/data is a mounted volume — the SQLite database and uploaded audio live
# there and must survive a redeploy.
EXPOSE 8080
CMD ["pocketbase", "serve", \
     "--http=0.0.0.0:8080", \
     "--dir=/pb/data", \
     "--migrationsDir=/pb/migrations"]
