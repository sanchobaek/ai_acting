// 메인 스크립트 - 모듈형 아키텍처
import * as KlingAPI from './video_gen/kling_api.js';
import * as ElevenLabsAPI from './voice_change/elevenlabs_api.js';
import * as FileHelpers from './utils/file_helpers.js';

// 전역 상태 (간단하게 관리)
let generatedAudioBlob = null;
let myVoiceId = ''; // 서버에서 로드됨

// UI 요소 로드 및 이벤트 리스너 설정
window.addEventListener('load', async () => {
    // 서버에서 설정 로드
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        myVoiceId = config.voiceId || '';
    } catch (e) {
        console.error('설정 로드 실패:', e);
    }

    initEventListeners();
    loadTaskList();
});

// API 키는 서버에서 관리됨
function getKlingKeys() {
    return { accessKey: '', secretKey: '' };
}

function getElevenKey() {
    return '';
}

function initEventListeners() {
    // 탭 전환
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            const container = e.target.parentElement.parentElement; // 탭 버튼의 부모(tabs)의 부모(card or form-group)
            container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            container.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(`${tab}-content`).classList.add('active');
        });
    });

    // 이미지 미리보기
    document.getElementById('imageFile').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        const preview = document.getElementById('imagePreview');
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => preview.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
            reader.readAsDataURL(file);
        }
    });

    // 비디오 생성 버튼
    document.getElementById('generateBtn').addEventListener('click', handleGenerateVideo);

    // 목소리 목록 로드
    document.getElementById('loadVoicesBtn').addEventListener('click', handleLoadVoices);

    // 목소리 생성 버튼
    document.getElementById('generateVoiceBtn').addEventListener('click', handleGenerateVoice);

    // 목소리 변형 (Speech-to-Speech) 버튼
    document.getElementById('convertVoiceBtn').addEventListener('click', handleConvertSpeech);

    // 음성 입력 방식 전환
    document.querySelectorAll('input[name="audioInputMethod"]').forEach(input => {
        input.addEventListener('change', (e) => {
            const method = e.target.value;
            document.querySelectorAll('.method-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`method-${method}`).classList.add('active');
        });
    });

    // 녹음 관련 초기화
    initRecording();

    // 녹음 파일 다운로드 버튼
    document.getElementById('downloadVoiceBtn').addEventListener('click', () => {
        if (!recordedBlob) {
            alert('먼저 녹음을 해주세요.');
            return;
        }
        const url = URL.createObjectURL(recordedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording_${Date.now()}.wav`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // 새로고침
    document.getElementById('refreshBtn').addEventListener('click', loadTaskList);
}

// 비디오 생성 핸들러
async function handleGenerateVideo() {
    const btn = document.getElementById('generateBtn');
    const { accessKey, secretKey } = getKlingKeys();

    if (!accessKey || !secretKey) return alert('Kling API 키를 입력해주세요.');

    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span>처리 중...';

    try {
        let imageData;
        const imageUrlInput = document.getElementById('imageUrl').value.trim();
        const imageFileInput = document.getElementById('imageFile').files[0];

        if (imageFileInput) {
            imageData = await FileHelpers.fileToBase64(imageFileInput);
        } else if (imageUrlInput) {
            imageData = imageUrlInput;
        } else {
            throw new Error('이미지를 선택해주세요.');
        }

        const videoUrl = document.getElementById('videoUrl').value.trim();
        const validation = FileHelpers.isValidVideoUrl(videoUrl);
        if (!validation.valid) throw new Error(validation.message);

        const result = await KlingAPI.createMotionControlVideo(
            accessKey, secretKey, imageData, videoUrl,
            document.getElementById('orientation').value,
            document.getElementById('mode').value,
            document.getElementById('prompt').value
        );

        showResult(result);
        setTimeout(loadTaskList, 2000);
    } catch (error) {
        showResult(error.message, true);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '비디오 생성하기';
    }
}

// 목소리 목록 로드 핸들러
async function handleLoadVoices() {
    const apiKey = getElevenKey();
    if (!apiKey) return alert('ElevenLabs API 키를 입력해주세요.');

    const btn = document.getElementById('loadVoicesBtn');
    btn.disabled = true;
    try {
        const voices = await ElevenLabsAPI.getVoices(apiKey);
        const select = document.getElementById('elevenVoiceSelect');
        select.innerHTML = voices.map(v => `<option value="${v.voice_id}">${v.name} (${v.category})</option>`).join('');
    } catch (error) {
        alert(error.message);
    } finally {
        btn.disabled = false;
    }
}

// 목소리 생성 핸들러
async function handleGenerateVoice() {
    const apiKey = getElevenKey();
    const text = document.getElementById('voiceText').value.trim();
    const voiceId = document.getElementById('elevenVoiceSelect').value;

    if (!apiKey || !text) return alert('API 키와 텍스트를 입력해주세요.');

    const btn = document.getElementById('generateVoiceBtn');
    btn.disabled = true;
    btn.innerText = '목소리 생성 중...';

    try {
        const audioBlob = await ElevenLabsAPI.generateSpeech(apiKey, text, voiceId);
        generatedAudioBlob = audioBlob;

        const url = URL.createObjectURL(audioBlob);
        const preview = document.getElementById('voicePreview');
        preview.src = url;
        document.getElementById('voicePreviewSection').style.display = 'block';
        preview.play();
    } catch (error) {
        alert(error.message);
    } finally {
        btn.disabled = false;
        btn.innerText = '목소리 생성하기';
    }
}

// 녹음 관련 전역 상태
let mediaRecorder = null;
let audioChunks = [];
let recordedBlob = null;
let recordingStartTime = null;
let timerInterval = null;

function initRecording() {
    const startBtn = document.getElementById('startRecordBtn');
    const stopBtn = document.getElementById('stopRecordBtn');

    startBtn.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                recordedBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const url = URL.createObjectURL(recordedBlob);
                const preview = document.getElementById('voicePreview');
                preview.src = url;
                document.getElementById('voicePreviewSection').style.display = 'block';
            };

            mediaRecorder.start();
            startBtn.disabled = true;
            stopBtn.disabled = false;
            document.getElementById('recordingPulse').style.display = 'inline-block';

            recordingStartTime = Date.now();
            timerInterval = setInterval(updateTimer, 1000);
        } catch (err) {
            alert('마이크 접근 권한이 필요합니다.');
        }
    });

    stopBtn.addEventListener('click', () => {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        startBtn.disabled = false;
        stopBtn.disabled = true;
        document.getElementById('recordingPulse').style.display = 'none';

        clearInterval(timerInterval);
    });
}

function updateTimer() {
    const now = Date.now();
    const diff = Math.floor((now - recordingStartTime) / 1000);
    const mins = Math.floor(diff / 60).toString().padStart(2, '0');
    const secs = (diff % 60).toString().padStart(2, '0');
    document.getElementById('recordTimer').innerText = `${mins}:${secs}`;
}

// 목소리 변형 (Speech-to-Speech) 핸들러
async function handleConvertSpeech() {
    const apiKey = getElevenKey();
    const voiceId = document.getElementById('elevenVoiceSelect').value;
    const method = document.querySelector('input[name="audioInputMethod"]:checked').value;

    let audioBlob;
    if (method === 'record') {
        if (!recordedBlob) return alert('먼저 녹음해 주세요.');
        audioBlob = recordedBlob;
    } else {
        const fileInput = document.getElementById('voiceInputFile');
        audioBlob = fileInput.files[0];
        if (!audioBlob) return alert('변형할 오디오 파일을 선택해주세요.');
    }

    const btn = document.getElementById('convertVoiceBtn');
    btn.disabled = true;
    btn.innerText = '목소리 변형 중...';

    try {
        const convertedBlob = await ElevenLabsAPI.convertSpeech(apiKey, voiceId, audioBlob);
        generatedAudioBlob = convertedBlob;

        const url = URL.createObjectURL(convertedBlob);
        const preview = document.getElementById('voicePreview');
        preview.src = url;
        document.getElementById('voicePreviewSection').style.display = 'block';
        preview.play();
    } catch (error) {
        alert(error.message);
    } finally {
        btn.disabled = false;
        btn.innerText = '목소리 변형하기';
    }
}

async function loadTaskList() {
    const { accessKey, secretKey } = getKlingKeys();
    if (!accessKey || !secretKey) return;

    try {
        const [motionResult, lipSyncResult] = await Promise.allSettled([
            KlingAPI.getTaskList(accessKey, secretKey),
            KlingAPI.getLipSyncTaskList(accessKey, secretKey)
        ]);

        let allTasks = [];
        if (motionResult.status === 'fulfilled' && motionResult.value.data) {
            const tasks = Array.isArray(motionResult.value.data) ? motionResult.value.data : motionResult.value.data.tasks || [];
            allTasks = allTasks.concat(tasks.map(t => ({ ...t, _source: 'motion' })));
        }
        if (lipSyncResult.status === 'fulfilled' && lipSyncResult.value.data) {
            const tasks = Array.isArray(lipSyncResult.value.data) ? lipSyncResult.value.data : lipSyncResult.value.data.tasks || [];
            allTasks = allTasks.concat(tasks.map(t => ({ ...t, _source: 'lipsync' })));
        }

        allTasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        renderTaskList(allTasks);
    } catch (error) {
        console.error(error);
    }
}

function renderTaskList(tasks) {
    const container = document.getElementById('taskList');
    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<p>작업이 없습니다.</p>';
        return;
    }

    container.innerHTML = tasks.map(task => {
        const isLipSync = task._source === 'lipsync';
        const statusClass = task.task_status.toLowerCase();

        let videoUrl = '';
        if (task.task_result) {
            videoUrl = task.task_result.video_url || (task.task_result.videos?.[0]?.url);
        }

        const voiceBtn = videoUrl && !isLipSync ? `
            <button class="download-btn btn-voice" onclick="window.toggleLipSyncUI('${task.task_id}')">목소리 입히기</button>
            <div id="lip-ui-${task.task_id}" class="upload-ui">
                <div class="voice-mode-selector">
                    <label><input type="radio" name="vm-${task.task_id}" value="extract" checked> 동영상 음성 → 내 목소리로 변환</label>
                    <label><input type="radio" name="vm-${task.task_id}" value="file"> 오디오 파일 직접 업로드</label>
                </div>
                <div id="file-input-${task.task_id}" style="display:none; margin-top:10px;">
                    <input type="file" id="vf-${task.task_id}" accept="audio/*">
                </div>
                <small style="display:block; color:#888; margin-top:5px;">동영상의 원본 음성을 추출하여 등록된 내 목소리로 변환합니다.</small>
                <button onclick="window.startLipSync('${task.task_id}', '${videoUrl}')" style="margin-top:10px;">립싱크 시작</button>
                <div id="vs-${task.task_id}"></div>
            </div>
        ` : '';

        return `
            <div class="task-item ${isLipSync ? 'lip-sync' : ''} ${statusClass}">
                <div class="task-id">ID: ${task.task_id} ${isLipSync ? '<span class="lip-sync-badge">Lip Sync</span>' : ''}</div>
                <div class="task-status status-${statusClass}">${task.task_status}</div>
                <p>생성: ${new Date(task.created_at).toLocaleString()}</p>
                ${videoUrl ? `<video src="${videoUrl}" controls style="width:100%; margin-top:10px;"></video>` : ''}
                ${voiceBtn}
            </div>
        `;
    }).join('');
}

// 전역 윈도우 함수 (HTML에서 호출용)
window.toggleLipSyncUI = (taskId) => {
    const ui = document.getElementById(`lip-ui-${taskId}`);
    ui.classList.toggle('active');
};

// 라디오 버튼 변경 감지 (이벤트 위임)
document.addEventListener('change', (e) => {
    if (e.target.name && e.target.name.startsWith('vm-')) {
        const taskId = e.target.name.replace('vm-', '');
        const fileInput = document.getElementById(`file-input-${taskId}`);
        if (fileInput) {
            fileInput.style.display = e.target.value === 'file' ? 'block' : 'none';
        }
    }
});

window.startLipSync = async (taskId, videoUrl) => {
    const { accessKey, secretKey } = getKlingKeys();
    const status = document.getElementById(`vs-${taskId}`);
    const mode = document.querySelector(`input[name="vm-${taskId}"]:checked`).value;

    try {
        let audioData;
        let duration;
        let audioBlob;

        if (mode === 'extract') {
            // 동영상에서 오디오 추출 후 내 목소리로 변환
            status.innerText = '동영상에서 음성 추출 중...';

            const extractRes = await fetch('/api/extract-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ video_url: videoUrl })
            });

            if (!extractRes.ok) throw new Error('음성 추출 실패');
            const extractData = await extractRes.json();

            // base64를 Blob으로 변환
            const audioBytes = Uint8Array.from(atob(extractData.audio_base64), c => c.charCodeAt(0));
            const extractedBlob = new Blob([audioBytes], { type: 'audio/mpeg' });

            status.innerText = '내 목소리로 변환 중...';
            const apiKey = getElevenKey();
            audioBlob = await ElevenLabsAPI.convertSpeech(apiKey, myVoiceId, extractedBlob);
            audioData = await FileHelpers.fileToBase64(audioBlob);
            duration = await FileHelpers.getAudioDuration(audioBlob);
        } else {
            // 파일 직접 업로드
            const file = document.getElementById(`vf-${taskId}`).files[0];
            if (!file) throw new Error('오디오 파일을 선택해주세요.');
            audioData = await FileHelpers.fileToBase64(file);
            duration = await FileHelpers.getAudioDuration(file);
        }

        status.innerText = '얼굴 분석 중...';
        const videoDuration = await FileHelpers.getVideoDuration(videoUrl);
        const identify = await KlingAPI.identifyFace(accessKey, secretKey, videoUrl);

        if (!identify.data.face_data?.length) throw new Error('얼굴을 찾을 수 없습니다.');

        const faceId = identify.data.face_data[0].face_id;
        const sessionId = identify.data.session_id;

        const safeDuration = Math.floor((Math.min(duration, videoDuration) - 0.2) * 1000);
        await KlingAPI.createLipSyncTask(accessKey, secretKey, sessionId, faceId, audioData, safeDuration);

        status.innerText = '성공! 목록을 확인하세요.';
        setTimeout(loadTaskList, 2000);
    } catch (error) {
        status.innerText = '오류: ' + error.message;
    }
};

function showResult(data, isError = false) {
    const section = document.getElementById('resultSection');
    const content = document.getElementById('resultContent');
    section.style.display = 'block';
    content.innerText = isError ? '오류: ' + data : '성공: ' + (data.message || '작업이 생성되었습니다.');
}
