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

# 安装 APOC 插件
install_apoc() {
    print_info "安装 APOC 插件..."
    
    if [ "$OS" = "macos" ]; then
        NEO4J_PLUGINS_DIR="/opt/homebrew/var/lib/neo4j/plugins"
        NEO4J_CONF_DIR="/opt/homebrew/etc/neo4j"
    else
        NEO4J_PLUGINS_DIR="/var/lib/neo4j/plugins"
        NEO4J_CONF_DIR="/etc/neo4j"
    fi
    
    # 创建插件目录
    sudo mkdir -p "$NEO4J_PLUGINS_DIR"
    
    # 下载 APOC 插件
    print_info "下载 APOC 插件..."
    APOC_VERSION="5.9.0"
    APOC_URL="https://github.com/neo4j/apoc/releases/download/${APOC_VERSION}/apoc-${APOC_VERSION}-core.jar"
    
    sudo curl -L "$APOC_URL" -o "$NEO4J_PLUGINS_DIR/apoc-${APOC_VERSION}-core.jar"
    
    if [ $? -eq 0 ]; then
        print_info "APOC 插件下载成功"
    else
        print_error "APOC 插件下载失败"
        return 1
    fi
    
    # 修改 Neo4j 配置以启用 APOC
    NEO4J_CONF="$NEO4J_CONF_DIR/neo4j.conf"
    if [ -f "$NEO4J_CONF" ]; then
        # 添加 APOC 配置
        sudo grep -q "dbms.security.procedures.unrestricted=apoc.*" "$NEO4J_CONF" || \
        echo "dbms.security.procedures.unrestricted=apoc.*" | sudo tee -a "$NEO4J_CONF"
        
        sudo grep -q "dbms.security.procedures.allowlist=apoc.*" "$NEO4J_CONF" || \
        echo "dbms.security.procedures.allowlist=apoc.*" | sudo tee -a "$NEO4J_CONF"
        
        print_info "APOC 配置已添加到 neo4j.conf"
    fi
    
    return 0
}

# 查找 cypher-shell 的位置
find_cypher_shell() {
    local possible_paths=(
        "/usr/local/bin/cypher-shell"
        "/usr/bin/cypher-shell"
        "/opt/neo4j/bin/cypher-shell"
        "/usr/local/Cellar/neo4j/*/libexec/bin/cypher-shell"
        "/opt/homebrew/bin/cypher-shell"
    )
    
    for path in "${possible_paths[@]}"; do
        if [ -f "$path" ]; then
            echo "$path"
            return 0
        fi
    done
    
    # 如果上述路径都没找到，尝试使用 which 命令
    local which_path=$(which cypher-shell 2>/dev/null)
    if [ ! -z "$which_path" ]; then
        echo "$which_path"
        return 0
    fi
    
    return 1
}

# 重置 Neo4j 密码
reset_neo4j_password() {
    print_info "尝试重置 Neo4j 密码..."
    
    # 停止 Neo4j 服务
    if [ "$OS" = "macos" ]; then
        brew services stop neo4j
        # 删除 Neo4j 数据目录
        if [ -d "/opt/homebrew/var/lib/neo4j" ]; then
            sudo rm -rf /opt/homebrew/var/lib/neo4j/data/databases
            sudo rm -rf /opt/homebrew/var/lib/neo4j/data/dbms
        fi
        # 重新启动服务
        brew services start neo4j
    else
        sudo systemctl stop neo4j
        # 删除 Neo4j 数据目录
        if [ -d "/var/lib/neo4j" ]; then
            sudo rm -rf /var/lib/neo4j/data/databases
            sudo rm -rf /var/lib/neo4j/data/dbms
        fi
        sudo systemctl start neo4j
    fi
    
    # 等待服务重新启动
    print_info "等待 Neo4j 服务重新启动..."
    sleep 20
}

