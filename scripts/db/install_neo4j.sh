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

# 检测 Linux 发行版
detect_linux_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        case "$ID" in
            "ubuntu"|"debian")
                echo "ubuntu"
                ;;
            "amzn"|"amazonlinux")
                echo "amazonlinux"
                ;;
            "centos"|"rhel"|"fedora")
                echo "centos"
                ;;
            *)
                # 尝试从 ID_LIKE 判断
                if [[ "$ID_LIKE" == *"debian"* ]]; then
                    echo "ubuntu"
                elif [[ "$ID_LIKE" == *"rhel"* ]] || [[ "$ID_LIKE" == *"fedora"* ]]; then
                    echo "centos"
                else
                    echo "unknown"
                fi
                ;;
        esac
    elif [ -f /etc/redhat-release ]; then
        if grep -q "Amazon Linux" /etc/redhat-release; then
            echo "amazonlinux"
        elif grep -q -E "(CentOS|Red Hat|Fedora)" /etc/redhat-release; then
            echo "centos"
        else
            echo "unknown"
        fi
    elif [ -f /etc/debian_version ]; then
        echo "ubuntu"
    else
        echo "unknown"
    fi
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
    DISTRO=$(detect_linux_distro)
    case "$DISTRO" in
        "ubuntu")
            OS="ubuntu"
            ;;
        "amazonlinux")
            OS="amazonlinux"
            ;;
        "centos")
            OS="centos"
            ;;
        "unknown")
            print_error "不支持的 Linux 发行版，请手动安装 Neo4j"
            exit 1
            ;;
        *)
            print_error "未知的 Linux 发行版: $DISTRO"
            exit 1
            ;;
    esac
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
    print_info "在 Ubuntu/Debian 上安装 Neo4j..."
    
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

elif [ "$OS" = "amazonlinux" ] || [ "$OS" = "centos" ]; then
    print_info "在 Amazon Linux/CentOS 上安装 Neo4j..."
    
    # 检查使用哪个包管理器
    if command -v dnf &> /dev/null; then
        PKG_MANAGER="dnf"
    elif command -v yum &> /dev/null; then
        PKG_MANAGER="yum"
    else
        print_error "找不到 yum 或 dnf 包管理器"
        exit 1
    fi
    
    print_info "使用包管理器: $PKG_MANAGER"
    
    # 更新系统
    print_info "更新系统包..."
    sudo $PKG_MANAGER update -y
    
    # 安装依赖 - 修复 Java 包名
    print_info "安装必要的依赖..."
    if [ "$OS" = "amazonlinux" ]; then
        # 先清理缓存
        sudo $PKG_MANAGER clean all
        
        # 安装 rpm 工具以支持 GPG 验证
        print_info "安装 RPM 工具..."
        sudo $PKG_MANAGER install -y rpm --nogpgcheck
        
        # Amazon Linux 的 Java 包名
        # 跳过 curl，因为系统已经有 curl-minimal
        print_info "检查 curl..."
        if command -v curl &> /dev/null; then
            print_info "curl 已安装，跳过安装"
        else
            sudo $PKG_MANAGER install -y curl --skip-broken --nogpgcheck
        fi
        
        print_info "安装 wget..."
        sudo $PKG_MANAGER install -y wget --skip-broken --nogpgcheck
        
        print_info "安装 Java..."
        sudo $PKG_MANAGER install -y java-11-amazon-corretto java-11-amazon-corretto-devel --skip-broken --nogpgcheck
    else
        # CentOS/RHEL 的 Java 包名
        sudo $PKG_MANAGER install -y curl wget java-11-openjdk java-11-openjdk-devel --skip-broken
    fi
    
    # 验证 Java 安装
    if ! command -v java &> /dev/null; then
        print_warning "Java 未找到，尝试其他安装方法..."
        if [ "$OS" = "amazonlinux" ]; then
            # 尝试安装 OpenJDK
            print_info "尝试安装 OpenJDK..."
            sudo $PKG_MANAGER install -y java-11-openjdk java-11-openjdk-devel --skip-broken --nogpgcheck
            
            # 如果还是没有，尝试安装 java-latest
            if ! command -v java &> /dev/null; then
                print_info "尝试安装 java-latest..."
                sudo $PKG_MANAGER install -y java-latest-openjdk java-latest-openjdk-devel --skip-broken --nogpgcheck
            fi
            
            # 最后尝试使用 amazon-linux-extras（如果可用）
            if ! command -v java &> /dev/null && command -v amazon-linux-extras &> /dev/null; then
                print_info "尝试使用 amazon-linux-extras 安装 Java..."
                sudo amazon-linux-extras install java-openjdk11 -y
            fi
        fi
        
        # 最后检查
        if ! command -v java &> /dev/null; then
            print_error "Java 安装失败，请手动安装 Java 11"
            print_info "可以尝试运行: sudo dnf install -y java-11-amazon-corretto --nogpgcheck"
            print_info "或者: sudo dnf clean all && sudo dnf install -y java-11-amazon-corretto --nogpgcheck"
            exit 1
        fi
    fi
    
    print_info "Java 版本: $(java -version 2>&1 | head -n 1)"
    
    # 安装 Neo4j - 使用直接下载方式，因为 yum 仓库配置比较复杂
    print_info "下载并安装 Neo4j..."
    NEO4J_VERSION="4.4.21"
    NEO4J_TARBALL="neo4j-community-${NEO4J_VERSION}-unix.tar.gz"
    NEO4J_URL="https://dist.neo4j.org/neo4j-community-${NEO4J_VERSION}-unix.tar.gz"
    
    # 下载 Neo4j
    cd /tmp
    curl -L "$NEO4J_URL" -o "$NEO4J_TARBALL"
    
    if [ $? -ne 0 ]; then
        print_error "下载 Neo4j 失败"
        exit 1
    fi
    
    # 解压并安装
    sudo tar -xzf "$NEO4J_TARBALL" -C /opt/
    sudo mv "/opt/neo4j-community-${NEO4J_VERSION}" /opt/neo4j
    
    # 创建 neo4j 用户（如果不存在）
    if ! id "neo4j" &>/dev/null; then
        sudo useradd -r -s /bin/false neo4j
    fi
    
    # 设置正确的权限
    sudo chown -R neo4j:neo4j /opt/neo4j
    sudo chmod +x /opt/neo4j/bin/neo4j
    sudo chmod +x /opt/neo4j/bin/cypher-shell
    
    # 创建必要的目录
    sudo mkdir -p /var/lib/neo4j/data
    sudo mkdir -p /var/lib/neo4j/logs
    sudo mkdir -p /var/run/neo4j
    sudo chown -R neo4j:neo4j /var/lib/neo4j
    sudo chown -R neo4j:neo4j /var/run/neo4j
    
    # 创建 systemd 服务文件 - 改进版本
    sudo tee /etc/systemd/system/neo4j.service > /dev/null <<EOF
