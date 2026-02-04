// Kling AI JWT 인증 관련 유틸리티
export async function generateJWT(accessKey, secretKey) {
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: accessKey,
        exp: now + 1800, // 30분 후 만료
        nbf: now - 5      // 5초 전부터 유효
    };

    const base64url = (obj) => {
        return btoa(JSON.stringify(obj))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    };

    const headerEncoded = base64url(header);
    const payloadEncoded = base64url(payload);

    return await signJWT(headerEncoded, payloadEncoded, secretKey);
}

async function signJWT(header, payload, secretKey) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`${header}.${payload}`);
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secretKey),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, data);
    const signatureArray = new Uint8Array(signature);
    const signatureBase64 = btoa(String.fromCharCode(...signatureArray))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    return `${header}.${payload}.${signatureBase64}`;
}
