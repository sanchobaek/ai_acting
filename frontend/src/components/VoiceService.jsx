import { useState, useRef, useEffect } from 'react'

function VoiceService() {
  const [cloneName, setCloneName] = useState('')
  const [cloneInputMethod, setCloneInputMethod] = useState('record')
  const [cloneFile, setCloneFile] = useState(null)
  const [cloneStatus, setCloneStatus] = useState('')
  const [removeNoise, setRemoveNoise] = useState(true)
  const [creatingVoice, setCreatingVoice] = useState(false)

  const [scriptTime, setScriptTime] = useState('')
  const [cloneRecording, setCloneRecording] = useState(false)
  const [cloneRecordTimer, setCloneRecordTimer] = useState('00:00')
  const [clonePreviewUrl, setClonePreviewUrl] = useState(null)
  const cloneMediaRecorderRef = useRef(null)
  const cloneAudioChunksRef = useRef([])
  const cloneRecordedBlobRef = useRef(null)
  const cloneRecordingStartTimeRef = useRef(null)
  const cloneTimerIntervalRef = useRef(null)

  useEffect(() => {
    return () => {
      if (cloneTimerIntervalRef.current) clearInterval(cloneTimerIntervalRef.current)
      if (clonePreviewUrl) URL.revokeObjectURL(clonePreviewUrl)
    }
  }, [])

  const startCloneRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      cloneAudioChunksRef.current = []

      recorder.ondataavailable = (event) => {
        cloneAudioChunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(cloneAudioChunksRef.current, { type: 'audio/wav' })
        cloneRecordedBlobRef.current = blob
        if (clonePreviewUrl) URL.revokeObjectURL(clonePreviewUrl)
        setClonePreviewUrl(URL.createObjectURL(blob))
      }

      recorder.start()
      cloneMediaRecorderRef.current = recorder
      setCloneRecording(true)

      cloneRecordingStartTimeRef.current = Date.now()
      if (cloneTimerIntervalRef.current) clearInterval(cloneTimerIntervalRef.current)
      cloneTimerIntervalRef.current = setInterval(() => {
        const diff = Math.floor((Date.now() - cloneRecordingStartTimeRef.current) / 1000)
        const mins = Math.floor(diff / 60).toString().padStart(2, '0')
        const secs = (diff % 60).toString().padStart(2, '0')
        setCloneRecordTimer(`${mins}:${secs}`)
      }, 1000)
    } catch (err) {
      alert('마이크 접근 권한이 필요합니다.')
    }
  }

  const stopCloneRecording = () => {
    if (cloneMediaRecorderRef.current) {
      cloneMediaRecorderRef.current.stop()
      cloneMediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
    }
    setCloneRecording(false)
    clearInterval(cloneTimerIntervalRef.current)
    cloneTimerIntervalRef.current = null
    setCloneRecordTimer('00:00')
  }

  const handleCreateVoice = async () => {
    if (!cloneName.trim()) return alert('목소리 이름을 입력해주세요.')

    let audioBlob
    if (cloneInputMethod === 'record') {
      if (!cloneRecordedBlobRef.current) return alert('먼저 녹음을 해주세요.')
      audioBlob = cloneRecordedBlobRef.current
    } else {
      if (!cloneFile) return alert('오디오 파일을 선택해주세요.')
      audioBlob = cloneFile
    }

    setCreatingVoice(true)
    setCloneStatus('목소리 등록 중...')

    try {
      const formData = new FormData()
      formData.append('name', cloneName.trim())
      formData.append('files', audioBlob, 'voice_sample.wav')
      formData.append('remove_background_noise', removeNoise.toString())

      const response = await fetch('/api/create-voice', { method: 'POST', body: formData })
      const result = await response.json()

      if (!response.ok) throw new Error(result.detail?.message || result.error || '목소리 등록 실패')

      setCloneStatus(`✅ 등록 완료! Voice ID: ${result.voice_id}`)
    } catch (error) {
      setCloneStatus('❌ 오류: ' + error.message)
    } finally {
      setCreatingVoice(false)
    }
  }

  return (
    <div className="card voice-card">
      <h2>🎙️ 내 목소리 등록 (ElevenLabs)</h2>

      <div className="form-group">
        <label>목소리 이름</label>
        <input
          type="text"
          value={cloneName}
          onChange={(e) => setCloneName(e.target.value)}
          placeholder="예: 내 목소리"
        />
      </div>

      <div className="form-group">
        <label>목소리 샘플 (1~5분 권장)</label>
        <div className="method-toggle">
          <button
            type="button"
            className={`method-toggle-btn ${cloneInputMethod === 'upload' ? 'active' : ''}`}
            onClick={() => setCloneInputMethod('upload')}
          >
            <span className="method-toggle-icon">📁</span>
            <span className="method-toggle-text">파일 업로드</span>
          </button>
          <button
            type="button"
            className={`method-toggle-btn ${cloneInputMethod === 'record' ? 'active' : ''}`}
            onClick={() => {
              setCloneInputMethod('record')
              const now = new Date()
              setScriptTime(`${now.getHours()}시 ${now.getMinutes().toString().padStart(2, '0')}분`)
            }}
          >
            <span className="method-toggle-icon">🎙️</span>
            <span className="method-toggle-text">직접 녹음</span>
          </button>
        </div>
      </div>

      {cloneInputMethod === 'upload' ? (
        <div className="form-group">
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setCloneFile(e.target.files[0] || null)}
          />
        </div>
      ) : (
        <div className="form-group">
          <div className="recording-script">
            <p className="script-label">📋 아래 스크립트를 따라 읽어주세요</p>
            <p className="script-text">
              안녕하세요. 저는 {cloneName.trim() || 'OOO'}입니다.
              현재 AI Acting Studio를 위해 저의 목소리를 등록 중입니다.
              현재 시각은 {scriptTime || '??시 ??분'}입니다.
              오늘도 고생 많으셨습니다. 내일도 화이팅입니다.
            </p>
          </div>
          <div className="record-controls">
            <button className="btn-record" onClick={startCloneRecording} disabled={cloneRecording}>
              ⏺️ 녹음 시작
            </button>
            <button className="btn-stop" onClick={stopCloneRecording} disabled={!cloneRecording}>
              ⏹️ 녹음 중지
            </button>
            <span className="timer">{cloneRecordTimer}</span>
          </div>
          {cloneRecording && <div className="pulse" style={{ marginTop: '8px' }}></div>}
          {clonePreviewUrl && (
            <audio controls style={{ width: '100%', marginTop: '10px' }} src={clonePreviewUrl} />
          )}
        </div>
      )}

      <div className="noise-toggle-row" onClick={() => setRemoveNoise(v => !v)}>
        <div className="noise-toggle-info">
          <span className="noise-toggle-title">배경 소음 제거</span>
          <span className="noise-toggle-desc">녹음 중 잡음을 자동으로 걸러냅니다</span>
        </div>
        <div className={`toggle-switch ${removeNoise ? 'on' : ''}`}>
          <div className="toggle-knob" />
        </div>
      </div>

      <button className="btn-primary" onClick={handleCreateVoice} disabled={creatingVoice}>
        {creatingVoice ? '등록 중...' : '내 목소리 등록하기'}
      </button>

      {cloneStatus && (
        <div className={`clone-status ${cloneStatus.startsWith('✅') ? 'success-message' : 'error-message'}`}
          style={{ marginTop: '12px' }}>
          {cloneStatus}
        </div>
      )}
    </div>
  )
}

export default VoiceService
