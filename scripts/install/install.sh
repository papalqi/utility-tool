#!/bin/bash
# ============================================
# PC Utility Tool - Installation Script (Bash)
# ============================================
# This script handles the installation of dependencies
# and resolves common issues with native modules

# Ensure we're running from the project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/../../package.json" ]; then
    # Script is in scripts/install/, go up two levels
    cd "$SCRIPT_DIR/../.." || exit 1
elif [ -f "$SCRIPT_DIR/package.json" ]; then
    # Already in project root
    cd "$SCRIPT_DIR" || exit 1
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN} PC Utility Tool - Installation${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${CYAN}Working directory: $(pwd)${NC}"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js is not installed!${NC}"
    echo -e "${YELLOW}Please install Node.js from https://nodejs.org/${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}[ERROR] npm is not installed!${NC}"
    echo -e "${YELLOW}Please install Node.js from https://nodejs.org/${NC}"
    exit 1
fi

echo -e "${GREEN}[1/6] Node.js version: $(node --version)${NC}"
echo -e "${GREEN}      npm version: $(npm --version)${NC}"
echo ""

# Clean npm cache
echo -e "${YELLOW}[2/6] Cleaning npm cache...${NC}"
if npm cache clean --force > /dev/null 2>&1; then
    echo -e "${GREEN}      Cache cleaned successfully${NC}"
else
    echo -e "${YELLOW}[WARNING] Failed to clean cache, continuing...${NC}"
fi
echo ""

# Remove old dependencies
echo -e "${YELLOW}[3/6] Removing old dependencies...${NC}"
if [ -d "node_modules" ]; then
    echo "      Removing node_modules folder..."
    rm -rf node_modules
fi
if [ -f "package-lock.json" ]; then
    echo "      Removing package-lock.json..."
    rm -f package-lock.json
fi
echo -e "${GREEN}      Cleanup complete${NC}"
echo ""

# Install dependencies
echo -e "${YELLOW}[4/6] Installing dependencies (this may take a few minutes)...${NC}"
echo -e "${CYAN}      Note: Skipping native module compilation to avoid build errors${NC}"
if npm install --ignore-scripts; then
    echo -e "${GREEN}      Dependencies installed successfully${NC}"
else
    echo -e "${RED}[ERROR] Failed to install dependencies!${NC}"
    exit 1
fi
echo ""

# Install Electron
echo -e "${YELLOW}[5/6] Installing Electron...${NC}"
if npm install electron --save-dev; then
    echo -e "${GREEN}      Electron installed successfully${NC}"
else
    echo -e "${RED}[ERROR] Failed to install Electron!${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}[6/6] Rebuilding native modules...${NC}"
if npm rebuild; then
    echo -e "${GREEN}      Native modules rebuilt successfully${NC}"
else
    echo -e "${YELLOW}[WARNING] npm rebuild encountered issues; continuing...${NC}"
fi
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${CYAN}You can now run the application with:${NC}"
echo "  npm run dev          - Development mode"
echo "  npm run electron:dev - Electron development mode"
echo "  npm run build        - Build for production"
echo ""
echo -e "${YELLOW}Note: If you encounter issues with node-pty or other native modules,${NC}"
echo -e "${YELLOW}      they can be safely ignored for basic functionality.${NC}"
echo ""
