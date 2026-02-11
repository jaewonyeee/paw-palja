# Paw-Palja 배포 가이드 (초보자용)

> Frontend: **Cloudflare Pages** | Backend: **Amazon EC2** | AI: **Google Gemini 1.5 Flash**

이 가이드는 서버 배포가 처음인 분을 위해 작성되었습니다.
처음부터 끝까지 따라하면 서비스가 배포됩니다.

---

## 목차

- [Step 0: 사전 준비](#step-0-사전-준비)
- [Step 1: Google AI API 키 발급](#step-1-google-ai-api-키-발급)
- [Step 2: AWS EC2 인스턴스 생성](#step-2-aws-ec2-인스턴스-생성)
- [Step 3: EC2 서버 초기 설정](#step-3-ec2-서버-초기-설정)
- [Step 4: 프로젝트 배포 (EC2)](#step-4-프로젝트-배포-ec2)
- [Step 5: 도메인 연결 (Cloudflare → EC2)](#step-5-도메인-연결-cloudflare--ec2)
- [Step 6: SSL 인증서 설치](#step-6-ssl-인증서-설치)
- [Step 7: 프론트엔드 배포 (Cloudflare Pages)](#step-7-프론트엔드-배포-cloudflare-pages)
- [Step 8: 최종 확인](#step-8-최종-확인)
- [Step 9: CI/CD 자동 배포 설정](#step-9-cicd-자동-배포-설정)
- [문제 해결](#문제-해결)
- [비용 정리](#비용-정리)

---

## Step 0: 사전 준비

시작하기 전에 이것들이 필요합니다:

- [ ] **AWS 계정** — https://aws.amazon.com 에서 가입 (신용카드 필요, 프리 티어 1년 무료)
- [ ] **Cloudflare 계정** — 이미 도메인을 관리중이므로 있을 것
- [ ] **Google Cloud 계정** — https://aistudio.google.com 에서 API 키 발급
- [ ] **GitHub 계정** — 코드가 이미 push되어 있어야 함
- [ ] 본인 도메인 (예: `pawpalja.com`) — Cloudflare에서 관리중

### 도메인 구조 결정

```
pawpalja.com          → Cloudflare Pages (프론트엔드)
api.pawpalja.com      → EC2 서버 (백엔드 API)
```

> `pawpalja.com`은 본인 도메인으로 교체하세요.

---

## Step 1: Google AI API 키 발급

1. https://aistudio.google.com 접속
2. 좌측 메뉴 → **Get API key** 클릭
3. **Create API key** 클릭 → 새 프로젝트에서 생성
4. 생성된 API 키를 안전한 곳에 복사해두세요

### 유료 tier 활성화 (Gemini 1.5 Flash)

1. https://console.cloud.google.com/billing 접속
2. 결제 계정 생성 (신용카드 등록)
3. API 키가 속한 프로젝트에 결제 계정 연결
4. https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com 에서 API 활성화 확인

> 무료 tier도 하루 100만 토큰까지 사용 가능하지만, 속도 제한(15 RPM)이 있어서 유료 전환을 권장합니다.

---

## Step 2: AWS EC2 인스턴스 생성

### 2-1. AWS 콘솔 접속

1. https://console.aws.amazon.com 로그인
2. 상단 검색에 **EC2** 입력 → EC2 Dashboard 클릭
3. **리전 선택**: 우측 상단에서 `Asia Pacific (Seoul)` 선택 (ap-northeast-2)

### 2-2. 인스턴스 생성

1. **Launch Instance** (인스턴스 시작) 클릭
2. 설정:

| 항목 | 설정 값 |
|------|---------|
| **Name** | `pawpalja-server` |
| **OS** | Ubuntu Server 24.04 LTS (Free tier eligible) |
| **Instance type** | t3.micro (1 vCPU, 1 GiB RAM) — Free tier |
| **Key pair** | **Create new key pair** → 이름: `pawpalja-key` → RSA, .pem 선택 → 다운로드 |
| **Network settings** | Allow SSH, Allow HTTPS, Allow HTTP 모두 체크 |
| **Storage** | 30 GiB gp3 (Free tier 최대) |

3. **Launch instance** 클릭

> `.pem` 키 파일은 절대 잃어버리면 안 됩니다! 안전한 곳에 보관하세요.

### 2-3. Elastic IP 할당 (고정 IP)

EC2 인스턴스는 재시작하면 IP가 바뀝니다. 고정 IP를 할당해야 합니다.

1. 좌측 메뉴 → **Elastic IPs** 클릭
2. **Allocate Elastic IP address** 클릭 → **Allocate**
3. 생성된 IP 선택 → **Actions** → **Associate Elastic IP address**
4. Instance: `pawpalja-server` 선택 → **Associate**
5. 이 IP를 기억해두세요 (예: `13.125.xxx.xxx`)

### 2-4. 보안 그룹 확인

1. EC2 Dashboard → 인스턴스 선택 → **Security** 탭
2. Security group 클릭 → **Inbound rules** 확인:

| Type | Port | Source | 용도 |
|------|------|--------|------|
| SSH | 22 | My IP | 서버 접속 |
| HTTP | 80 | 0.0.0.0/0 | 웹 (리다이렉트용) |
| HTTPS | 443 | 0.0.0.0/0 | 웹 (실제 서비스) |

> 이미 인스턴스 생성 시 체크했다면 설정되어 있을 것입니다.

---

## Step 3: EC2 서버 초기 설정

### 3-1. SSH 접속

```bash
# Windows (PowerShell)
ssh -i "C:\Users\당신\Downloads\pawpalja-key.pem" ubuntu@13.125.xxx.xxx

# Mac/Linux
chmod 400 ~/Downloads/pawpalja-key.pem
ssh -i ~/Downloads/pawpalja-key.pem ubuntu@13.125.xxx.xxx
```

> `13.125.xxx.xxx`를 본인 Elastic IP로 교체하세요.

### 3-2. 시스템 업데이트

```bash
sudo apt update && sudo apt upgrade -y
```

### 3-3. Docker 설치

```bash
# Docker 공식 설치 (한 줄씩 실행)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# ubuntu 사용자에게 Docker 권한 부여
sudo usermod -aG docker ubuntu

# Docker Compose 플러그인 확인
docker compose version

# 변경사항 적용을 위해 재접속
exit
```

다시 SSH 접속:
```bash
ssh -i pawpalja-key.pem ubuntu@13.125.xxx.xxx
```

### 3-4. PostgreSQL 확인 (Docker 안에서 실행됨)

PostgreSQL은 `docker-compose.ec2.yml`을 통해 Docker 컨테이너로 실행되므로 별도 설치가 필요 없습니다.

### 3-5. Nginx 설치

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

### 3-6. Swap 메모리 설정 (중요! t3.micro는 RAM 1GB)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 재부팅 후에도 유지
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

> Docker 빌드 시 메모리가 부족할 수 있어서 2GB swap은 필수입니다.

---

## Step 4: 프로젝트 배포 (EC2)

### 4-1. 프로젝트 클론

```bash
cd /opt
sudo mkdir pawpalja
sudo chown ubuntu:ubuntu pawpalja
cd pawpalja

git clone https://github.com/당신의계정/pawpalja.git .
```

> GitHub private repo라면: `git clone https://토큰@github.com/계정/pawpalja.git .`
> Personal Access Token은 GitHub → Settings → Developer settings → Tokens에서 생성

### 4-2. 환경변수 설정

```bash
cp .env.template .env
nano .env
```

**반드시 수정해야 할 값들:**

```env
# LLM (Google Gemini 1.5 Flash)
LLM_PROVIDER=google
GOOGLE_API_KEY=여기에_Step1에서_받은_키_입력
GOOGLE_MODEL_NAME=gemini-1.5-flash

# 보안
ADMIN_PASSWORD=강력한_관리자_비밀번호
JWT_SECRET=여기에_긴_랜덤_문자열_넣기

# CORS (프론트엔드 도메인 — Step 7 이후 정확한 URL로 수정)
ALLOWED_ORIGINS=https://pawpalja.com,https://www.pawpalja.com

# DB 비밀번호
DB_PASSWORD=강력한_DB_비밀번호

# 로깅
LOG_LEVEL=INFO
LOG_FORMAT=json
```

**JWT_SECRET 생성 방법:**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

> `nano` 에디터: 수정 후 `Ctrl+O` (저장) → `Enter` → `Ctrl+X` (나가기)

### 4-3. Docker 빌드 및 실행

```bash
docker compose -f docker-compose.ec2.yml up -d --build
```

> 첫 빌드는 5-10분 걸립니다. `t3.micro`에서 swap 없이 하면 메모리 부족으로 실패할 수 있습니다.

### 4-4. 확인

```bash
# 컨테이너 상태 확인
docker compose -f docker-compose.ec2.yml ps

# 로그 확인
docker compose -f docker-compose.ec2.yml logs backend

# API 동작 확인
curl http://localhost:8000/health
# 응답: {"status":"ok"}
```

---

## Step 5: 도메인 연결 (Cloudflare → EC2)

### 5-1. Cloudflare DNS 설정

1. https://dash.cloudflare.com 로그인
2. 본인 도메인 선택
3. **DNS** → **Records** 탭

**A 레코드 추가:**

| Type | Name | Content | Proxy status |
|------|------|---------|-------------|
| A | `api` | `13.125.xxx.xxx` (EC2 Elastic IP) | **DNS only** (회색 구름) |

> **중요**: `api` 서브도메인은 **프록시 OFF** (회색 구름 🔘)로 설정하세요.
> SSL 인증서를 EC2에서 직접 관리하기 때문에 Cloudflare 프록시를 사용하면 충돌합니다.

### 5-2. 확인

DNS 전파에 1-5분 걸립니다.

```bash
# 로컬 PC에서 확인
nslookup api.pawpalja.com
# → 13.125.xxx.xxx 가 나오면 성공
```

---

## Step 6: SSL 인증서 설치

EC2 서버에 SSH로 접속한 상태에서:

### 6-1. Certbot 설치

```bash
sudo apt install -y certbot
```

### 6-2. 인증서 발급

```bash
# Nginx 잠시 정지 (80번 포트 사용하기 위해)
sudo systemctl stop nginx

# SSL 인증서 발급 (도메인을 본인 것으로 교체!)
sudo certbot certonly --standalone -d api.pawpalja.com --agree-tos --email your@email.com
```

성공하면:
```
Certificate is saved at: /etc/letsencrypt/live/api.pawpalja.com/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/api.pawpalja.com/privkey.pem
```

### 6-3. Nginx 설정 적용

```bash
# 프로젝트의 nginx 설정 복사
sudo cp /opt/pawpalja/nginx/ec2.conf /etc/nginx/sites-available/pawpalja
```

**도메인 교체:**
```bash
sudo sed -i 's/YOUR_DOMAIN/api.pawpalja.com/g' /etc/nginx/sites-available/pawpalja
```

> `api.pawpalja.com`을 본인 도메인으로 교체하세요.

```bash
# 기본 설정 제거 + 새 설정 활성화
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/pawpalja /etc/nginx/sites-enabled/

# 설정 검증
sudo nginx -t

# Nginx 시작
sudo systemctl start nginx
```

### 6-4. SSL 자동 갱신 설정

```bash
# 인증서 자동 갱신 테스트
sudo certbot renew --dry-run

# cron으로 자동 갱신 (매일 새벽 3시)
echo "0 3 * * * certbot renew --quiet --pre-hook 'systemctl stop nginx' --post-hook 'systemctl start nginx'" | sudo tee /etc/cron.d/certbot-renew
```

### 6-5. HTTPS 확인

```bash
curl https://api.pawpalja.com/health
# 응답: {"status":"ok"}
```

---

## Step 7: 프론트엔드 배포 (Cloudflare Pages)

### 7-1. Cloudflare Pages 프로젝트 생성

1. https://dash.cloudflare.com 로그인
2. 좌측 메뉴 → **Workers & Pages** 클릭
3. **Create** → **Pages** 탭 → **Connect to Git**

### 7-2. GitHub 연결

1. **GitHub** 선택 → GitHub 계정 연결 (처음이면 인증 필요)
2. **pawpalja** 리포지토리 선택
3. **Begin setup** 클릭

### 7-3. 빌드 설정

| 항목 | 값 |
|------|------|
| **Project name** | `pawpalja` (원하는 이름) |
| **Production branch** | `main` |
| **Framework preset** | `None` (직접 설정) |
| **Build command** | `cd frontend && npm ci && npm run build` |
| **Build output directory** | `frontend/dist` |
| **Root directory** | `/` (비워두기) |

### 7-4. 환경 변수 설정 (중요!)

**Environment variables** 섹션에서 추가:

| Variable name | Value |
|---------------|-------|
| `VITE_API_BASE_URL` | `https://api.pawpalja.com/api/v1` |
| `NODE_VERSION` | `20` |

> `api.pawpalja.com`을 본인 백엔드 도메인으로 교체하세요.

### 7-5. 배포

**Save and Deploy** 클릭 → 빌드가 시작됩니다 (2-3분 소요)

배포가 완료되면 `https://pawpalja.pages.dev` 같은 URL이 생성됩니다.

### 7-6. 커스텀 도메인 연결

1. Cloudflare Pages 프로젝트 → **Custom domains** 탭
2. **Set up a custom domain** 클릭
3. `pawpalja.com` 입력 → **Continue**
4. Cloudflare가 자동으로 DNS CNAME 레코드를 추가합니다 → **Activate domain**
5. (선택) `www.pawpalja.com`도 같은 방식으로 추가

> DNS 활성화에 몇 분 걸릴 수 있습니다.

### 7-7. CORS 설정 업데이트 (EC2)

프론트엔드 도메인이 확정되었으면 EC2의 `.env`를 업데이트:

```bash
# EC2에 SSH 접속 후
cd /opt/pawpalja
nano .env
```

`ALLOWED_ORIGINS`를 정확한 프론트엔드 URL로 수정:
```env
ALLOWED_ORIGINS=https://pawpalja.com,https://www.pawpalja.com,https://pawpalja.pages.dev
```

```bash
# 백엔드 재시작
docker compose -f docker-compose.ec2.yml restart backend
```

---

## Step 8: 최종 확인

### 8-1. 백엔드 API

```bash
curl https://api.pawpalja.com/health
# → {"status":"ok"}
```

### 8-2. 프론트엔드

브라우저에서 `https://pawpalja.com` 접속:
- Onboarding 페이지가 보이면 성공
- 회원가입 시도 → 로그인 → 일기 생성 테스트

### 8-3. 일기 생성 테스트

1. 회원가입 (아이디/비밀번호/닉네임/강아지정보)
2. 일기 작성 (기분/밥/산책/대변/메모)
3. AI 일기가 생성되면 LLM 연결 성공!

### 8-4. 문제가 있다면

```bash
# EC2에서 로그 확인
docker compose -f docker-compose.ec2.yml logs -f backend
```

---

## Step 9: CI/CD 자동 배포 설정

`git push`만 하면 자동으로 배포되도록 설정합니다.

### 9-1. 프론트엔드 자동 배포 (Cloudflare Pages)

**이미 완료!** Step 7에서 GitHub 연결을 했으므로, `main` 브랜치에 push하면 Cloudflare Pages가 자동으로 빌드 + 배포합니다.

### 9-2. 백엔드 자동 배포 (GitHub Actions → EC2)

#### EC2에 배포 전용 SSH 키 생성

```bash
# EC2 서버에서 실행
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_deploy -N ""

# 공개키를 authorized_keys에 추가
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys

# 비밀키 내용 확인 (이걸 GitHub에 등록합니다)
cat ~/.ssh/github_deploy
```

#### GitHub Secrets 등록

1. GitHub → 본인 리포지토리 → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** 클릭하여 3개 등록:

| Secret name | Value |
|-------------|-------|
| `EC2_HOST` | EC2 Elastic IP (예: `13.125.xxx.xxx`) |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | EC2에서 생성한 비밀키 내용 (`cat ~/.ssh/github_deploy` 결과 전체) |

#### GitHub Environments 설정

1. GitHub → Settings → **Environments** → **New environment**
2. Name: `production` → **Configure environment**
3. (선택) **Required reviewers** 추가 — push 시 승인 후 배포되게 하려면

### 9-3. 자동 배포 테스트

```bash
# 로컬 PC에서
git add .
git commit -m "test: CI/CD auto deploy"
git push origin main
```

GitHub → **Actions** 탭에서 배포 진행 상황을 확인할 수 있습니다.

### 9-4. 배포 흐름 요약

```
git push origin main
    │
    ├─ Cloudflare Pages (프론트엔드)
    │   └─ 자동 감지 → npm run build → 배포 완료 (2-3분)
    │
    └─ GitHub Actions (백엔드)
        ├─ Step 1: 코드 린트 검사
        ├─ Step 2: 프론트엔드 빌드 검증
        └─ Step 3: EC2에 SSH → git pull → docker 재빌드 → 재시작
```

---

## 문제 해결

### "Docker 빌드 중 killed" 에러 (메모리 부족)

```bash
# swap이 활성화되어 있는지 확인
free -h
# Swap이 0이면 Step 3-6의 swap 설정을 다시 하세요
```

### "CORS error" 에러

프론트엔드에서 API 호출 시 CORS 에러가 나면:
```bash
# EC2에서 .env의 ALLOWED_ORIGINS 확인
cat /opt/pawpalja/.env | grep ALLOWED
# 프론트엔드 도메인이 정확히 포함되어 있는지 확인
# https:// 포함, 끝에 슬래시 없이!
```

### "502 Bad Gateway" 에러

```bash
# 백엔드 컨테이너가 실행중인지 확인
docker compose -f docker-compose.ec2.yml ps

# 백엔드 로그 확인
docker compose -f docker-compose.ec2.yml logs backend

# 포트 확인
curl http://localhost:8000/health
```

### "SSL 인증서 만료" 에러

```bash
# 인증서 상태 확인
sudo certbot certificates

# 수동 갱신
sudo systemctl stop nginx
sudo certbot renew
sudo systemctl start nginx
```

### "DB connection refused" 에러

```bash
# PostgreSQL 컨테이너 확인
docker compose -f docker-compose.ec2.yml ps db
docker compose -f docker-compose.ec2.yml logs db
```

### EC2 재부팅 후 서비스 자동 시작

```bash
# Docker 자동 시작 설정
sudo systemctl enable docker

# 재부팅 후 컨테이너 자동 시작은 docker-compose.ec2.yml의
# restart: unless-stopped 설정으로 이미 처리됨
```

---

## 비용 정리

| 항목 | 월 비용 | 비고 |
|------|---------|------|
| **EC2 t3.micro** | **$0** | 프리 티어 12개월 (이후 ~$8/월) |
| **Elastic IP** | **$0** | EC2에 연결되어 있으면 무료 |
| **Cloudflare Pages** | **$0** | 무료 플랜 (500 빌드/월) |
| **Cloudflare DNS** | **$0** | 무료 |
| **Google Gemini 1.5 Flash** | **~$3-5** | 100명 기준 월 추정 |
| **도메인** | **~$10-15/년** | 이미 보유중 |
| **합계** | **~$3-5/월** | 프리 티어 기간 중 |

> 프리 티어 종료 후: EC2 $8 + Gemini $5 = **~$13/월**

---

## 서버 관리 치트시트

```bash
# EC2 SSH 접속
ssh -i pawpalja-key.pem ubuntu@13.125.xxx.xxx

# 서비스 상태 확인
cd /opt/pawpalja
docker compose -f docker-compose.ec2.yml ps

# 로그 실시간 보기
docker compose -f docker-compose.ec2.yml logs -f backend

# 서비스 재시작
docker compose -f docker-compose.ec2.yml restart backend

# 완전 재빌드
docker compose -f docker-compose.ec2.yml up -d --build

# 환경변수 수정 후 재시작
nano .env
docker compose -f docker-compose.ec2.yml restart backend

# 디스크 사용량 확인
df -h

# 메모리 사용량 확인
free -h

# Docker 이미지 정리
docker image prune -f
docker system prune -f
```
