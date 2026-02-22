// ElevenLabs API 모듈
// API 키는 서버에서 처리됨

export async function generateSpeech(apiKey, text, voiceId = 'c2OowINIfBKhOHxTDBdh') {
    const URL = `/api/eleven/v1/text-to-speech/${voiceId}`;

    const response = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text: text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75
            }
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.message || 'ElevenLabs API 요청 실패');
    }

    const blob = await response.blob();
    return blob;
}

export async function getVoices() {
    const URL = '/api/eleven/v1/voices';

    const response = await fetch(URL, { method: 'GET' });

    if (!response.ok) {
        throw new Error('목소리 목록을 불러오지 못했습니다.');
    }

    const data = await response.json();
    return data.voices;
}

export async function convertSpeech(apiKey, voiceId, audioBlob) {
    const URL = `/api/eleven/v1/speech-to-speech/${voiceId}`;

    const formData = new FormData();
    formData.append('audio', audioBlob);
    formData.append('model_id', 'eleven_multilingual_sts_v2');
    formData.append('remove_background_noise', 'true');

    formData.append('voice_settings', JSON.stringify({
        stability: 0.5,
        similarity_boost: 0.75
    }));

    const response = await fetch(URL, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.message || 'ElevenLabs Voice Changer 요청 실패');
    }

    const blob = await response.blob();
    return blob;
}
