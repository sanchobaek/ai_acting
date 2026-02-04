// Kling AI API 모듈
// API 키와 인증은 서버에서 처리됨

const KLING_CONFIG = {
    baseUrl: '/api/kling/v1/videos/motion-control',
    lipSyncUrl: '/api/kling/v1/videos/advanced-lip-sync',
    identifyFaceUrl: '/api/kling/v1/videos/identify-face'
};

export async function createMotionControlVideo(accessKey, secretKey, imageUrl, videoUrl, orientation, mode, prompt) {
    const requestBody = {
        image_url: imageUrl,
        video_url: videoUrl,
        character_orientation: orientation,
        mode: mode
    };

    if (prompt && prompt.trim()) {
        requestBody.prompt = prompt.trim();
    }

    const response = await fetch(KLING_CONFIG.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '비디오 생성 실패');
    }

    return await response.json();
}

export async function getTaskList() {
    const response = await fetch(KLING_CONFIG.baseUrl, {
        method: 'GET'
    });
    if (!response.ok) throw new Error('작업 목록 조회 실패');
    return await response.json();
}

export async function identifyFace(accessKey, secretKey, videoUrl) {
    const response = await fetch(KLING_CONFIG.identifyFaceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: videoUrl })
    });
    if (!response.ok) throw new Error('얼굴 식별 실패');
    return await response.json();
}

export async function createLipSyncTask(accessKey, secretKey, sessionId, faceId, audioData, duration, originalAudioVolume = 0, soundVolume = 1) {
    const requestBody = {
        session_id: sessionId,
        face_choose: [{
            face_id: faceId,
            sound_file: audioData,
            sound_start_time: 0,
            sound_insert_time: 0,
            sound_end_time: duration,
            original_audio_volume: originalAudioVolume,
            sound_volume: soundVolume
        }]
    };

    const response = await fetch(KLING_CONFIG.lipSyncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });
    if (!response.ok) throw new Error('립싱크 작업 생성 실패');
    return await response.json();
}

export async function getLipSyncTaskList() {
    const response = await fetch(KLING_CONFIG.lipSyncUrl, {
        method: 'GET'
    });
    if (!response.ok) throw new Error('립싱크 작업 목록 조회 실패');
    return await response.json();
}
