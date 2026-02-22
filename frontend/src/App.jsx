import { useState, useRef } from 'react'
import VideoGenerator from './components/VideoGenerator'
import VoiceService from './components/VoiceService'
import TaskList from './components/TaskList'

const TABS = [
  { id: 'video', label: '🎬 비디오 생성' },
  { id: 'voice', label: '🎙️ AI 목소리' },
  { id: 'tasks', label: '📋 작업 목록' },
]

function App() {
  const [activeTab, setActiveTab] = useState('video')
  const [result, setResult] = useState(null)
  const taskListRef = useRef(null)

  const handleTaskCreated = () => {
    setTimeout(() => {
      setActiveTab('tasks')
      taskListRef.current?.refresh()
    }, 500)
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>🎬 AI Acting Studio</h1>
        <p>이미지와 영상을 조합하여 새로운 영상을 만들고, AI 목소리를 입혀보세요.</p>
      </header>

      <nav className="app-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`nav-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {result && (
          <div className={`result-banner ${result.error ? 'error' : 'success'}`}>
            {result.error ? '❌ 오류: ' + result.error : '✅ ' + (result.message || '작업이 생성되었습니다.')}
            <button className="result-close" onClick={() => setResult(null)}>×</button>
          </div>
        )}

        <div className={`tab-panel ${activeTab === 'video' ? 'active' : ''}`}>
          <VideoGenerator
            onResult={setResult}
            onTaskCreated={handleTaskCreated}
          />
        </div>

        <div className={`tab-panel ${activeTab === 'voice' ? 'active' : ''}`}>
          <VoiceService />
        </div>

        <div className={`tab-panel ${activeTab === 'tasks' ? 'active' : ''}`}>
          <TaskList ref={taskListRef} />
        </div>
      </main>
    </div>
  )
}

export default App
