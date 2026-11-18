#!/usr/bin/env python3
"""
Smoke test suite for BESCOM PowerHack Caffeine Addicts 2026
Verifies that:
1. All JavaScript files pass syntax check via node --check
2. All DOM elements referenced by JS modules exist in index.html
3. All PHP files have matching closing tags/braces and strict typing
"""

import glob
import os
import re
import subprocess
import sys

def test_js_syntax():
    print("[1/3] Testing JavaScript syntax...")
    js_files = glob.glob("public/js/**/*.js", recursive=True)
    assert len(js_files) > 0, "No JS files found"
    for js_path in js_files:
        subprocess.check_call(["node", "--check", js_path])
        print(f"  ✓ {js_path} OK")

def test_dom_elements():
    print("\n[2/3] Verifying DOM IDs referenced in JS exist in index.html...")
    with open("index.html", "r", encoding="utf-8") as f:
        html = f.read()

    ids_in_html = set(re.findall(r'id=["\']([^"\']+)["\']', html))

    # Check IDs referenced by document.getElementById in our custom JS (excluding dynamic template strings)
    js_files = glob.glob("public/js/**/*.js", recursive=True)
    checked = 0
    missing = []
    dynamic_prefixes = ["transferLabel-", "assign-", "workerNote-"]
    
    for js_path in js_files:
        if "dev-snippets.js" in js_path:
            continue
        with open(js_path, "r", encoding="utf-8") as f:
            content = f.read()
        referenced_ids = re.findall(r'document\.getElementById\([\'"]([^\'"`]+)[\'"]\)', content)
        for dom_id in referenced_ids:
            if any(dom_id.startswith(p) for p in dynamic_prefixes):
                continue
            checked += 1
            if dom_id not in ids_in_html:
                missing.append((js_path, dom_id))

    if missing:
        print(f"  ✗ Missing DOM IDs: {missing}")
        sys.exit(1)
    print(f"  ✓ Verified {checked} DOM ID lookups match HTML elements successfully.")

def test_php_syntax():
    print("\n[3/3] Verifying PHP structure and syntax balance...")
    php_files = glob.glob("**/*.php", recursive=True)
    assert len(php_files) > 0, "No PHP files found"
    for php_path in php_files:
        with open(php_path, "r", encoding="utf-8") as f:
            content = f.read()
        assert content.startswith("<?php"), f"{php_path} missing <?php"
        assert "declare(strict_types=1);" in content, f"{php_path} missing declare(strict_types=1)"
        
        # Balance check for braces and parentheses
        open_b = content.count("{") - content.count("}")
        open_p = content.count("(") - content.count(")")
        open_s = content.count("[") - content.count("]")
        assert open_b == 0, f"{php_path} has unbalanced braces: {open_b}"
        assert open_p == 0, f"{php_path} has unbalanced parens: {open_p}"
        assert open_s == 0, f"{php_path} has unbalanced brackets: {open_s}"
        print(f"  ✓ {php_path} (balanced: braces, parens, brackets, strict_types)")

if __name__ == "__main__":
    test_js_syntax()
    test_dom_elements()
    test_php_syntax()
    print("\n✅ All smoke tests passed successfully!")
