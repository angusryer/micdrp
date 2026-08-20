#!/usr/bin/env python3
"""Report what App Store Connect actually knows about our builds.

`fastlane pilot builds` cannot do this any more — it requests a
`buildDeliveries` relationship Apple removed — so this talks to the REST API
directly. Needs ASC_KEY_ID, ASC_ISSUER_ID and ASC_API_KEY_PATH.

An empty build list means one of two things that look identical here: still
processing, or rejected during processing. Apple reports rejections only by
email, so check there if a build has not appeared after ~15 minutes.

    scripts/testflight-status.py            once
    scripts/testflight-status.py --watch    until a build appears
"""
import base64, json, os, subprocess, sys, time, urllib.request, urllib.error

BUNDLE_ID = os.environ.get("IOS_BUNDLE_ID", "io.greenlyre.micdrp")


def token():
    key_id = os.environ["ASC_KEY_ID"]
    issuer = os.environ["ASC_ISSUER_ID"]
    p8 = os.path.expanduser(os.environ["ASC_API_KEY_PATH"])
    b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=")
    now = int(time.time())
    head = {"alg": "ES256", "kid": key_id, "typ": "JWT"}
    body = {"iss": issuer, "iat": now, "exp": now + 600, "aud": "appstoreconnect-v1"}
    si = b64(json.dumps(head).encode()) + b"." + b64(json.dumps(body).encode())
    der = subprocess.run(["openssl", "dgst", "-sha256", "-sign", p8],
                         input=si, capture_output=True, check=True).stdout
    # ES256 wants raw r||s; openssl emits DER-wrapped INTEGERs.
    i, parts = (2 if der[1] < 0x80 else 3), []
    for _ in range(2):
        ln = der[i + 1]
        parts.append(der[i + 2:i + 2 + ln].lstrip(b"\x00").rjust(32, b"\x00"))
        i += 2 + ln
    return (si + b"." + b64(b"".join(parts))).decode()


def api(tok, path):
    req = urllib.request.Request("https://api.appstoreconnect.apple.com/v1/" + path,
                                 headers={"Authorization": "Bearer " + tok})
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        return {"error": e.code, "body": e.read().decode()[:200]}


def report():
    tok = token()
    apps = api(tok, f"apps?filter[bundleId]={BUNDLE_ID}").get("data", [])
    if not apps:
        print(f"no app record for {BUNDLE_ID}")
        return False
    app = apps[0]
    print(f"{app['attributes']['name']}  ({BUNDLE_ID})")
    builds = api(tok, f"builds?filter[app]={app['id']}&limit=10&sort=-uploadedDate").get("data", [])
    if not builds:
        print("  no builds registered — still processing, or rejected (check email)")
        return False
    for b in builds:
        a = b["attributes"]
        print(f"  build {a.get('version'):<4} {a.get('processingState'):<12} "
              f"uploaded {a.get('uploadedDate')}  expired={a.get('expired')}")
    return any(b["attributes"].get("processingState") == "VALID" for b in builds)


if __name__ == "__main__":
    watch = "--watch" in sys.argv
    while True:
        if report() or not watch:
            break
        time.sleep(60)
