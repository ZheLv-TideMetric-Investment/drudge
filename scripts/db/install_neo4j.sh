#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的信息函数
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 未安装"
        return 1
    fi
    return 0
}

# 检测操作系统
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="ubuntu"
else
    print_error "不支持的操作系统: $OSTYPE"
    exit 1
fi

print_info "检测到操作系统: $OS"

# 安装 Neo4j
if [ "$OS" = "macos" ]; then
    print_info "在 MacOS 上安装 Neo4j..."
    
    # 检查 Homebrew
    if ! check_command brew; then
        print_info "正在安装 Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    # 安装 Neo4j
    print_info "使用 Homebrew 安装 Neo4j..."
    brew install neo4j
    
    # 启动 Neo4j
    print_info "启动 Neo4j 服务..."
    brew services start neo4j
    
elif [ "$OS" = "ubuntu" ]; then
    print_info "在 Ubuntu 上安装 Neo4j..."
    
    # 更新系统
    print_info "更新系统包..."
    sudo apt-get update -y
    
    # 安装依赖
    print_info "安装必要的依赖..."
    sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
    
    # 添加 Neo4j 官方 GPG 密钥
    print_info "添加 Neo4j 官方 GPG 密钥..."
    curl -fsSL https://debian.neo4j.org/neotechnology.gpg.key | sudo tee /etc/apt/trusted.gpg.d/neo4j.asc
    
    # 添加 Neo4j 仓库
    print_info "添加 Neo4j 仓库..."
    sudo add-apt-repository "deb https://debian.neo4j.org/repo stable 4.4"
    
    # 安装 Neo4j
    print_info "安装 Neo4j..."
    sudo apt-get update -y
    sudo apt-get install -y neo4j
    
    # 启动 Neo4j 服务
    print_info "启动 Neo4j 服务..."
    sudo systemctl start neo4j
    sudo systemctl enable neo4j
fi

# 等待 Neo4j 启动
print_info "等待 Neo4j 服务启动..."
sleep 10

# 设置默认密码
print_info "设置默认密码..."
if [ "$OS" = "macos" ]; then
    NEO4J_CONF="/usr/local/etc/neo4j/neo4j.conf"
else
    NEO4J_CONF="/etc/neo4j/neo4j.conf"
fi

# 修改配置文件
if [ -f "$NEO4J_CONF" ]; then
    # 备份原配置文件
    sudo cp "$NEO4J_CONF" "${NEO4J_CONF}.backup"
    
    # 修改配置
    sudo sed -i.bak 's/#dbms.security.auth_enabled=true/dbms.security.auth_enabled=true/' "$NEO4J_CONF"
    sudo sed -i.bak 's/#dbms.default_listen_address=0.0.0.0/dbms.default_listen_address=0.0.0.0/' "$NEO4J_CONF"
    
    # 重启服务
    if [ "$OS" = "macos" ]; then
        brew services restart neo4j
    else
        sudo systemctl restart neo4j
    fi
fi

print_info "Neo4j 安装完成！"
print_info "你可以通过以下地址访问 Neo4j 浏览器：http://localhost:7474"
print_info "默认用户名：neo4j"
print_info "默认密码：neo4j" 