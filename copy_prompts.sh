#!/bin/bash

# 源目录
SRC_DIR="/Users/chaoyuepan/mcp-prompt-server/src/prompts"
# 目标目录
DEST_DIR="/Users/chaoyuepan/mcp-prompt-server-go/prompts"

# 确保目标目录存在
mkdir -p "$DEST_DIR"

# 复制所有yaml和json文件
echo "Copying prompt files..."
cp "$SRC_DIR"/*.yaml "$DEST_DIR"/ 2>/dev/null
cp "$SRC_DIR"/*.json "$DEST_DIR"/ 2>/dev/null

echo "Done! Copied prompt files to $DEST_DIR"
