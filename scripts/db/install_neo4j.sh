#!/bin/bash

# 安全的 Neo4j 安装脚本
# 支持 macOS, Ubuntu/Debian, Amazon Linux/CentOS
# 避免破坏系统环境

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

# 检查是否为root用户
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_error "请不要以root用户身份运行此脚本"
        exit 1
    fi
}

# 检查系统基本环境
check_system_health() {
    print_info "检查系统基本环境..."
    
    # 检查基本命令
    local essential_commands=("curl" "tar" "which" "id")
    local missing_commands=()
    
    for cmd in "${essential_commands[@]}"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            missing_commands+=("$cmd")
        fi
    done
    
    if [ ${#missing_commands[@]} -ne 0 ]; then
        print_error "系统缺少基本命令: ${missing_commands[*]}"
        print_error "请先修复系统环境后再运行此脚本"
        exit 1
    fi
    
    print_info "系统环境检查通过"
}

# 检测Linux发行版
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

# 检测操作系统
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        detect_linux_distro
    else
        echo "unknown"
    fi
}

# 从 .env 文件读取配置
load_env() {
    if [ -f .env ]; then
        print_info "正在从 .env 文件加载配置..."
        # 安全地读取 .env 文件
        while IFS= read -r line || [ -n "$line" ]; do
            # 跳过注释和空行
            [[ "$line" =~ ^[[:space:]]*# ]] && continue
            [[ -z "${line// }" ]] && continue
            
            # 导出变量
            if [[ "$line" =~ ^[[:space:]]*([a-zA-Z_][a-zA-Z0-9_]*)=(.*)$ ]]; then
                export "${BASH_REMATCH[1]}"="${BASH_REMATCH[2]}"
            fi
        done < .env
    else
        print_warning ".env 文件不存在，将使用默认配置"
    fi
    
    # 设置默认值
    NEO4J_USER="${NEO4J_USER:-neo4j}"
    NEO4J_PASSWORD="${NEO4J_PASSWORD:-neo4j123}"
    NEO4J_DEFAULT_PASSWORD="${NEO4J_DEFAULT_PASSWORD:-$NEO4J_PASSWORD}"
}

# 检查命令是否存在
check_command() {
    command -v "$1" >/dev/null 2>&1
}

# macOS 安装
install_macos() {
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
    
    # 设置配置路径
    NEO4J_CONF="/opt/homebrew/etc/neo4j/neo4j.conf"
    NEO4J_PLUGINS_DIR="/opt/homebrew/var/lib/neo4j/plugins"
    CYPHER_SHELL="/opt/homebrew/bin/cypher-shell"
}

# Ubuntu/Debian 安装
install_ubuntu() {
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
    
    # 设置配置路径
    NEO4J_CONF="/etc/neo4j/neo4j.conf"
    NEO4J_PLUGINS_DIR="/var/lib/neo4j/plugins"
    CYPHER_SHELL="/usr/bin/cypher-shell"
}

# 安全地安装Java（用于Amazon Linux/CentOS）
install_java_safely() {
    print_info "安装Java..."
    
    # 确定包管理器
    if command -v dnf >/dev/null 2>&1; then
        PKG_MANAGER="dnf"
    elif command -v yum >/dev/null 2>&1; then
        PKG_MANAGER="yum"
    else
        print_error "找不到包管理器 (dnf 或 yum)"
        return 1
    fi
    
    # 检查Java是否已安装
    if command -v java >/dev/null 2>&1; then
        local java_version=$(java -version 2>&1 | head -n 1)
        print_info "Java已安装: $java_version"
        return 0
    fi
    
    # 尝试安装Java (Amazon Corretto 11)
    print_info "安装 Amazon Corretto 11..."
    if sudo $PKG_MANAGER install -y java-11-amazon-corretto >/dev/null 2>&1; then
        print_info "Amazon Corretto 11 安装成功"
        return 0
    fi
    
    # 如果失败，尝试OpenJDK
    print_warning "Amazon Corretto 安装失败，尝试OpenJDK..."
    for java_pkg in "java-11-openjdk" "java-11-openjdk-headless" "java-1.8.0-openjdk"; do
        if sudo $PKG_MANAGER install -y "$java_pkg" >/dev/null 2>&1; then
            print_info "成功安装 $java_pkg"
            return 0
        fi
    done
    
    print_error "Java安装失败"
    return 1
}

# 下载并安装Neo4j（用于Amazon Linux/CentOS）
install_neo4j_tarball() {
    print_info "下载并安装Neo4j..."
    
    local NEO4J_VERSION="4.4.21"
    local NEO4J_TARBALL="neo4j-community-${NEO4J_VERSION}-unix.tar.gz"
    local NEO4J_URL="https://dist.neo4j.org/neo4j-community-${NEO4J_VERSION}-unix.tar.gz"
    local WORK_DIR="/tmp/neo4j-install-$$"
    
    # 创建工作目录
    mkdir -p "$WORK_DIR"
    cd "$WORK_DIR"
    
    # 下载Neo4j
    print_info "下载Neo4j $NEO4J_VERSION..."
    if ! curl -fL "$NEO4J_URL" -o "$NEO4J_TARBALL"; then
        print_error "下载Neo4j失败"
        rm -rf "$WORK_DIR"
        return 1
    fi
    
    # 验证下载
    if [ ! -f "$NEO4J_TARBALL" ] || [ ! -s "$NEO4J_TARBALL" ]; then
        print_error "下载的文件损坏或为空"
        rm -rf "$WORK_DIR"
        return 1
    fi
    
    # 解压
    print_info "解压Neo4j..."
    if ! tar -xzf "$NEO4J_TARBALL"; then
        print_error "解压失败"
        rm -rf "$WORK_DIR"
        return 1
    fi
    
    # 检查解压结果
    if [ ! -d "neo4j-community-${NEO4J_VERSION}" ]; then
        print_error "解压目录不存在"
        rm -rf "$WORK_DIR"
        return 1
    fi
    
    # 安装到/opt/neo4j
    print_info "安装Neo4j到/opt/neo4j..."
    sudo rm -rf /opt/neo4j
    sudo mv "neo4j-community-${NEO4J_VERSION}" /opt/neo4j
    
    # 创建neo4j用户 (使用/bin/bash而不是/bin/false)
    if ! id neo4j >/dev/null 2>&1; then
        print_info "创建neo4j用户..."
        sudo useradd -r -d /var/lib/neo4j -s /bin/bash neo4j
    fi
    
    # 创建必要目录
    sudo mkdir -p /var/lib/neo4j/{data,logs,import,plugins}
    sudo mkdir -p /var/run/neo4j
    sudo mkdir -p /var/log/neo4j
    
    # 设置权限
    sudo chown -R neo4j:neo4j /opt/neo4j
    sudo chown -R neo4j:neo4j /var/lib/neo4j
    sudo chown -R neo4j:neo4j /var/run/neo4j
    sudo chown -R neo4j:neo4j /var/log/neo4j
    
    # 确保脚本可执行并修复shebang
    sudo chmod +x /opt/neo4j/bin/neo4j
    sudo chmod +x /opt/neo4j/bin/cypher-shell
    sudo sed -i '1s|#!/usr/bin/env sh|#!/bin/bash|' /opt/neo4j/bin/neo4j
    sudo sed -i '1s|#!/usr/bin/env sh|#!/bin/bash|' /opt/neo4j/bin/cypher-shell
    
    # 清理工作目录
    rm -rf "$WORK_DIR"
    
    print_info "Neo4j安装完成"
    return 0
}

# Amazon Linux/CentOS 安装
install_amazonlinux() {
    print_info "在 Amazon Linux/CentOS 上安装 Neo4j..."
    
    # 安装Java
    install_java_safely || return 1
    
    # 安装Neo4j
    install_neo4j_tarball || return 1
    
    # 配置Neo4j
    configure_neo4j_amazonlinux
    
    # 创建systemd服务
    create_systemd_service
    
    # 设置配置路径
    NEO4J_CONF="/opt/neo4j/conf/neo4j.conf"
    NEO4J_PLUGINS_DIR="/var/lib/neo4j/plugins"
    CYPHER_SHELL="/opt/neo4j/bin/cypher-shell"
}

# 配置Neo4j（Amazon Linux版本）
configure_neo4j_amazonlinux() {
    print_info "配置Neo4j..."
    
    local NEO4J_CONF="/opt/neo4j/conf/neo4j.conf"
    
    # 备份原配置
    sudo cp "$NEO4J_CONF" "${NEO4J_CONF}.backup"
    
    # 基本配置
    sudo tee /tmp/neo4j-config-patch.txt > /dev/null << 'EOF'
# 监听所有接口
dbms.default_listen_address=0.0.0.0
dbms.connector.http.listen_address=0.0.0.0:7474
dbms.connector.bolt.listen_address=0.0.0.0:7687

# 数据目录
dbms.directories.data=/var/lib/neo4j/data
dbms.directories.logs=/var/log/neo4j
dbms.directories.import=/var/lib/neo4j/import
dbms.directories.plugins=/var/lib/neo4j/plugins

# 内存设置
dbms.memory.heap.initial_size=512m
dbms.memory.heap.max_size=1g

# 安全设置
dbms.security.auth_enabled=true
EOF
    
    # 应用配置
    sudo cat /tmp/neo4j-config-patch.txt >> "$NEO4J_CONF"
    sudo rm /tmp/neo4j-config-patch.txt
    
    print_info "Neo4j配置完成"
}

# 创建systemd服务
create_systemd_service() {
    print_info "创建systemd服务..."
    
    sudo tee /etc/systemd/system/neo4j.service > /dev/null << 'EOF'
[Unit]
Description=Neo4j Graph Database
After=network-online.target
Wants=network-online.target

[Service]
Type=forking
User=neo4j
Group=neo4j
Environment=NEO4J_HOME=/opt/neo4j
Environment=NEO4J_CONF=/opt/neo4j/conf
Environment=PATH=/usr/local/bin:/usr/bin:/bin:/opt/neo4j/bin
WorkingDirectory=/opt/neo4j
ExecStart=/opt/neo4j/bin/neo4j start
ExecStop=/opt/neo4j/bin/neo4j stop
ExecReload=/opt/neo4j/bin/neo4j restart
TimeoutSec=120
Restart=on-failure
RestartSec=10
LimitNOFILE=60000
PIDFile=/var/run/neo4j/neo4j.pid

[Install]
WantedBy=multi-user.target
EOF
    
    # 重新加载systemd
    sudo systemctl daemon-reload
    sudo systemctl enable neo4j
    
    print_info "systemd服务创建完成"
}

# 查找 cypher-shell 的位置
find_cypher_shell() {
    local possible_paths=(
        "/opt/neo4j/bin/cypher-shell"
        "/usr/local/bin/cypher-shell"
        "/usr/bin/cypher-shell"
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
    
    # 最后尝试在 /opt/neo4j 目录下查找
    if [ -d "/opt/neo4j" ]; then
        local found_path=$(find /opt/neo4j -name "cypher-shell" -type f 2>/dev/null | head -1)
        if [ ! -z "$found_path" ]; then
            echo "$found_path"
            return 0
        fi
    fi
    
    return 1
}

# 安装APOC插件
install_apoc_plugin() {
    print_info "安装APOC插件..."
    
    # 根据操作系统设置插件版本
    if [ "$OS" = "macos" ] || [ "$OS" = "ubuntu" ]; then
        local APOC_VERSION="4.4.0.14"
    else
        local APOC_VERSION="4.4.0.14"
    fi
    
    local APOC_URL="https://github.com/neo4j-contrib/neo4j-apoc-procedures/releases/download/${APOC_VERSION}/apoc-${APOC_VERSION}-all.jar"
    
    # 确保插件目录存在
    if [ "$OS" = "macos" ]; then
        sudo mkdir -p "$NEO4J_PLUGINS_DIR"
    else
        sudo mkdir -p "$NEO4J_PLUGINS_DIR"
    fi
    
    # 下载APOC插件
    if sudo curl -fL "$APOC_URL" -o "${NEO4J_PLUGINS_DIR}/apoc-${APOC_VERSION}-all.jar"; then
        if [ "$OS" != "macos" ]; then
            sudo chown neo4j:neo4j "${NEO4J_PLUGINS_DIR}/apoc-${APOC_VERSION}-all.jar"
        fi
        
        # 添加APOC配置
        echo "" | sudo tee -a "$NEO4J_CONF"
        echo "# APOC配置" | sudo tee -a "$NEO4J_CONF"
        echo "dbms.security.procedures.unrestricted=apoc.*" | sudo tee -a "$NEO4J_CONF"
        echo "dbms.security.procedures.allowlist=apoc.*" | sudo tee -a "$NEO4J_CONF"
        
        print_info "APOC插件安装成功"
    else
        print_warning "APOC插件下载失败，跳过"
    fi
}

# 启动Neo4j服务
start_neo4j_service() {
    print_info "启动Neo4j服务..."
    
    if [ "$OS" = "macos" ]; then
        brew services restart neo4j
    elif [ "$OS" = "ubuntu" ]; then
        sudo systemctl restart neo4j
    else
        # Amazon Linux/CentOS
        if sudo systemctl start neo4j; then
            print_info "Neo4j服务启动成功"
        else
            print_warning "systemd启动失败，尝试手动启动..."
            if sudo -u neo4j env PATH="/usr/local/bin:/usr/bin:/bin:/opt/neo4j/bin" /opt/neo4j/bin/neo4j start; then
                print_info "Neo4j手动启动成功"
            else
                print_error "Neo4j启动失败"
                return 1
            fi
        fi
    fi
    
    return 0
}

# 等待Neo4j启动并测试连接
wait_for_neo4j() {
    print_info "等待Neo4j完全启动..."
    sleep 15
    
    # 测试连接
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if [ "$OS" = "amazonlinux" ] || [ "$OS" = "centos" ]; then
            local test_cmd="sudo -u neo4j env PATH=\"/usr/local/bin:/usr/bin:/bin:/opt/neo4j/bin\" $CYPHER_SHELL -u neo4j -p neo4j -d system --non-interactive \"RETURN 1;\""
        else
            local test_cmd="$CYPHER_SHELL -u neo4j -p neo4j -d system --non-interactive \"RETURN 1;\""
        fi
        
        if eval "$test_cmd" >/dev/null 2>&1; then
            print_info "Neo4j连接测试成功"
            return 0
        fi
        
        print_info "等待Neo4j启动... (尝试 $attempt/$max_attempts)"
        sleep 5
        ((attempt++))
    done
    
    print_error "Neo4j连接测试失败"
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
        if [ "$OS" = "ubuntu" ]; then
            sudo systemctl stop neo4j
        else
            sudo systemctl stop neo4j 2>/dev/null || sudo -u neo4j /opt/neo4j/bin/neo4j stop
        fi
        
        # 删除 Neo4j 数据目录
        if [ -d "/var/lib/neo4j/data" ]; then
            sudo rm -rf /var/lib/neo4j/data/databases
            sudo rm -rf /var/lib/neo4j/data/dbms
        fi
        
        # 重新启动服务
        start_neo4j_service
    fi
    
    # 等待服务重新启动
    print_info "等待 Neo4j 服务重新启动..."
    sleep 20
}

# 配置密码和用户
configure_password_and_users() {
    print_info "配置Neo4j用户和密码..."
    
    # 查找 cypher-shell
    CYPHER_SHELL=$(find_cypher_shell)
    if [ -z "$CYPHER_SHELL" ]; then
        print_error "找不到 cypher-shell，请确保 Neo4j 安装正确"
        return 1
    fi
    
    print_info "找到 cypher-shell: $CYPHER_SHELL"
    
    # 构造执行命令
    if [ "$OS" = "amazonlinux" ] || [ "$OS" = "centos" ]; then
        local exec_prefix="sudo -u neo4j env PATH=\"/usr/local/bin:/usr/bin:/bin:/opt/neo4j/bin\""
    else
        local exec_prefix=""
    fi
    
    # 尝试使用默认密码登录
    print_info "尝试使用默认密码登录..."
    if eval "$exec_prefix $CYPHER_SHELL -u neo4j -p neo4j -d system --non-interactive \"RETURN 1;\"" >/dev/null 2>&1; then
        print_info "默认密码登录成功"
    else
        print_warning "默认密码登录失败，可能密码已被修改"
        print_info "是否要重置 Neo4j 数据库？这将删除所有现有数据！"
        read -p "输入 'yes' 确认重置: " confirm
        
        if [ "$confirm" = "yes" ]; then
            reset_neo4j_password
            wait_for_neo4j || return 1
        else
            print_error "无法继续配置，请手动重置密码或提供正确的当前密码"
            return 1
        fi
    fi
    
    # 修改默认 neo4j 用户密码
    print_info "修改默认 neo4j 用户密码..."
    if eval "$exec_prefix $CYPHER_SHELL -u neo4j -p neo4j -d system --non-interactive \"ALTER CURRENT USER SET PASSWORD FROM 'neo4j' TO '$NEO4J_DEFAULT_PASSWORD';\""; then
        print_info "默认 neo4j 用户密码修改成功！"
        
        # 创建新用户（如果用户名不是 neo4j）
        if [ "$NEO4J_USER" != "neo4j" ]; then
            print_info "创建新用户: $NEO4J_USER"
            if eval "$exec_prefix $CYPHER_SHELL -u neo4j -p \"$NEO4J_DEFAULT_PASSWORD\" -d system --non-interactive \"CREATE USER \\\"$NEO4J_USER\\\" SET PASSWORD '$NEO4J_PASSWORD' CHANGE NOT REQUIRED;\""; then
                print_info "新用户创建成功！"
            else
                print_error "新用户创建失败，请手动创建"
            fi
        fi
    else
        print_error "默认用户密码修改失败，请手动修改密码"
        return 1
    fi
    
    return 0
}

# 验证APOC安装
verify_apoc_installation() {
    print_info "验证APOC插件安装..."
    
    # 构造执行命令
    if [ "$OS" = "amazonlinux" ] || [ "$OS" = "centos" ]; then
        local exec_prefix="sudo -u neo4j env PATH=\"/usr/local/bin:/usr/bin:/bin:/opt/neo4j/bin\""
    else
        local exec_prefix=""
    fi
    
    if eval "$exec_prefix $CYPHER_SHELL -u neo4j -p \"$NEO4J_DEFAULT_PASSWORD\" -d neo4j --non-interactive \"CALL apoc.help('meta');\"" >/dev/null 2>&1; then
        print_info "APOC插件安装成功！"
    else
        print_warning "APOC插件可能未正确安装，请检查插件目录和配置"
    fi
}

# 显示安装结果
show_result() {
    print_info "===== Neo4j 安装完成 ====="
    
    if [ "$OS" = "macos" ]; then
        print_info "Web界面: http://localhost:7474"
        print_info "Bolt连接: bolt://localhost:7687"
    else
        # 获取服务器IP
        local server_ip=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "your-server-ip")
        print_info "Web界面: http://localhost:7474 (本地) 或 http://$server_ip:7474 (远程)"
        print_info "Bolt连接: bolt://localhost:7687 (本地) 或 bolt://$server_ip:7687 (远程)"
    fi
    
    print_info "用户名: neo4j"
    print_info "密码: $NEO4J_DEFAULT_PASSWORD"
    
    if [ "$NEO4J_USER" != "neo4j" ]; then
        print_info "新用户名: $NEO4J_USER"
        print_info "新用户密码: $NEO4J_PASSWORD"
    fi
    
    print_info ""
    
    if [ "$OS" = "macos" ]; then
        print_info "服务管理命令:"
        print_info "  启动: brew services start neo4j"
        print_info "  停止: brew services stop neo4j"
        print_info "  重启: brew services restart neo4j"
    else
        print_info "服务管理命令:"
        print_info "  启动: sudo systemctl start neo4j"
        print_info "  停止: sudo systemctl stop neo4j"
        print_info "  重启: sudo systemctl restart neo4j"
        print_info "  状态: sudo systemctl status neo4j"
        print_info ""
        print_info "手动管理命令:"
        if [ "$OS" = "amazonlinux" ] || [ "$OS" = "centos" ]; then
            print_info "  启动: sudo -u neo4j /opt/neo4j/bin/neo4j start"
            print_info "  停止: sudo -u neo4j /opt/neo4j/bin/neo4j stop"
            print_info "  状态: sudo -u neo4j /opt/neo4j/bin/neo4j status"
        else
            print_info "  启动: sudo neo4j start"
            print_info "  停止: sudo neo4j stop"
            print_info "  状态: sudo neo4j status"
        fi
    fi
}

# 主函数
main() {
    print_info "开始安装Neo4j..."
    
    # 安全检查
    check_root
    check_system_health
    
    # 加载配置
    load_env
    
    # 检测操作系统
    OS=$(detect_os)
    print_info "检测到操作系统: $OS"
    
    # 根据操作系统安装
    case "$OS" in
        "macos")
            install_macos || exit 1
            ;;
        "ubuntu")
            install_ubuntu || exit 1
            ;;
        "amazonlinux"|"centos")
            install_amazonlinux || exit 1
            ;;
        *)
            print_error "不支持的操作系统: $OS"
            exit 1
            ;;
    esac
    
    # 通用安装步骤
    install_apoc_plugin
    start_neo4j_service || exit 1
    wait_for_neo4j || exit 1
    configure_password_and_users || exit 1
    verify_apoc_installation
    
    # 显示结果
    show_result
    
    print_info "Neo4j安装完成！"
}

# 运行主函数
main "$@" 