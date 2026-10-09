# FPV vs Interceptor — 常用指令

# 列出所有指令
default:
    @just --list

# 安裝相依套件
install:
    npm install

# 開發伺服器（可指定 port：just dev 3000）
dev port="5173": _deps
    npx vite --port {{port}}

# 開發伺服器，開放區網（手機實測用）
dev-lan port="5173": _deps
    npx vite --host --port {{port}}

# 物理單元測試
test: _deps
    npx vitest run

# 測試 watch 模式
test-watch: _deps
    npx vitest

# 型別檢查
check: _deps
    npx tsc --noEmit

# 型別檢查 + 打包到 dist/
build: _deps
    npm run build

# 預覽 build 結果
preview: build
    npx vite preview

# 提交前檢查：型別 + 測試 + 打包
ci: check test build

# 清除 build 產物
clean:
    rm -rf dist

# 清除 build 產物與 node_modules
clean-all: clean
    rm -rf node_modules

# 沒有 node_modules 時自動安裝
_deps:
    @[ -d node_modules ] || npm install
