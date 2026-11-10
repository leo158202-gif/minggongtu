#!/bin/bash
# 双击后在这台 Mac 上打开命宫图。密钥不写在这个文件里。
cd "$(dirname "$0")" || exit 1
export LANG=zh_CN.UTF-8
export LC_ALL=zh_CN.UTF-8

pause() {
  printf '\n按回车关闭窗口…\n'
  read -r _
}

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  printf '没有找到 Node.js 或 npm。\n'
  printf '请先安装 Node.js 20 或更新的版本：\n'
  printf '1. 用浏览器打开 https://nodejs.org\n'
  printf '2. 下载 macOS 安装包并完成安装\n'
  printf '3. 关掉这个窗口，再双击「启动.command」\n'
  pause
  exit 1
fi

printf 'Node.js '
node -v
printf '\n'

if [ ! -d node_modules ]; then
  printf '第一次运行，正在安装依赖，请稍候…\n'
  if ! npm install; then
    printf '依赖没有安装成功。请把上面的错误信息留存后再试。\n'
    pause
    exit 1
  fi
fi

if [ ! -f .next/BUILD_ID ]; then
  printf '正在准备本地页面，第一次会久一点…\n'
  if ! npm run build; then
    printf '页面没有构建成功。请把上面的错误信息留存后再试。\n'
    pause
    exit 1
  fi
fi

PORT=3210
if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  printf '本机 %s 端口已有服务。直接打开浏览器。\n' "$PORT"
  open "http://127.0.0.1:${PORT}/bazi"
  exit 0
fi

printf '启动后请点页面上的「AI 设置」，填写密钥。密钥只保存在这台 Mac 的用户目录。\n'
(sleep 2 && open "http://127.0.0.1:${PORT}/bazi") &
exec npx next start --hostname 127.0.0.1 --port "$PORT"
