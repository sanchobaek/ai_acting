# AI Acting Studio

이미지와 영상을 조합하여 새로운 영상을 만들고, AI 목소리를 입혀주는 웹 애플리케이션입니다.

## 주요 기능

- **Motion Control 비디오 생성**: 이미지와 참조 비디오를 조합하여 새로운 비디오 생성 (Kling AI)
- **AI 목소리 변환**: 음성을 등록된 AI 목소리로 변환 (ElevenLabs Speech-to-Speech)
- **립싱크**: 생성된 비디오에 변환된 음성을 동기화

## 🚀 Amazon Linux 2023 배포 가이드 (Backend)

EC2 인스턴스에 접속한 후 아래 순서대로 진행하세요.

### 1. 필수 패키지 설치 (Git, Python, Pip)
```bash
sudo dnf update -y
sudo dnf install git python3 python3-pip -y
```

### 2. ffmpeg 설치 (비디오 처리 필수)
Amazon Linux 2023 기본 레포지토리에는 ffmpeg가 없으므로 정적 바이너리를 설치합니다.
```bash
wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
tar xvf ffmpeg-release-amd64-static.tar.xz
sudo mv ffmpeg-*-static/ffmpeg /usr/local/bin/
sudo mv ffmpeg-*-static/ffprobe /usr/local/bin/
# 설치 확인
ffmpeg -version
```

### 3. 저장소 클론 및 환경 설정
```bash
git clone https://github.com/YOUR_USERNAME/ai-acting-studio.git
cd ai-acting-studio

# .env 파일 생성 및 수정
cp .env.example .env
vi .env  # API 키 입력 (KLING, ELEVENLABS 등)
```

### 4. 백엔드 실행 (FastAPI)
```bash
cd backend
pip install -r requirements.txt

# 백그라운드에서 실행 (3000번 포트)
nohup uvicorn main:app --host 0.0.0.0 --port 3000 &
```
*주의: EC2 보안 그룹에서 3000번 포트를 열어주세요.*

---

## 🌐 프론트엔드 배포 (S3)

프론트엔드는 S3 정적 웹 호스팅을 사용하며, 빌드 시 EC2 백엔드 주소를 주입해야 합니다.

### 1. 환경 변수 설정 (로컬 PC에서 작업)
`frontend/.env` 파일을 생성하고 EC2의 퍼블릭 IP를 입력합니다.
```
VITE_API_URL=http://[EC2-퍼블릭-IP]:3000
```

### 2. 빌드 및 S3 업로드
```bash
cd frontend
npm install
npm run build
# 생성된 dist 폴더의 모든 파일을 S3 버킷에 업로드
```

---

## 필수 요구 사항
- **Python** 3.9 이상
- **ffmpeg** (필수)
- **API Keys**: Kling AI, ElevenLabs

## 프로젝트 구조
```
ai-acting-studio/
├── backend/            # Python FastAPI 서버
├── frontend/           # React (Vite) 프론트엔드
├── server.js           # Node.js 통합 서버 (선택 사항)
└── .env                # API 키 및 설정
```

## 라이선스
MIT License