[Unit]
Description=Neo4j Graph Database
After=network-online.target
Wants=network-online.target

[Service]
Type=forking
ExecStart=/opt/neo4j/bin/neo4j start
ExecStop=/opt/neo4j/bin/neo4j stop
ExecReload=/opt/neo4j/bin/neo4j restart
TimeoutSec=120
Restart=on-failure
User=neo4j
Group=neo4j
Environment=NEO4J_HOME=/opt/neo4j
Environment=NEO4J_CONF=/opt/neo4j/conf
Environment=JAVA_HOME=/usr/lib/jvm/java-11-amazon-corretto
PIDFile=/var/run/neo4j/neo4j.pid
LimitNOFILE=60000

[Install]
WantedBy=multi-user.target
EOF
    
    # 配置 Neo4j
    if [ -f "/opt/neo4j/conf/neo4j.conf" ]; then
        sudo cp "/opt/neo4j/conf/neo4j.conf" "/opt/neo4j/conf/neo4j.conf.backup"
        
        # 基本配置
        sudo sed -i 's|#dbms.default_listen_address=0.0.0.0|dbms.default_listen_address=0.0.0.0|' /opt/neo4j/conf/neo4j.conf
        sudo sed -i 's|#dbms.connector.http.listen_address=:7474|dbms.connector.http.listen_address=0.0.0.0:7474|' /opt/neo4j/conf/neo4j.conf
        sudo sed -i 's|#dbms.connector.bolt.listen_address=:7687|dbms.connector.bolt.listen_address=0.0.0.0:7687|' /opt/neo4j/conf/neo4j.conf
        
        # 设置数据目录
        sudo sed -i 's|#dbms.directories.data=data|dbms.directories.data=/var/lib/neo4j/data|' /opt/neo4j/conf/neo4j.conf
        sudo sed -i 's|#dbms.directories.logs=logs|dbms.directories.logs=/var/lib/neo4j/logs|' /opt/neo4j/conf/neo4j.conf
        
        # 内存设置
        sudo sed -i 's|#dbms.memory.heap.initial_size=512m|dbms.memory.heap.initial_size=512m|' /opt/neo4j/conf/neo4j.conf
        sudo sed -i 's|#dbms.memory.heap.max_size=512m|dbms.memory.heap.max_size=512m|' /opt/neo4j/conf/neo4j.conf
    fi
    
    # 重新加载 systemd 并启动服务
    sudo systemctl daemon-reload
    sudo systemctl enable neo4j
    
    # 尝试直接启动而不是通过 systemd（用于调试）
    print_info "尝试直接启动 Neo4j..."
    sudo -u neo4j /opt/neo4j/bin/neo4j start
    
    # 检查启动状态
    sleep 5
    if sudo -u neo4j /opt/neo4j/bin/neo4j status; then
        print_info "Neo4j 直接启动成功，现在配置 systemd 服务..."
        sudo -u neo4j /opt/neo4j/bin/neo4j stop
        sleep 3
        sudo systemctl start neo4j
    else
        print_error "Neo4j 启动失败，检查日志..."
        if [ -f "/var/lib/neo4j/logs/neo4j.log" ]; then
            print_info "Neo4j 日志内容："
            sudo tail -20 /var/lib/neo4j/logs/neo4j.log
        fi
        if [ -f "/opt/neo4j/logs/neo4j.log" ]; then
            print_info "Neo4j 日志内容："
            sudo tail -20 /opt/neo4j/logs/neo4j.log
        fi
    fi
    
    # 添加到 PATH
    if ! grep -q "/opt/neo4j/bin" /etc/environment; then
        echo 'PATH="/opt/neo4j/bin:$PATH"' | sudo tee -a /etc/environment
    fi
    
    # 为当前会话添加到 PATH
    export PATH="/opt/neo4j/bin:$PATH"
    
    print_info "Neo4j 已安装到 /opt/neo4j"
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
elif [ "$OS" = "amazonlinux" ] || [ "$OS" = "centos" ]; then
    NEO4J_CONF="/opt/neo4j/conf/neo4j.conf"
    NEO4J_BIN="/opt/neo4j/bin/neo4j"
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