# 从 .env 文件读取配置
load_env() {
    if [ -f .env ]; then
        print_info "正在从 .env 文件加载配置..."
        export $(cat .env | grep -v '^#' | xargs)
    else
        print_warning ".env 文件不存在，将使用默认配置"
        NEO4J_USER="neo4j"
        NEO4J_PASSWORD="neo4j"
    fi
    
    # 设置默认的 neo4j 用户密码（如果没有指定）
    if [ -z "$NEO4J_DEFAULT_PASSWORD" ]; then
        NEO4J_DEFAULT_PASSWORD="$NEO4J_PASSWORD"
    fi
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

# 加载环境变量
load_env

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

# 安装 APOC 插件
install_apoc

# 设置默认密码
print_info "设置默认密码..."
if [ "$OS" = "macos" ]; then
    NEO4J_CONF="/opt/homebrew/etc/neo4j/neo4j.conf"
    NEO4J_BIN="/opt/homebrew/bin/neo4j"
else
    NEO4J_CONF="/etc/neo4j/neo4j.conf"
    NEO4J_BIN="/usr/bin/neo4j"
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

# 等待 Neo4j 完全启动
print_info "等待 Neo4j 服务完全启动..."
sleep 15

# 查找 cypher-shell
print_info "查找 cypher-shell..."
CYPHER_SHELL=$(find_cypher_shell)

if [ -z "$CYPHER_SHELL" ]; then
    print_error "找不到 cypher-shell，请确保 Neo4j 安装正确"
    exit 1
fi

print_info "找到 cypher-shell: $CYPHER_SHELL"

# 修改默认密码和创建新用户
print_info "正在配置 Neo4j 用户..."

# 尝试使用默认密码登录
print_info "尝试使用默认密码登录..."
echo "RETURN 1;" | "$CYPHER_SHELL" -u neo4j -p neo4j -d system > /dev/null 2>&1

if [ $? -ne 0 ]; then
    print_warning "默认密码登录失败，可能密码已被修改"
    print_info "是否要重置 Neo4j 数据库？这将删除所有现有数据！"
    read -p "输入 'yes' 确认重置: " confirm
    
    if [ "$confirm" = "yes" ]; then
        reset_neo4j_password
    else
        print_error "无法继续配置，请手动重置密码或提供正确的当前密码"
        exit 1
    fi
fi

# 修改默认 neo4j 用户密码
print_info "修改默认 neo4j 用户密码..."
echo "ALTER CURRENT USER SET PASSWORD FROM 'neo4j' TO '$NEO4J_DEFAULT_PASSWORD';" | "$CYPHER_SHELL" -u neo4j -p neo4j -d system

if [ $? -eq 0 ]; then
    print_info "默认 neo4j 用户密码修改成功！"
    
    # 创建新用户（如果用户名不是 neo4j）
    if [ "$NEO4J_USER" != "neo4j" ]; then
        print_info "创建新用户: $NEO4J_USER"
        echo "CREATE USER $NEO4J_USER SET PASSWORD '$NEO4J_PASSWORD' CHANGE NOT REQUIRED;" | "$CYPHER_SHELL" -u neo4j -p "$NEO4J_DEFAULT_PASSWORD" -d system
        
        if [ $? -eq 0 ]; then
            print_info "新用户创建成功！"
        else
            print_error "新用户创建失败，请手动创建"
        fi
    fi
else
    print_error "默认用户密码修改失败，请手动修改密码"
fi

# 验证 APOC 安装
print_info "验证 APOC 插件安装..."
echo "CALL apoc.help('meta');" | "$CYPHER_SHELL" -u neo4j -p "$NEO4J_DEFAULT_PASSWORD" -d neo4j > /dev/null 2>&1

if [ $? -eq 0 ]; then
    print_info "APOC 插件安装成功！"
else
    print_warning "APOC 插件可能未正确安装，请检查插件目录和配置"
fi

print_info "Neo4j 安装完成！"
print_info "你可以通过以下地址访问 Neo4j 浏览器：http://localhost:7474"
print_info "默认用户 neo4j 密码：$NEO4J_DEFAULT_PASSWORD"
if [ "$NEO4J_USER" != "neo4j" ]; then
    print_info "新用户名：$NEO4J_USER"
    print_info "新用户密码：$NEO4J_PASSWORD"
fi 