#!/bin/bash
# Quick installer - redirects to the actual installation script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"; pwd)"
bash "$SCRIPT_DIR/scripts/install/install.sh"