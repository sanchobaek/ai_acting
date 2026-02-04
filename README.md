# AI Acting Studio

이미지와 영상을 조합하여 새로운 영상을 만들고, AI 목소리를 입혀주는 웹 애플리케이션입니다.

## 주요 기능

- **Motion Control 비디오 생성**: 이미지와 참조 비디오를 조합하여 새로운 비디오 생성 (Kling AI)
- **AI 목소리 변환**: 음성을 등록된 AI 목소리로 변환 (ElevenLabs Speech-to-Speech)
- **립싱크**: 생성된 비디오에 변환된 음성을 동기화

## 설치 방법

### 1. 저장소 클론

```bash
git clone https://github.com/YOUR_USERNAME/ai-acting-studio.git
cd ai-acting-studio
```

### 2. 환경 변수 설정

`.env.example` 파일을 복사하여 `.env` 파일을 생성하고, API 키를 입력합니다.

```bash
cp .env.example .env
```

`.env` 파일 내용:

```
# Kling AI API
KLING_ACCESS_KEY=your_kling_access_key_here
KLING_SECRET_KEY=your_kling_secret_key_here

# ElevenLabs API
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=your_voice_id_here
```

### 3. 서버 실행

```bash
node server.js
```

### 4. 브라우저에서 접속

```
http://localhost:3000
```

## 필수 요구 사항

- **Node.js** v18 이상
- **ffmpeg** (비디오에서 오디오 추출에 필요)
  ```bash
  # macOS
  brew install ffmpeg

  # Ubuntu
  sudo apt install ffmpeg
  ```

## API 키 발급

### Kling AI
1. [Kling AI Platform](https://klingai.com) 접속
2. 계정 생성 후 API 키 발급

### ElevenLabs
1. [ElevenLabs](https://elevenlabs.io) 접속
2. 계정 생성 후 API 키 발급
3. Voice Lab에서 목소리 클론 후 Voice ID 복사

## 사용 방법

### 비디오 생성

1. 이미지 업로드 또는 URL 입력
2. 참조 비디오 URL 입력 (직접 다운로드 가능한 .mp4/.mov URL)
3. 캐릭터 방향 선택
   - 이미지 방향: 최대 10초
   - 비디오 방향: 최대 30초
4. "비디오 생성하기" 클릭

### 목소리 변환 및 립싱크

1. 작업 목록에서 생성된 비디오의 "목소리 입히기" 클릭
2. "동영상 음성 → 내 목소리로 변환" 선택
3. "립싱크 시작" 클릭

## 프로젝트 구조

```
ai-acting-studio/
├── index.html          # 메인 HTML
├── script.js           # 클라이언트 메인 스크립트
├── style.css           # 스타일시트
├── server.js           # Node.js 프록시 서버
├── .env                # 환경 변수 (Git 제외)
├── .env.example        # 환경 변수 예시
├── video_gen/
│   └── kling_api.js    # Kling AI API 모듈
├── voice_change/
│   └── elevenlabs_api.js # ElevenLabs API 모듈
└── utils/
    ├── auth.js         # JWT 인증 유틸리티
    └── file_helpers.js # 파일 처리 유틸리티
```

## 라이선스

MIT License
