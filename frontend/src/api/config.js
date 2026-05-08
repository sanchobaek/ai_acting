const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const getApiUrl = (path) => {
  // path가 /로 시작하면 제거
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  
  // API_BASE_URL이 있으면 결합, 없으면 상대 경로 반환
  if (API_BASE_URL) {
    return `${API_BASE_URL}/${cleanPath}`;
  }
  return `/${cleanPath}`;
};

export default API_BASE_URL;
