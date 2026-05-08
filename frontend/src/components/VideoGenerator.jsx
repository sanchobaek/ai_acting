import { useState, useEffect, useRef } from 'react'
import { getApiUrl } from '../api/config'
import * as KlingAPI from '../api/kling.js'
import * as FileHelpers from '../utils/fileHelpers.js'

function VideoGenerator({ onResult, onTaskCreated }) {
  const [imageTab, setImageTab] = useState('imageFile')
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [videoSources, setVideoSources] = useState([])
  const [selectedVideo, setSelectedVideo] = useState('')
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    fetch(getApiUrl('/api/config'))
      .then(r => r.json())
      .then(config => {
        const sources = config.videoSources || []
        setVideoSources(sources)
        if (sources.length > 0) setSelectedVideo(sources[0].url)
      })
      .catch(() => {})
  }, [])


  const handleImageFileChange = (e) => {
    const file = e.target.files[0]
    setImageFile(file)
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => setImagePreview(event.target.result)
      reader.readAsDataURL(file)
    } else {
      setImagePreview(null)
    }
  }

  const handleGenerateVideo = async () => {
    setLoading(true)
    try {
      let imageData
      if (imageFile) {
        imageData = await FileHelpers.fileToBase64(imageFile)
      } else if (imageUrl.trim()) {
        imageData = imageUrl.trim()
      } else {
        throw new Error('이미지를 선택해주세요.')
      }

      if (!selectedVideo) throw new Error('참조 영상을 선택해주세요.')

      const result = await KlingAPI.createMotionControlVideo(
        '', '', imageData, selectedVideo,
        'image', 'std', ''
      )

      onResult && onResult({ message: result.message || '작업이 생성되었습니다.' })
      setTimeout(() => onTaskCreated && onTaskCreated(), 2000)
    } catch (error) {
      onResult && onResult({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2>새 비디오 생성</h2>

      <div className="form-group">
        <label>이미지</label>
        <div className="tabs">
          <button
            className={`tab-btn ${imageTab === 'imageUrl' ? 'active' : ''}`}
            onClick={() => setImageTab('imageUrl')}
          >
            URL 입력
          </button>
          <button
            className={`tab-btn ${imageTab === 'imageFile' ? 'active' : ''}`}
            onClick={() => setImageTab('imageFile')}
          >
            파일 업로드
          </button>
        </div>
        <div className={`tab-content ${imageTab === 'imageUrl' ? 'active' : ''}`}>
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
          />
          <small>JPG/PNG, 10MB 이하, 300px-65536px</small>
        </div>
        <div className={`tab-content ${imageTab === 'imageFile' ? 'active' : ''}`}>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/jpeg,image/png"
            onChange={handleImageFileChange}
          />
          <small>JPG/PNG, 10MB 이하, 300px-65536px</small>
          {imagePreview ? (
            <div className="preview">
              <img src={imagePreview} alt="Preview" />
            </div>
          ) : (
            <div className="image-guide">
              <div className="image-guide-example">
                <img src="/sample-guide.jpg" alt="샘플 이미지" className="guide-svg" />
                <div className="image-guide-check good">✓ 좋은 예시</div>
              </div>
              <div className="image-guide-tips">
                <p className="guide-tip">📌 이런 이미지를 사용하세요</p>
                <ul>
                  <li>얼굴이 정면을 향할 것</li>
                  <li>상체가 포함될 것</li>
                  <li>밝고 선명한 사진</li>
                  <li>단색 배경 권장</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="form-group">
        <label>참조 영상 선택</label>
        {videoSources.length === 0 ? (
          <p className="no-sources-msg">⚠️ .env의 VIDEO_SOURCES에 영상을 추가해주세요.</p>
        ) : (
          <div className="video-radio-group">
            {videoSources.map((src, i) => (
              <label
                key={i}
                className={`video-radio-item ${selectedVideo === src.url ? 'active' : ''}`}
              >
                <input
                  type="radio"
                  name="videoSource"
                  value={src.url}
                  checked={selectedVideo === src.url}
                  onChange={() => setSelectedVideo(src.url)}
                />
                <div className="video-radio-content">
                  <video
                    src={src.url}
                    poster={src.thumbnail || undefined}
                    muted
                    preload="metadata"
                    style={{ width: '100%', borderRadius: '6px', display: 'block' }}
                  />
                  <span className="video-radio-label">{src.label}</span>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <button
        className="btn-primary"
        onClick={handleGenerateVideo}
        disabled={loading || videoSources.length === 0}
      >
        {loading ? <><span className="loading"></span>처리 중...</> : '비디오 생성하기'}
      </button>

      <div className="sample-videos-section">
        <div className="sample-videos-header">
          <span className="sample-videos-title">샘플 영상</span>
          <span className="sample-videos-desc">실제 생성된 결과물입니다</span>
        </div>
        <div className="sample-videos-grid">
          <div className="sample-video-item">
            <video src="https://sancho-ai-acting-s3.s3.ap-northeast-2.amazonaws.com/%E1%84%87%E1%85%A7%E1%86%AB%E1%84%80%E1%85%A7%E1%86%BC_%E1%84%8C%E1%85%A5%E1%86%BC%E1%84%8B%E1%85%AE%E1%84%89%E1%85%A5%E1%86%BC.mp4" controls muted style={{ width: '100%', borderRadius: '10px' }} />
          </div>
          <div className="sample-video-item">
            <video src="https://sancho-ai-acting-s3.s3.ap-northeast-2.amazonaws.com/%E1%84%87%E1%85%A7%E1%86%AB%E1%84%80%E1%85%A7%E1%86%BC_%E1%84%8E%E1%85%A1%E1%84%89%E1%85%B3%E1%86%BC%E1%84%8B%E1%85%AF%E1%86%AB.mp4" controls muted style={{ width: '100%', borderRadius: '10px' }} />
          </div>
          <div className="sample-video-item">
            <video src="https://sancho-ai-acting-s3.s3.ap-northeast-2.amazonaws.com/%E1%84%87%E1%85%A7%E1%86%AB%E1%84%80%E1%85%A7%E1%86%BC_%E1%84%8E%E1%85%AC%E1%84%86%E1%85%B5%E1%86%AB%E1%84%89%E1%85%B5%E1%86%A8.mp4" controls muted style={{ width: '100%', borderRadius: '10px' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoGenerator
