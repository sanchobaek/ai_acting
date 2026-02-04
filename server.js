const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

// .env 파일 로드
function loadEnv() {
    try {
        const envPath = path.join(__dirname, '.env');
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                process.env[key.trim()] = valueParts.join('=').trim();
            }
        });
        console.log('[ENV] 환경 변수 로드 완료');
    } catch (e) {
        console.log('[ENV] .env 파일 없음, 기본값 사용');
    }
}
loadEnv();

const crypto = require('crypto');

const PORT = 3000;

// Kling JWT 토큰 생성
function generateKlingJWT() {
    const accessKey = process.env.KLING_ACCESS_KEY;
    const secretKey = process.env.KLING_SECRET_KEY;

    if (!accessKey || !secretKey) return null;

    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: accessKey,
        exp: now + 1800,
        nbf: now - 5
    };

    const base64url = (obj) => {
        return Buffer.from(JSON.stringify(obj))
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    };

    const headerEncoded = base64url(header);
    const payloadEncoded = base64url(payload);
    const signature = crypto
        .createHmac('sha256', secretKey)
        .update(`${headerEncoded}.${payloadEncoded}`)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    return `${headerEncoded}.${payloadEncoded}.${signature}`;
}
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
    // CORS 프리플라이트 처리
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // 설정 API (클라이언트용)
    if (req.url === '/api/config' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            voiceId: process.env.ELEVENLABS_VOICE_ID || ''
        }));
        return;
    }

    // 비디오에서 오디오 추출 API
    if (req.url === '/api/extract-audio' && req.method === 'POST') {
        return extractAudioFromVideo(req, res);
    }

    // API 프록시
    if (req.url.startsWith('/api/kling/')) {
        return proxyToKling(req, res);
    }
    if (req.url.startsWith('/api/eleven/')) {
        return proxyToElevenLabs(req, res);
    }

    // 정적 파일 서빙
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

function proxyToKling(req, res) {
    const targetPath = req.url.replace('/api/kling', '');
    const targetUrl = `https://api-singapore.klingai.com${targetPath}`;

    // 서버 측 JWT 토큰 생성
    const token = generateKlingJWT();
    proxyRequest(req, res, targetUrl, { 'Authorization': `Bearer ${token}` });
}

function proxyToElevenLabs(req, res) {
    const targetPath = req.url.replace('/api/eleven', '');
    const targetUrl = `https://api.elevenlabs.io${targetPath}`;

    // 서버 측 API 키 사용
    const serverApiKey = process.env.ELEVENLABS_API_KEY;
    proxyRequest(req, res, targetUrl, { 'xi-api-key': serverApiKey });
}

function proxyRequest(req, res, targetUrl, extraHeaders = {}) {
    const url = new URL(targetUrl);

    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', () => {
        body = Buffer.concat(body);

        // 필요한 헤더만 전달
        const headers = {
            'host': url.hostname,
            'content-type': req.headers['content-type'] || 'application/json'
        };

        // Authorization 헤더 전달
        if (req.headers['authorization']) {
            headers['authorization'] = req.headers['authorization'];
        }

        // 서버 측 추가 헤더 (API 키 등)
        Object.assign(headers, extraHeaders);

        if (body.length > 0) {
            headers['content-length'] = body.length;
        }

        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method: req.method,
            headers: headers
        };

        console.log(`[Proxy] ${req.method} ${targetUrl}`);
        console.log(`[Proxy] Authorization: ${headers['authorization'] ? 'present' : 'missing'}`);

        const proxyReq = https.request(options, proxyRes => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        });

        proxyReq.on('error', err => {
            console.error('Proxy error:', err);
            res.writeHead(500);
            res.end('Proxy Error');
        });

        if (body.length > 0) {
            proxyReq.write(body);
        }
        proxyReq.end();
    });
}

// 비디오에서 오디오 추출
function extractAudioFromVideo(req, res) {
    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', async () => {
        try {
            const data = JSON.parse(Buffer.concat(body).toString());
            const videoUrl = data.video_url;

            if (!videoUrl) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'video_url is required' }));
                return;
            }

            const tmpDir = os.tmpdir();
            const timestamp = Date.now();
            const audioPath = path.join(tmpDir, `audio_${timestamp}.mp3`);

            console.log(`[Extract] Extracting audio from: ${videoUrl}`);

            // ffmpeg로 오디오 추출
            const cmd = `ffmpeg -i "${videoUrl}" -vn -acodec libmp3lame -q:a 2 -y "${audioPath}"`;

            exec(cmd, { timeout: 60000 }, (error, stdout, stderr) => {
                if (error) {
                    console.error('[Extract] Error:', stderr);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to extract audio' }));
                    return;
                }

                // 파일 읽고 base64로 변환
                fs.readFile(audioPath, (err, audioData) => {
                    // 임시 파일 삭제
                    fs.unlink(audioPath, () => {});

                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to read audio file' }));
                        return;
                    }

                    const base64Audio = audioData.toString('base64');
                    console.log(`[Extract] Audio extracted successfully, size: ${audioData.length} bytes`);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        audio_base64: base64Audio,
                        content_type: 'audio/mpeg'
                    }));
                });
            });
        } catch (e) {
            console.error('[Extract] Parse error:', e);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
    });
}

server.listen(PORT, () => {
    console.log(`서버 실행 중: http://localhost:${PORT}`);
});
