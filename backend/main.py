import os
import time
import base64
import tempfile
import asyncio
from pathlib import Path

import jwt
import httpx
from fastapi import FastAPI, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from dotenv import load_dotenv

# .env 로드 (프로젝트 루트의 .env)
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Kling JWT ---

def generate_kling_jwt() -> str | None:
    access_key = os.getenv("KLING_ACCESS_KEY")
    secret_key = os.getenv("KLING_SECRET_KEY")
    if not access_key or not secret_key:
        return None
    now = int(time.time())
    payload = {"iss": access_key, "exp": now + 1800, "nbf": now - 5}
    return jwt.encode(payload, secret_key, algorithm="HS256")


# --- 1. GET /api/config ---

@app.get("/api/config")
async def get_config():
    # VIDEO_SOURCES 파싱: "이름::URL,이름::URL" 형식
    raw = os.getenv("VIDEO_SOURCES", "")
    video_sources = []
    for entry in raw.split(","):
        entry = entry.strip()
        if "::" in entry:
            label, url = entry.split("::", 1)
            video_sources.append({"label": label.strip(), "url": url.strip()})
    return {
        "voiceId": os.getenv("ELEVENLABS_VOICE_ID", ""),
        "videoSources": video_sources,
    }


# --- 2. POST /api/create-voice ---

@app.post("/api/create-voice")
async def create_voice(
    name: str = Form(...),
    files: UploadFile = File(...),
    remove_background_noise: str = Form(None),
):
    api_key = os.getenv("ELEVENLABS_API_KEY")

    file_content = await files.read()
    filename = files.filename or "voice_sample.wav"
    content_type = files.content_type or "audio/wav"

    form_data = {
        "name": (None, name),
        "files": (filename, file_content, content_type),
    }
    if remove_background_noise == "true":
        form_data["remove_background_noise"] = (None, "true")

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.elevenlabs.io/v1/voices/add",
            files=form_data,
            headers={"xi-api-key": api_key},
        )

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type="application/json",
    )


# --- 3. POST /api/extract-audio ---

@app.post("/api/extract-audio")
async def extract_audio(request: Request):
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    video_url = data.get("video_url")
    if not video_url:
        return JSONResponse({"error": "video_url is required"}, status_code=400)

    tmp_path = os.path.join(tempfile.gettempdir(), f"audio_{int(time.time() * 1000)}.mp3")

    cmd = f'ffmpeg -i "{video_url}" -vn -acodec libmp3lame -q:a 2 -y "{tmp_path}"'

    try:
        proc = await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)

        if proc.returncode != 0:
            return JSONResponse(
                {"error": "Failed to extract audio"},
                status_code=500,
            )

        with open(tmp_path, "rb") as f:
            audio_data = f.read()

        audio_base64 = base64.b64encode(audio_data).decode("utf-8")
        return {"audio_base64": audio_base64, "content_type": "audio/mpeg"}

    except asyncio.TimeoutError:
        return JSONResponse({"error": "ffmpeg timeout"}, status_code=500)
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


# --- 4. Kling 프록시: /api/kling/{path} ---

@app.api_route("/api/kling/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_kling(request: Request, path: str):
    token = generate_kling_jwt()
    target_url = f"https://api-singapore.klingai.com/{path}"
    if request.url.query:
        target_url += f"?{request.url.query}"

    body = await request.body()
    headers = {"Authorization": f"Bearer {token}"}
    if request.headers.get("content-type"):
        headers["Content-Type"] = request.headers["content-type"]

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.request(
            method=request.method,
            url=target_url,
            content=body if body else None,
            headers=headers,
        )

    # 응답 헤더 중 content-type 전달
    response_content_type = resp.headers.get("content-type", "application/json")
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=response_content_type,
    )


# --- 5. ElevenLabs 프록시: /api/eleven/{path} ---

@app.api_route("/api/eleven/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_eleven(request: Request, path: str):
    api_key = os.getenv("ELEVENLABS_API_KEY")
    target_url = f"https://api.elevenlabs.io/{path}"
    if request.url.query:
        target_url += f"?{request.url.query}"

    body = await request.body()
    headers = {"xi-api-key": api_key}
    if request.headers.get("content-type"):
        headers["Content-Type"] = request.headers["content-type"]

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.request(
            method=request.method,
            url=target_url,
            content=body if body else None,
            headers=headers,
        )

    response_content_type = resp.headers.get("content-type", "application/json")
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=response_content_type,
    )


# --- 서버 실행 ---

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
