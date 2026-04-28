#!/usr/bin/env python3
import paramiko
import tarfile
import io
import os

SERVER = "124.222.118.77"
PORT = 22
USER = "ubuntu"
PASSWORD = "Keywords314"
LOCAL_DIR = "/home/walnut/canteen_index"

def deploy():
    import time
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    print(f"正在连接到 {SERVER}...")
    max_retries = 5
    for attempt in range(max_retries):
        try:
            client.connect(SERVER, port=PORT, username=USER, password=PASSWORD, timeout=10)
            break
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"连接失败，5秒后重试... ({attempt + 1}/{max_retries})")
                time.sleep(5)
            else:
                print(f"连接失败: {e}")
                return

    # 打包 server 目录（排除 node_modules 和 data.json、users.json）
    print("正在打包文件...")
    tar_buffer = io.BytesIO()
    with tarfile.open(fileobj=tar_buffer, mode='w:gz') as tar:
        server_path = os.path.join(LOCAL_DIR, "server")
        for root, dirs, files in os.walk(server_path):
            # 排除 node_modules
            if 'node_modules' in root:
                continue
            for file in files:
                # 跳过 data.json 和 users.json
                if file in ['data.json', 'users.json']:
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.join("server", os.path.relpath(file_path, server_path))
                tar.add(file_path, arcname=arcname)

    tar_buffer.seek(0)
    tar_data = tar_buffer.getvalue()

    # 上传 tar.gz
    print("正在上传到服务器...")
    sftp = client.open_sftp()
    sftp.putfo(io.BytesIO(tar_data), "/tmp/canteen_server.tar.gz")
    sftp.close()

    # 在服务器上解压到 /home/ubuntu/canteen/
    print("正在部署后端到 /home/ubuntu/canteen/...")
    stdin, stdout, stderr = client.exec_command(
        "tar -xzf /tmp/canteen_server.tar.gz -C /home/ubuntu/canteen/ && rm /tmp/canteen_server.tar.gz"
    )
    exit_status = stdout.channel.recv_exit_status()
    if exit_status == 0:
        print("后端部署成功！")

        # 重启后端服务
        print("正在重启后端服务...")
        stdin, stdout, stderr = client.exec_command("cd /home/ubuntu/canteen && pkill -f 'node index.js' ; nohup node index.js > /tmp/node.log 2>&1 &")
        stdout.channel.recv_exit_status()

        # 检查服务状态
        stdin, stdout, stderr = client.exec_command("sleep 1 && curl -s http://localhost:3000/api/dishes | head -c 100")
        result = stdout.read().decode()
        if '[' in result:
            print("后端服务运行正常！")
        else:
            print(f"后端可能未正常运行: {result[:200]}")

        # 部署前端
        print("正在部署前端到 /var/www/html/test/dist/...")
        # 先删除旧文件
        stdin, stdout, stderr = client.exec_command("sudo rm -rf /var/www/html/test/dist/*")
        stdout.channel.recv_exit_status()

        # 创建 tar 并上传
        tar_buffer = io.BytesIO()
        client_path = os.path.join(LOCAL_DIR, "client")
        with tarfile.open(fileobj=tar_buffer, mode='w:gz') as tar:
            dist_path = os.path.join(client_path, "dist")
            for root, dirs, files in os.walk(dist_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, dist_path)
                    tar.add(file_path, arcname=arcname)
        tar_buffer.seek(0)

        sftp = client.open_sftp()
        sftp.putfo(io.BytesIO(tar_buffer.getvalue()), "/tmp/canteen_frontend.tar.gz")
        sftp.close()

        # 解压到目标目录
        stdin, stdout, stderr = client.exec_command("cd /var/www/html/test/dist && sudo tar -xzf /tmp/canteen_frontend.tar.gz && rm /tmp/canteen_frontend.tar.gz")
        exit_status = stdout.channel.recv_exit_status()
        if exit_status == 0:
            print("前端部署成功！")
        else:
            print(f"前端部署失败: {stderr.read().decode()}")

    else:
        print(f"部署失败: {stderr.read().decode()}")

    client.close()

if __name__ == "__main__":
    deploy()
