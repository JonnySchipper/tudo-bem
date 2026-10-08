#!/usr/bin/env python3
"""Fetch the Jev chat-safety model (pinned revision, sha256-checked) into a local folder.

    python3 scripts/fetch-jev-model.py [DEST]              # CI / dev: plain files (default DEST: models/jev-tox-small)
    python3 scripts/fetch-jev-model.py --external [DEST]   # Docker: also re-save the ONNX with external weights
                                                           # (needs `pip install onnx`; halves the server's resident memory)

Model: Horizon-Labs/multilingual-toxicity-small (Apache-2.0, mmBERT-small, 141M params, 34 languages incl. pt + en,
Detoxify labels). See DECISIONS.md "Jev model layer".
"""
import hashlib
import os
import sys
import urllib.request

REPO = "Horizon-Labs/multilingual-toxicity-small"
REVISION = "3baf7739b9ba7d49dc389851bb336f8a03a6cbef"
FILES = {
    "config.json": "cfd6935691cc4225216fa04d32cca9669d85521d36da74c6ff42d7aa00da4365",
    "tokenizer.json": "4379fe7f4a7af10b1ac15ffc8ae90f446f92082393699e9dd54b8c3b5ec0abad",
    "tokenizer_config.json": "ea349495764b24570b4560fe2e4a557e5c0a47e6bce782c2409b1d6445cf8633",
    "onnx/model_quantized.onnx": "44d470dcb255c3b369dcfb2b0bab12610513e5cca635325ea86bf104a14f0080",
}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    external = "--external" in sys.argv
    dest = args[0] if args else os.path.join(os.path.dirname(__file__), "..", "models", "jev-tox-small")
    for name, want in FILES.items():
        out = os.path.join(dest, name)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        if not (os.path.exists(out) and sha256(out) == want):
            url = f"https://huggingface.co/{REPO}/resolve/{REVISION}/{name}"
            print(f"fetch {url}", flush=True)
            urllib.request.urlretrieve(url, out + ".part")
            os.replace(out + ".part", out)
        got = sha256(out)
        if got != want:
            sys.exit(f"sha256 mismatch for {name}: {got} != {want}")
    with open(os.path.join(dest, "REVISION"), "w") as f:
        f.write(f"{REPO}@{REVISION}\n")
    if external:
        import onnx  # noqa: PLC0415 (Docker model stage only)

        src = os.path.join(dest, "onnx", "model_quantized.onnx")
        model = onnx.load(src)
        onnx.save_model(model, os.path.join(dest, "onnx", "model_ext.onnx"), save_as_external_data=True,
                        all_tensors_to_one_file=True, location="model_ext.onnx_data", size_threshold=1024)
        os.remove(src)
    print(f"jev model ready in {os.path.abspath(dest)}")


if __name__ == "__main__":
    main()
