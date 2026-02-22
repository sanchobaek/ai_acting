// 파일 처리 관련 유틸리티

export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export function getAudioDuration(source) {
    return new Promise((resolve) => {
        const audio = new Audio();
        audio.preload = 'metadata';
        audio.onloadedmetadata = function () {
            if (!(typeof source === 'string')) {
                window.URL.revokeObjectURL(audio.src);
            }
            resolve(audio.duration);
        }
        audio.onerror = function () {
            resolve(0);
        }
        audio.src = typeof source === 'string' ? source : URL.createObjectURL(source);
    });
}

export function getVideoDuration(url) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.crossOrigin = "anonymous";
        video.preload = 'metadata';
        video.onloadedmetadata = function () {
            resolve(video.duration || 5);
        }
        video.onerror = function () {
            console.warn('Video duration detection failed, using fallback.');
            resolve(5);
        }
        video.src = url;
    });
}

export function isValidVideoUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname.toLowerCase();
        const validExtensions = ['.mp4', '.mov'];
        const hasValidExtension = validExtensions.some(ext => pathname.endsWith(ext));

        if (!hasValidExtension) {
            return {
                valid: false,
                message: '비디오 URL은 .mp4 또는 .mov 파일의 직접 링크여야 합니다.'
            };
        }

        const unsupportedDomains = ['youtube.com', 'youtu.be', 'drive.google.com', 'dropbox.com'];
        const hostname = urlObj.hostname.toLowerCase();

        if (unsupportedDomains.some(domain => hostname.includes(domain))) {
            return {
                valid: false,
                message: '공유 링크 대신 직접 다운로드 가능한 URL을 입력해주세요.'
            };
        }

        return { valid: true };
    } catch (e) {
        return { valid: false, message: '올바른 URL 형식이 아닙니다.' };
    }
}
