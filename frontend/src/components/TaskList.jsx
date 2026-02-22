import { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react'
import * as KlingAPI from '../api/kling.js'
import * as ElevenLabsAPI from '../api/elevenlabs.js'
import * as FileHelpers from '../utils/fileHelpers.js'

const TaskList = forwardRef(function TaskList(props, ref) {
  const [tasks, setTasks] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [lipSyncUIs, setLipSyncUIs] = useState({}) // taskId -> boolean (visible or not)
  const [lipSyncStatuses, setLipSyncStatuses] = useState({}) // taskId -> status text
  const [voices, setVoices] = useState([])
  const [lipSyncVoiceIds, setLipSyncVoiceIds] = useState({}) // taskId -> voiceId

  const loadTaskList = useCallback(async () => {
    setRefreshing(true)
    try {
      const [motionResult, lipSyncResult] = await Promise.allSettled([
        KlingAPI.getTaskList(),
        KlingAPI.getLipSyncTaskList()
      ])

      let allTasks = []
      if (motionResult.status === 'fulfilled' && motionResult.value.data) {
        const data = motionResult.value.data
        const taskArr = Array.isArray(data) ? data : data.tasks || []
        allTasks = allTasks.concat(taskArr.map(t => ({ ...t, _source: 'motion' })))
      }
      if (lipSyncResult.status === 'fulfilled' && lipSyncResult.value.data) {
        const data = lipSyncResult.value.data
        const taskArr = Array.isArray(data) ? data : data.tasks || []
        allTasks = allTasks.concat(taskArr.map(t => ({ ...t, _source: 'lipsync' })))
      }

      allTasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      setTasks(allTasks)
    } catch (error) {
      console.error(error)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadTaskList()
  }, [loadTaskList])

  useEffect(() => {
    ElevenLabsAPI.getVoices()
      .then(v => setVoices(v || []))
      .catch(() => {})
  }, [])

  useImperativeHandle(ref, () => ({
    refresh: loadTaskList
  }))

  const toggleLipSyncUI = (taskId) => {
    setLipSyncUIs(prev => ({ ...prev, [taskId]: !prev[taskId] }))
  }

  const setLipSyncStatus = (taskId, status) => {
    setLipSyncStatuses(prev => ({ ...prev, [taskId]: status }))
  }

  const startLipSync = async (taskId, videoUrl) => {
    try {
      setLipSyncStatus(taskId, '동영상에서 음성 추출 중...')

      const extractRes = await fetch('/api/extract-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: videoUrl })
      })

      if (!extractRes.ok) throw new Error('음성 추출 실패')
      const extractData = await extractRes.json()

      const audioBytes = Uint8Array.from(atob(extractData.audio_base64), c => c.charCodeAt(0))
      const extractedBlob = new Blob([audioBytes], { type: 'audio/mpeg' })

      setLipSyncStatus(taskId, '선택한 목소리로 변환 중...')

      const selectedVoiceId = lipSyncVoiceIds[taskId] || voices[0]?.voice_id
      if (!selectedVoiceId) throw new Error('목소리를 선택해주세요. AI 목소리 탭에서 먼저 등록하세요.')

      const audioBlob = await ElevenLabsAPI.convertSpeech('', selectedVoiceId, extractedBlob)
      const audioData = await FileHelpers.fileToBase64(audioBlob)
      const duration = await FileHelpers.getAudioDuration(audioBlob)

      setLipSyncStatus(taskId, '얼굴 분석 중...')
      const videoDuration = await FileHelpers.getVideoDuration(videoUrl)
      const identify = await KlingAPI.identifyFace('', '', videoUrl)

      if (!identify.data.face_data?.length) throw new Error('얼굴을 찾을 수 없습니다.')

      const faceId = identify.data.face_data[0].face_id
      const sessionId = identify.data.session_id

      const safeDuration = Math.floor((Math.min(duration, videoDuration) - 0.2) * 1000)
      await KlingAPI.createLipSyncTask('', '', sessionId, faceId, audioData, safeDuration)

      setLipSyncStatus(taskId, '성공! 목록을 확인하세요.')
      setTimeout(loadTaskList, 2000)
    } catch (error) {
      setLipSyncStatus(taskId, '오류: ' + error.message)
    }
  }

  const getVideoUrl = (task) => {
    if (!task.task_result) return ''
    return task.task_result.video_url || (task.task_result.videos?.[0]?.url) || ''
  }

  return (
    <div className="card" id="taskListSection">
      <h2>작업 목록</h2>
      <button className="btn-secondary" onClick={loadTaskList} disabled={refreshing}>
        {refreshing ? <><span className="loading"></span>새로고침 중...</> : '새로고침'}
      </button>
      <div id="taskList">
        {(!tasks || tasks.length === 0) ? (
          <p>작업이 없습니다.</p>
        ) : (
          tasks.map((task) => {
            const isLipSync = task._source === 'lipsync'
            const statusClass = task.task_status.toLowerCase()
            const videoUrl = getVideoUrl(task)
            const showVoiceBtn = videoUrl && !isLipSync
            const lipSyncVisible = lipSyncUIs[task.task_id]
            const lipSyncStatus = lipSyncStatuses[task.task_id] || ''

            return (
              <div key={task.task_id} className={`task-item ${isLipSync ? 'lip-sync' : ''} ${statusClass}`}>
                <div className="task-id">
                  ID: {task.task_id} {isLipSync && <span className="lip-sync-badge">Lip Sync</span>}
                </div>
                <div className={`task-status status-${statusClass}`}>{task.task_status}</div>
                <p>생성: {new Date(task.created_at).toLocaleString()}</p>
                {videoUrl && (
                  <video src={videoUrl} controls style={{ width: '100%', maxHeight: '240px', marginTop: '10px', objectFit: 'contain' }} />
                )}
                {showVoiceBtn && (
                  <>
                    <button
                      className="download-btn btn-voice"
                      onClick={() => toggleLipSyncUI(task.task_id)}
                    >
                      목소리 입히기
                    </button>
                    <div className={`upload-ui ${lipSyncVisible ? 'active' : ''}`}>
                      <div style={{ marginTop: '10px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>목소리 선택</label>
                        <select
                          value={lipSyncVoiceIds[task.task_id] || voices[0]?.voice_id || ''}
                          onChange={(e) => setLipSyncVoiceIds(prev => ({ ...prev, [task.task_id]: e.target.value }))}
                          style={{ width: '100%' }}
                        >
                          {voices.length === 0
                            ? <option value="">목소리 없음 — AI 목소리 탭에서 먼저 등록하세요</option>
                            : voices.map(v => (
                                <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
                              ))
                          }
                        </select>
                      </div>
                      <small style={{ display: 'block', color: '#888', marginTop: '5px' }}>
                        동영상의 원본 음성을 추출하여 등록된 내 목소리로 변환합니다.
                      </small>
                      <button
                        style={{ marginTop: '10px' }}
                        onClick={() => startLipSync(task.task_id, videoUrl)}
                      >
                        립싱크 시작
                      </button>
                      {lipSyncStatus && (
                        <div style={{ marginTop: '5px' }}>{lipSyncStatus}</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
})

export default TaskList
