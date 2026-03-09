
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { 
  Upload, Target, ShieldAlert, ShieldCheck, Activity,
  UserCheck, History as HistoryIcon, Clock, RefreshCcw, Cpu, Zap, AlertCircle, Play, PlayCircle, Scissors, X, Users, BarChart3, FileVideo, ChevronRight, CheckCircle2, AlertTriangle, BookOpen, Sparkles, ChevronDown, Download, Gauge, Scan, EyeOff, Trash2, DownloadCloud, UploadCloud, Database, MessageSquare, Send, Rss, MessageSquareText, Star, Plus, ExternalLink, Volume2, Waves
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { VideoType, AnalysisResult, FrameData, AgencyCategory, HistoryItem, FeedItem, UserFeedback } from './types';
import { analyzeVideoFrames, chatWithMarkerAI } from './services/geminiService';

const TEAM_MEMBERS = ["Akhil", "Siva Prasad", "Theja Sagar", "Sai Teja", "Admin"];
const MASTER_VAULT_KEY = 'videoiq_master_persistent_vault_v1';
const FEED_VAULT_KEY = 'videoiq_feed_vault_v1';
const FEEDBACK_VAULT_KEY = 'videoiq_feedback_vault_v1';
const LEGACY_VAULT_KEYS = ['videoiq_session_vault_v3', 'videoiq_session_vault', 'videoiq_history_v2'];

const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
  const radius = 60;
  const strokeWidth = 10;
  const dimension = 140;
  const center = dimension / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 85 ? '#22c55e' : score >= 70 ? '#fdbb00' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center w-28 h-28 sm:w-36 sm:h-36">
      <svg width="100%" height="100%" viewBox={`0 0 ${dimension} ${dimension}`} className="transform -rotate-90">
        <circle cx={center} cy={center} r={radius} stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} fill="transparent" />
        <circle cx={center} cy={center} r={radius} stroke={color} strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} style={{ strokeDashoffset, transition: 'stroke-dashoffset 1.5s ease-out' }} strokeLinecap="round" />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-xl sm:text-3xl font-bold text-white tabular-nums">{score}%</span>
        <span className="text-[8px] font-medium text-zinc-500 uppercase tracking-widest mt-0.5">Quality</span>
      </div>
    </div>
  );
};

const LiveActivityFeed: React.FC<{ activities: any[] }> = ({ activities }) => {
  return (
    <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-3 text-[#FDBB00]">
          <Activity size={20} />
          <h3 className="text-lg font-bold uppercase tracking-tight">Live <span className="text-white">Activity</span></h3>
        </div>
        <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold uppercase tracking-widest text-zinc-500 border border-white/5">Sync Active</span>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2 relative z-10">
        {activities.length === 0 ? (
          <div className="py-12 text-center opacity-20 italic">
            <p className="text-xs font-medium uppercase tracking-widest">No recent activity</p>
          </div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="bg-zinc-800/30 border border-white/5 p-4 rounded-2xl flex items-center justify-between gap-4 hover:bg-zinc-800/50 transition-all group shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center border border-white/5">
                  <UserCheck size={16} className="text-[#FDBB00]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{activity.user}</span>
                  </div>
                  <p className="text-[11px] font-medium text-zinc-500 flex items-center gap-1.5">
                    <FileVideo size={10} /> {activity.context}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                   <div className={`text-sm font-bold ${activity.score >= 85 ? 'text-green-400' : activity.score >= 70 ? 'text-[#FDBB00]' : 'text-red-400'}`}>
                     {activity.score}%
                   </div>
                </div>
                <div className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border ${
                  activity.verdict === 'PASS' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 
                  activity.verdict === 'NEEDS_REVIEW' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                  'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  {activity.verdict === 'PASS' ? 'Approved' : activity.verdict === 'NEEDS_REVIEW' ? 'Review' : 'Fail'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ label: string; score: number; maxScore: number; icon: React.ReactNode }> = ({ label, score, maxScore, icon }) => {
  const percentage = (score / maxScore) * 100;
  const isHigh = percentage >= 80;
  const isMid = percentage >= 60;
  
  return (
    <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl hover:bg-zinc-800/40 transition-colors group">
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400 group-hover:text-[#FDBB00] transition-colors">
          {React.cloneElement(icon as React.ReactElement, { size: 16 })}
        </div>
        <span className={`text-xs font-mono font-bold ${isHigh ? 'text-green-400' : isMid ? 'text-yellow-400' : 'text-red-400'}`}>
          {score.toFixed(0)}<span className="text-zinc-600">/</span>{maxScore}
        </span>
      </div>
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</p>
      <div className="mt-2 h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full transition-all duration-1000 ${isHigh ? 'bg-green-500' : isMid ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'audit' | 'archive' | 'team' | 'feed' | 'feedback' | 'guidelines'>('audit');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isChatting, setIsChatting] = useState<{ [key: number]: boolean }>({});
  const [activeAuditId, setActiveAuditId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [mainVideoUrl, setMainVideoUrl] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState("Initializing Deep Engine...");
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [selectedType, setSelectedType] = useState<VideoType>('Ad / Commercial');
  const [selectedAuditor, setSelectedAuditor] = useState<string>(TEAM_MEMBERS[0]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedbacks, setFeedbacks] = useState<UserFeedback[]>([]);
  const [commentInput, setCommentInput] = useState<{ [key: string]: string }>({});
  const [activeCommentMarker, setActiveCommentMarker] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [liveActivities, setLiveActivities] = useState<any[]>([]);
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const socketRef = useRef<WebSocket | null>(null);
  
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackType, setFeedbackType] = useState<UserFeedback['type']>('Improvement');
  const [showFeedForm, setShowFeedForm] = useState(false);
  const [newFeedItem, setNewFeedItem] = useState({ title: '', description: '', url: '', category: 'Gold Standard', tags: '' });

  const videoRef = useRef<HTMLVideoElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // WebSocket Setup with Reconnection Logic
    let socket: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socketUrl = `${protocol}//${window.location.host}/ws-api`;
      socket = new WebSocket(socketUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        if (!isMounted) {
          socket?.close();
          return;
        }
        console.log("WS Connected to /ws-api");
        setWsStatus('connected');
      };

      socket.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'INIT_ACTIVITIES') {
            setLiveActivities(payload.data);
          } else if (payload.type === 'ACTIVITY_UPDATE') {
            setLiveActivities(prev => {
              // Duplicate check by ID
              if (prev.some(a => a.id === payload.data.id)) return prev;
              return [payload.data, ...prev].slice(0, 50);
            });
          }
        } catch (err) {
          console.error("WS Message Error:", err);
        }
      };

      socket.onclose = () => {
        if (!isMounted) return;
        console.log("WS Disconnected. Retrying in 3s...");
        setWsStatus('disconnected');
        reconnectTimeout = setTimeout(connect, 3000);
      };

      socket.onerror = (err) => {
        console.error("WS Error:", err);
        setWsStatus('disconnected');
        socket?.close();
      };
    };

    connect();
    
    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    };
  }, []);

  useEffect(() => {
    const savedHistory = localStorage.getItem(MASTER_VAULT_KEY);
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) setHistory(parsed);
      } catch (e) { console.error("History vault corrupted", e); }
    } else {
      let migrated: HistoryItem[] = [];
      LEGACY_VAULT_KEYS.forEach(key => {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) migrated = [...migrated, ...parsed];
          } catch(e) {}
        }
      });
      const unique = migrated.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      if (unique.length > 0) setHistory(unique);
    }

    const savedFeed = localStorage.getItem(FEED_VAULT_KEY);
    if (savedFeed) {
      try {
        const parsed = JSON.parse(savedFeed);
        if (Array.isArray(parsed)) setFeedItems(parsed);
      } catch (e) {}
    }

    const savedFeedback = localStorage.getItem(FEEDBACK_VAULT_KEY);
    if (savedFeedback) {
      try {
        const parsed = JSON.parse(savedFeedback);
        if (Array.isArray(parsed)) setFeedbacks(parsed);
      } catch (e) {}
    }
  }, []);

  useEffect(() => { localStorage.setItem(MASTER_VAULT_KEY, JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem(FEED_VAULT_KEY, JSON.stringify(feedItems)); }, [feedItems]);
  useEffect(() => { localStorage.setItem(FEEDBACK_VAULT_KEY, JSON.stringify(feedbacks)); }, [feedbacks]);

  const teamStats = useMemo(() => {
    return TEAM_MEMBERS.map(member => {
      const audits = history.filter(h => h.auditorName === member);
      const avgScore = audits.length > 0 
        ? Math.round(audits.reduce((acc, curr) => acc + curr.result.overallScore, 0) / audits.length)
        : 0;
      return { name: member, count: audits.length, avgScore };
    });
  }, [history]);

  const captureFrames = useCallback(async (videoElement: HTMLVideoElement, count: number = 24): Promise<FrameData[]> => {
    const frames: FrameData[] = [];
    const interval = videoElement.duration / (count + 1);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    return new Promise((resolve) => {
      let currentFrame = 0;
      const capture = () => {
        if (currentFrame >= count) { resolve(frames); return; }
        videoElement.currentTime = (currentFrame + 1) * interval;
        videoElement.onseeked = () => {
          canvas.width = videoElement.videoWidth;
          canvas.height = videoElement.videoHeight;
          ctx?.drawImage(videoElement, 0, 0);
          frames.push({ data: canvas.toDataURL('image/jpeg', 0.8).split(',')[1], timestamp: videoElement.currentTime });
          currentFrame++;
          capture();
        };
      };
      capture();
    });
  }, []);

  const runAnalysis = async () => {
    if (!mainFile || isAnalyzing) return;
    setIsAnalyzing(true);
    setLoadingText("Booting Quality Core...");
    try {
      const mUrl = URL.createObjectURL(mainFile);
      setMainVideoUrl(mUrl);
      const mainVid = document.createElement('video');
      mainVid.src = mUrl;
      await new Promise(r => mainVid.onloadedmetadata = r);
      setLoadingText("Decoding Frame Buffers...");
      const mainFrames = await captureFrames(mainVid, 20);
      let result = await analyzeVideoFrames(mainFrames, selectedType);
      result = recalculateAuditResult(result);
      setAnalysisResult(result);
      
      // Broadcast to team via WebSocket
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: "NEW_ANALYSIS",
          user: selectedAuditor,
          score: result.overallScore,
          verdict: result.verdict,
          context: mainFile.name
        }));
      }

      const auditId = Date.now().toString() + "_" + Math.random().toString(36).substr(2, 9);
      setActiveAuditId(auditId);
      setHistory(prev => [{
        id: auditId,
        date: new Date().toISOString(),
        fileName: mainFile.name,
        auditorName: selectedAuditor,
        result: result
      }, ...prev]);
    } catch (e) {
      alert("System Overload: Falling back to local precision engine.");
    } finally { setIsAnalyzing(false); }
  };

  const recalculateAuditResult = (result: AnalysisResult): AnalysisResult => {
    const impactMap: Record<string, number> = { 'Critical': 10, 'High': 5, 'Medium': 2, 'Low': 1 };
    
    // 1. Reset counts
    let totalDeduction = 0;
    let criticalCount = 0;
    let highCount = 0;
    
    // 2. Calculate deductions from active markers
    result.timestamped_betterment.forEach(marker => {
      if (!marker.isIgnored) {
        const impact = impactMap[marker.severity] || 0;
        totalDeduction += impact;
        if (marker.severity === 'Critical') criticalCount++;
        if (marker.severity === 'High') highCount++;
      }
    });
    
    // 3. Update overall scores
    result.overall_score = Math.max(0, 100 - totalDeduction);
    result.overallScore = result.overall_score;
    result.points_earned = result.overall_score; // On 100pt scale
    result.points_possible = 100;
    result.critical_failures = criticalCount;
    result.high_failures = highCount;
    
    // 4. Update section scores
    const sections = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06'];
    sections.forEach(sid => {
      const sectionMarkers = result.timestamped_betterment.filter(m => m.section_id === sid && !m.isIgnored);
      const sectionDeduction = sectionMarkers.reduce((acc, m) => acc + (impactMap[m.severity] || 0), 0);
      
      const section = result.section_scores.find(s => s.section_id === sid);
      if (section) {
        section.points_possible = 100; // Standardize to 100 for consistency
        section.points_earned = Math.max(0, 100 - sectionDeduction);
        section.score = section.points_earned;
        
        // Sync with top-level category objects
        if (sid === 'S01') result.hook_performance.score = section.score;
        else if (sid === 'S02') result.motion_graphics.score = section.score;
        else if (sid === 'S03') result.visual_technical.score = section.score;
        else if (sid === 'S04') result.messaging_copy.score = section.score;
        else if (sid === 'S05') result.audio_captions.score = section.score;
        else if (sid === 'S06') result.platform_policy.score = section.score;
      }
    });
    
    // 5. Update verdicts based on audit logic
    if (result.overall_score >= 85 && result.critical_failures === 0 && result.high_failures <= 3) {
      result.verdict = 'PASS';
      result.final_verdict = 'APPROVED';
      result.verdict_message = "Video meets all critical standards. Approved for publishing.";
    } else if (result.overall_score >= 65 && result.critical_failures === 0) {
      result.verdict = 'NEEDS_REVIEW';
      result.final_verdict = 'MINOR FIX REQUIRED';
      result.verdict_message = "Passes critical checks but has quality gaps. Fix flagged items before publishing.";
    } else {
      result.verdict = 'FAIL';
      result.final_verdict = 'REJECTED';
      result.verdict_message = "Critical issues found. All critical failures must be resolved before resubmission.";
    }
    
    return result;
  };

  const addMarkerComment = async (markerIndex: number) => {
    if (!activeAuditId || !analysisResult) return;
    const comment = commentInput[markerIndex];
    if (!comment?.trim()) return;

    setIsChatting(prev => ({ ...prev, [markerIndex]: true }));
    setCommentInput(prev => ({ ...prev, [markerIndex]: '' }));

    try {
      const marker = analysisResult.timestamped_betterment[markerIndex];
      const historyForAI = (marker.chat_history || []).map(m => ({ role: m.role, text: m.text }));
      
      const aiResponse = await chatWithMarkerAI(marker.description, comment, historyForAI);

      const userMsg = { role: 'user' as const, text: comment, timestamp: new Date().toISOString() };
      const modelMsg = { role: 'model' as const, text: aiResponse.text, timestamp: new Date().toISOString() };

      setHistory(prev => prev.map(item => {
        if (item.id === activeAuditId) {
          const newResult = JSON.parse(JSON.stringify(item.result)) as AnalysisResult;
          const updatedMarker = newResult.timestamped_betterment[markerIndex];
          
          updatedMarker.chat_history = [...(updatedMarker.chat_history || []), userMsg, modelMsg];
          
          if (aiResponse.action === 'IGNORE' && !updatedMarker.isIgnored) {
            updatedMarker.isIgnored = true;
          } else if (aiResponse.action === 'UPDATE_SEVERITY' && aiResponse.newSeverity) {
            updatedMarker.severity = aiResponse.newSeverity;
          }

          const finalResult = recalculateAuditResult(newResult);
          setAnalysisResult(finalResult);
          return { ...item, result: finalResult };
        }
        return item;
      }));
    } catch (err) {
      console.error("Chat error:", err);
    } finally {
      setIsChatting(prev => ({ ...prev, [markerIndex]: false }));
    }
  };

  const toggleMarkerIgnored = (markerIndex: number) => {
    if (!activeAuditId || !analysisResult) return;
    
    setHistory(prev => prev.map(item => {
      if (item.id === activeAuditId) {
        const newResult = JSON.parse(JSON.stringify(item.result)) as AnalysisResult;
        const marker = newResult.timestamped_betterment[markerIndex];
        
        marker.isIgnored = !marker.isIgnored;
        
        const finalResult = recalculateAuditResult(newResult);
        setAnalysisResult(finalResult);
        return { ...item, result: finalResult };
      }
      return item;
    }));
  };

  const submitFeedback = () => {
    if (!feedbackMsg.trim()) return;
    const newFb: UserFeedback = {
      id: Date.now().toString(),
      user: selectedAuditor,
      rating: feedbackRating,
      type: feedbackType,
      message: feedbackMsg,
      date: new Date().toISOString()
    };
    setFeedbacks(prev => [newFb, ...prev]);
    setFeedbackMsg('');
    alert("Feedback received! Thank you for helping us improve VideoIQ.");
  };

  const addFeedItem = () => {
    if (!newFeedItem.title.trim()) return;
    const item: FeedItem = {
      id: Date.now().toString(),
      title: newFeedItem.title,
      description: newFeedItem.description,
      url: newFeedItem.url,
      category: newFeedItem.category,
      addedBy: selectedAuditor,
      date: new Date().toISOString(),
      tags: newFeedItem.tags.split(',').map(t => t.trim())
    };
    setFeedItems(prev => [item, ...prev]);
    setNewFeedItem({ title: '', description: '', url: '', category: 'Gold Standard', tags: '' });
    setShowFeedForm(false);
  };

  const loadFromHistory = (item: HistoryItem) => {
    setActiveAuditId(item.id);
    setAnalysisResult(item.result);
    setSelectedType(item.result.videoType);
    setSelectedAuditor(item.auditorName);
    setMainVideoUrl(null); 
    setActiveTab('audit');
  };

  const clearHistory = () => {
    if (confirm("Permanently clear vault?")) {
      setHistory([]);
      localStorage.removeItem(MASTER_VAULT_KEY);
    }
  };

  const exportTeamData = () => {
    const data = { history, feedItems, feedbacks };
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `videoiq_agency_sync_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const importTeamData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (imported.history) {
          setHistory(prev => {
            const existingIds = new Set(prev.map(h => h.id));
            const newItems = imported.history.filter((h: any) => !existingIds.has(h.id));
            return [...newItems, ...prev];
          });
        }
        if (imported.feedItems) {
           setFeedItems(prev => {
             const ids = new Set(prev.map(f => f.id));
             const newItems = imported.feedItems.filter((f: any) => !ids.has(f.id));
             return [...newItems, ...prev];
           });
        }
        if (imported.feedbacks) setFeedbacks(prev => [...(imported.feedbacks || []), ...prev]);
        alert(`Successfully synced all teammate records!`);
      } catch (err) { alert("Invalid sync file format."); }
    };
    reader.readAsText(file);
  };

  const seekToTimestamp = (timestampStr: string) => {
    if (!videoRef.current) return;
    const parts = timestampStr.split(':').map(Number);
    let seconds = (parts.length === 2) ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2];
    videoRef.current.currentTime = seconds;
    videoRef.current.play();
    videoRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const downloadReport = () => {
    if (!analysisResult) return;
    const doc = new jsPDF();
    const yellow = [253, 187, 0];
    
    // Header
    doc.setFillColor(15, 15, 15);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(253, 187, 0);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("VIDEOIQ", 20, 25);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text("TECHNICAL PERFORMANCE AUDIT REPORT", 20, 32);
    
    // Summary Section
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.text("Audit Summary", 20, 55);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    const splitSummary = doc.splitTextToSize(analysisResult.overall_summary, 170);
    doc.text(splitSummary, 20, 65);
    
    // Score Grid
    const scoreY = 65 + (splitSummary.length * 7) + 10;
    doc.setFont("helvetica", "bold");
    doc.text(`Overall Score: ${analysisResult.overall_score}%`, 20, scoreY);
    doc.text(`Verdict: ${analysisResult.verdict}`, 120, scoreY);
    doc.setFontSize(10);
    doc.text(`Points: ${analysisResult.points_earned}/${analysisResult.points_possible} | Critical: ${analysisResult.critical_failures} | High: ${analysisResult.high_failures}`, 20, scoreY + 7);
    
    // Metrics Table
    const metricsData = [
      ["Metric", "Score", "Max"],
      ["Hook Performance", analysisResult.hook_performance.score, 20],
      ["Motion Graphics", analysisResult.motion_graphics.score, 20],
      ["Visual & Technical", analysisResult.visual_technical.score, 15],
      ["Messaging & Copy", analysisResult.messaging_copy.score, 15],
      ["Audio & Captions", analysisResult.audio_captions.score, 15],
      ["Platform Policy", analysisResult.platform_policy.score, 15]
    ];
    
    autoTable(doc, {
      startY: scoreY + 10,
      head: [metricsData[0]],
      body: metricsData.slice(1),
      theme: 'striped',
      headStyles: { fillColor: [253, 187, 0], textColor: [0, 0, 0] },
    });
    
    // Markers Table
    doc.setFontSize(16);
    doc.text("Technical Audit Markers", 20, (doc as any).lastAutoTable.finalY + 15);
    
    const markersData = analysisResult.timestamped_betterment.map(m => [
      m.timestamp,
      m.severity,
      m.description,
      m.actionable_fix
    ]);
    
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [["Timestamp", "Severity", "Issue Description", "Recommended Fix"]],
      body: markersData,
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 60 },
        3: { cellWidth: 65 }
      }
    });
    
    doc.save(`videoiq_audit_${Date.now()}.pdf`);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type.startsWith('video/')) {
        setMainFile(file);
      } else {
        alert("Invalid format: Please upload a video file.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] text-zinc-100 font-sans selection:bg-[#FDBB00] selection:text-black antialiased">
      <header className="sticky top-0 z-[60] bg-[#080808]/80 backdrop-blur-xl border-b border-white/5 h-16 px-4 sm:px-8 flex items-center shadow-sm">
        <div className="max-w-[1700px] w-full mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-8 shrink-0">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setAnalysisResult(null); setActiveTab('audit'); }}>
              <div className="w-8 h-8 bg-[#FDBB00] rounded-lg flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <Scan size={16} className="text-black" strokeWidth={2.5} />
              </div>
              <h1 className="text-xl font-bold tracking-tight uppercase">VIDEO<span className="text-[#FDBB00]">IQ</span></h1>
            </div>
            <nav className="hidden md:flex items-center gap-1 bg-zinc-900/50 p-1 rounded-full border border-white/5">
              <button onClick={() => setActiveTab('audit')} className={`px-5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'audit' ? 'bg-[#FDBB00] text-black' : 'text-zinc-500 hover:text-zinc-300'}`}>Audit</button>
              <button onClick={() => setActiveTab('guidelines')} className={`px-5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'guidelines' ? 'bg-[#FDBB00] text-black' : 'text-zinc-500 hover:text-zinc-300'}`}>Guidelines</button>
              <button onClick={() => setActiveTab('archive')} className={`px-5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'archive' ? 'bg-[#FDBB00] text-black' : 'text-zinc-500 hover:text-zinc-300'}`}>Archive</button>
              <button onClick={() => setActiveTab('feed')} className={`px-5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'feed' ? 'bg-[#FDBB00] text-black' : 'text-zinc-500 hover:text-zinc-300'}`}>Feed</button>
              <button onClick={() => setActiveTab('team')} className={`px-5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'team' ? 'bg-[#FDBB00] text-black' : 'text-zinc-500 hover:text-zinc-300'}`}>Team</button>
              <button onClick={() => setActiveTab('feedback')} className={`px-5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'feedback' ? 'bg-[#FDBB00] text-black' : 'text-zinc-500 hover:text-zinc-300'}`}>Feedback</button>
            </nav>
          </div>
          <div className="flex items-center gap-6 shrink-0">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all ${
              wsStatus === 'connected' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
              wsStatus === 'connecting' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' :
              'bg-red-500/10 border-red-500/20 text-red-500'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                wsStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                wsStatus === 'connecting' ? 'bg-yellow-500 animate-bounce' :
                'bg-red-500'
              }`} />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Wait' : 'Offline'}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-right">
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Auditor</p>
                <p className="text-xs font-bold text-zinc-300">{selectedAuditor}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400">
                <UserCheck size={16} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1700px] mx-auto p-4 sm:p-8">
        {activeTab === 'audit' && (
          isAnalyzing ? (
            <div className="py-44 flex flex-col items-center justify-center space-y-12 animate-in fade-in duration-700">
               <div className="relative">
                 <div className="w-48 h-48 rounded-full border border-white/5 flex items-center justify-center bg-zinc-900/30 shadow-2xl">
                   <div className="w-32 h-32 rounded-full border-2 border-t-[#FDBB00] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                 </div>
                 <div className="absolute inset-0 flex items-center justify-center">
                   <Cpu className="text-[#FDBB00] animate-pulse" size={40} />
                 </div>
               </div>
               <div className="text-center space-y-4">
                 <h2 className="text-4xl font-bold tracking-tight uppercase">Analyzing <span className="text-[#FDBB00]">Video Assets</span></h2>
                 <p className="text-xs text-zinc-500 font-mono tracking-[0.4em] uppercase animate-pulse">{loadingText}</p>
               </div>
            </div>
          ) : analysisResult ? (
            <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-700">
              <div className="bg-zinc-900/60 border border-white/5 rounded-3xl p-6 sm:p-10 flex flex-col xl:flex-row items-center justify-between gap-8 shadow-2xl">
                 <div className="flex flex-col md:flex-row items-center gap-8 sm:gap-12">
                    <ScoreRing score={analysisResult.overall_score} />
                    <div className="space-y-4 text-center md:text-left">
                      <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start">
                        <span className={`px-5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest border ${
                          analysisResult.verdict === 'PASS' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 
                          analysisResult.verdict === 'NEEDS_REVIEW' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                          'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}>{analysisResult.verdict === 'PASS' ? 'Approved' : analysisResult.verdict === 'NEEDS_REVIEW' ? 'Needs Review' : 'Rejected'}</span>
                        {analysisResult.resubmission_required && (
                          <span className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400 uppercase tracking-widest">Resubmission Required</span>
                        )}
                        <span className="px-4 py-2 rounded-xl bg-zinc-800 border border-white/5 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{selectedType}</span>
                        <div className="flex items-center gap-4 md:ml-4">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase text-zinc-600 tracking-widest">Points</span>
                            <span className="text-lg font-bold text-white tabular-nums">{analysisResult.points_earned}<span className="text-zinc-600">/{analysisResult.points_possible}</span></span>
                          </div>
                          {analysisResult.critical_failures > 0 && (
                            <div className="flex flex-col">
                              <span className="text-[9px] font-bold uppercase text-red-500/40 tracking-widest">Critical</span>
                              <span className="text-lg font-bold text-red-500 tabular-nums">{analysisResult.critical_failures}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-3xl sm:text-5xl font-black tracking-tight uppercase leading-none">Analysis <span className="text-[#FDBB00]">Complete</span></h2>
                        <p className="text-zinc-500 text-sm font-medium">{analysisResult.verdict_message}</p>
                      </div>
                    </div>
                 </div>
                 <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                   <button onClick={() => { setAnalysisResult(null); setMainFile(null); }} className="px-6 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold uppercase tracking-widest border border-white/5 flex items-center justify-center gap-2 transition-all"><RefreshCcw size={16} /> New Audit</button>
                   <button onClick={downloadReport} className="px-8 py-4 bg-[#FDBB00] text-black rounded-xl hover:bg-[#ffc933] transition-all shadow-lg text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"><Download size={16} strokeWidth={2.5} /> Save Report</button>
                 </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                <div className="xl:col-span-8 space-y-8">
                  <div className="bg-black rounded-3xl overflow-hidden border border-white/5 aspect-video shadow-2xl relative ring-1 ring-white/10">
                    {mainVideoUrl ? <video ref={videoRef} src={mainVideoUrl} controls className="w-full h-full object-contain" /> : <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-zinc-800 italic"><PlayCircle className="size-20" strokeWidth={0.5} /><p className="mt-4 font-bold uppercase tracking-widest text-xs">Playback Stream Unlinked</p></div>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <MetricCard label="Hook Performance" score={analysisResult.hook_performance.score} maxScore={47} icon={<Scissors size={18} />} />
                    <MetricCard label="Motion Graphics" score={analysisResult.motion_graphics.score} maxScore={68} icon={<Target size={18} />} />
                    <MetricCard label="Visual & Technical" score={analysisResult.visual_technical.score} maxScore={52} icon={<ShieldAlert size={18} />} />
                    <MetricCard label="Messaging & Copy" score={analysisResult.messaging_copy.score} maxScore={58} icon={<ShieldCheck size={18} />} />
                    <MetricCard label="Audio & Captions" score={analysisResult.audio_captions.score} maxScore={38} icon={<Volume2 size={18} />} />
                    <MetricCard label="Platform Policy" score={analysisResult.platform_policy.score} maxScore={57} icon={<Gauge size={18} />} />
                  </div>

                  <div className="bg-zinc-900/40 border border-white/5 p-8 rounded-3xl space-y-4 shadow-xl relative overflow-hidden">
                     <div className="flex items-center gap-3 text-[#FDBB00] mb-2"><Waves size={20} /><h3 className="text-lg font-bold uppercase tracking-tight">Technical Narrative</h3></div>
                     <p className="text-zinc-300 text-lg leading-relaxed font-medium italic relative z-10">"{analysisResult.overall_summary}"</p>
                  </div>
                </div>

                <div className="xl:col-span-4 space-y-8">
                  <div className="bg-zinc-900/40 border border-white/5 rounded-3xl h-full flex flex-col overflow-hidden shadow-xl min-h-[600px] xl:min-h-[800px]">
                    <div className="p-6 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3"><Clock size={20} className="text-[#FDBB00]" /><h3 className="text-lg font-bold tracking-tight uppercase">Audit <span className="text-[#FDBB00]">Markers</span></h3></div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                      {analysisResult.timestamped_betterment.map((marker, i) => (
                        <div key={i} className={`bg-zinc-800/30 border p-6 rounded-2xl transition-all flex flex-col gap-4 shadow-sm ${marker.isIgnored ? 'opacity-40 grayscale' : ''} ${activeCommentMarker === i ? 'border-[#FDBB00]/50 bg-[#FDBB00]/5' : 'border-white/5 hover:border-white/10'}`}>
                           <div className="flex items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-xs font-mono font-bold text-[#FDBB00] bg-[#FDBB00]/10 px-3 py-1.5 rounded-lg border border-[#FDBB00]/20">{marker.timestamp}</span>
                                 <span className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border ${
                                   marker.isIgnored ? 'bg-white/10 border-white/20 text-white/40' :
                                   marker.severity === 'Critical' ? 'bg-red-600 border-red-700 text-white' :
                                   marker.severity === 'High' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                   marker.severity === 'Medium' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                                   'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                 }`}>
                                   {marker.isIgnored ? 'Ignored' : marker.severity}
                                 </span>
                                {mainVideoUrl && <button onClick={() => seekToTimestamp(marker.timestamp)} className="w-8 h-8 bg-zinc-800 hover:bg-[#FDBB00] hover:text-black rounded-lg flex items-center justify-center transition-all shadow-md"><Play size={12} fill="currentColor" /></button>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => toggleMarkerIgnored(i)} className={`p-2 rounded-lg transition-all ${marker.isIgnored ? 'bg-green-500 text-white' : 'bg-white/5 text-zinc-500 hover:text-white'}`} title={marker.isIgnored ? "Restore Marker" : "Ignore Marker"}>
                                  {marker.isIgnored ? <CheckCircle2 size={16} /> : <EyeOff size={16} />}
                                </button>
                                <button onClick={() => setActiveCommentMarker(activeCommentMarker === i ? null : i)} className={`p-2 rounded-lg transition-all ${activeCommentMarker === i ? 'bg-[#FDBB00] text-black' : 'bg-white/5 text-zinc-500 hover:text-white'}`} title="Discuss with AI">
                                  <MessageSquare size={16} />
                                </button>
                              </div>
                           </div>
                           <div className="space-y-3">
                             <p className="text-sm font-semibold text-zinc-200 leading-snug">{marker.description}</p>
                             <div className="bg-zinc-950/50 p-4 rounded-xl border-l-2 border-[#FDBB00] flex items-start gap-3 shadow-inner">
                                <Zap size={14} className="text-[#FDBB00] shrink-0 mt-0.5" />
                                <div className="space-y-0.5"><p className="text-[9px] font-bold uppercase text-[#FDBB00] tracking-widest">Fix Recommendation</p><p className="text-xs font-medium text-zinc-400 leading-relaxed">{marker.actionable_fix}</p></div>
                             </div>
                           </div>

                           {/* TABBED AI CHAT SECTION */}
                           {activeCommentMarker === i && (
                             <div className="border-t border-white/5 pt-6 space-y-5 animate-in slide-in-from-top-4 duration-300">
                                <div className="flex items-center gap-3"><Cpu size={16} className="text-[#FDBB00]" /><h4 className="text-[11px] font-black uppercase tracking-widest">AI Auditor Discussion</h4></div>
                                <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                  {marker.chat_history && marker.chat_history.length > 0 ? marker.chat_history.map((msg, msgIdx) => (
                                    <div key={msgIdx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                       <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] leading-relaxed ${msg.role === 'user' ? 'bg-[#FDBB00] text-black font-bold rounded-tr-none' : 'bg-white/5 text-white/80 border border-white/10 rounded-tl-none italic'}`}>
                                          {msg.text}
                                       </div>
                                       <span className="text-[9px] text-white/20 mt-1 uppercase font-black">{msg.role === 'user' ? 'You' : 'AI Auditor'} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                  )) : (
                                    <div className="py-10 text-center space-y-3 opacity-20">
                                      <MessageSquare size={40} className="mx-auto" />
                                      <p className="text-[11px] font-black uppercase tracking-widest">No discussion yet. Ask the AI about this marker.</p>
                                    </div>
                                  )}
                                  {isChatting[i] && (
                                    <div className="flex items-center gap-3 text-[#FDBB00] animate-pulse">
                                      <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 bg-[#FDBB00] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-1.5 h-1.5 bg-[#FDBB00] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-1.5 h-1.5 bg-[#FDBB00] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                      </div>
                                      <span className="text-[10px] font-black uppercase tracking-widest">AI is judging...</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 bg-black/40 p-2 rounded-2xl border border-white/5 focus-within:border-[#FDBB00]/50 transition-all">
                                   <input 
                                     type="text" 
                                     value={commentInput[i] || ''} 
                                     onChange={e => setCommentInput({...commentInput, [i]: e.target.value})} 
                                     placeholder="Discuss with AI Auditor..." 
                                     disabled={isChatting[i]}
                                     className="flex-1 bg-transparent px-4 py-2 text-[13px] outline-none focus:ring-0 disabled:opacity-50" 
                                     onKeyDown={e => e.key === 'Enter' && addMarkerComment(i)} 
                                   />
                                   <button 
                                     onClick={() => addMarkerComment(i)} 
                                     disabled={isChatting[i] || !commentInput[i]?.trim()}
                                     className="p-3 bg-[#FDBB00] text-black rounded-xl hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
                                   >
                                     <Send size={18} strokeWidth={3} />
                                   </button>
                                </div>
                             </div>
                           )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-[1200px] mx-auto space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000 py-12">
               
               <div className="text-center space-y-6">
                 <h2 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight uppercase leading-[0.9]"><span className="text-[#FDBB00]">Video</span><br/>Review Engine</h2>
                 <p className="text-xs sm:text-sm font-bold text-zinc-600 uppercase tracking-[0.6em]">Technical Content Audit Protocol</p>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-8 space-y-8">
                    <div 
                      className={`bg-zinc-900/40 border-2 border-dashed rounded-[3rem] p-12 sm:p-24 text-center cursor-pointer group shadow-2xl relative overflow-hidden transition-all duration-500 ${mainFile ? 'border-green-500/40 bg-green-500/5' : isDragging ? 'border-[#FDBB00] bg-[#FDBB00]/5' : 'border-white/5 hover:border-[#FDBB00]/40 hover:bg-zinc-800/40'}`} 
                      onClick={() => document.getElementById('main-input')?.click()}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <input id="main-input" type="file" className="hidden" accept="video/*" onChange={e => e.target.files?.[0] && setMainFile(e.target.files[0])} />
                      <div className="w-24 h-24 bg-zinc-800 rounded-3xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform shadow-xl border border-white/5">
                        {mainFile ? <CheckCircle2 className="text-green-500" size={32} /> : <Upload className="text-[#FDBB00]" size={32} />}
                      </div>
                      <h4 className="text-2xl sm:text-4xl font-bold mb-4 tracking-tight">{mainFile ? mainFile.name : 'Staging Asset for Review'}</h4>
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{isDragging ? 'Drop to Upload' : 'Optimized for UHD Playback Containers'}</p>
                    </div>
                  </div>
                 <div className="lg:col-span-4 space-y-8">
                    <div className="bg-zinc-900/40 border border-white/5 p-8 rounded-[3rem] space-y-8 shadow-xl">
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block">Audit Configuration</label>
                        <div className="grid grid-cols-1 gap-3">
                          {['Ad / Commercial', 'Organic / Social', 'Educational', 'Entertainment'].map((type) => (
                            <button 
                              key={type}
                              onClick={() => setSelectedType(type as VideoType)}
                              className={`px-6 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest border transition-all text-left flex items-center justify-between group ${selectedType === type ? 'bg-[#FDBB00] border-[#FDBB00] text-black shadow-lg' : 'bg-zinc-800/50 border-white/5 text-zinc-500 hover:border-white/10 hover:text-zinc-300'}`}
                            >
                              {type}
                              <ChevronRight size={14} className={selectedType === type ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 transition-opacity'} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block">Active Auditor</label>
                        <select 
                          value={selectedAuditor} 
                          onChange={(e) => setSelectedAuditor(e.target.value)}
                          className="w-full bg-zinc-800/50 border border-white/5 rounded-2xl px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-300 outline-none focus:border-[#FDBB00]/50 transition-all appearance-none cursor-pointer"
                        >
                          {TEAM_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>

                      <button 
                        onClick={runAnalysis}
                        disabled={!mainFile || isAnalyzing}
                        className="w-full py-6 bg-[#FDBB00] text-black rounded-[2rem] font-black uppercase tracking-widest text-sm shadow-2xl hover:bg-[#ffc933] disabled:opacity-30 disabled:hover:bg-[#FDBB00] transition-all flex items-center justify-center gap-3"
                      >
                        <Zap size={18} strokeWidth={3} /> Initiate Audit
                      </button>
                    </div>

                    <div className="pt-4">
                      <LiveActivityFeed activities={liveActivities} />
                    </div>
                 </div>
               </div>
            </div>
          )
        )}

        {activeTab === 'guidelines' && (
          <div className="max-w-[1000px] mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 py-12">
            <div className="space-y-2">
              <h3 className="text-4xl font-black tracking-tight uppercase">Audit <span className="text-[#FDBB00]">Protocols</span></h3>
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.4em]">Standardized Agency Quality Benchmarks</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: 'Hook Performance', weight: '20%', icon: <Scissors />, color: 'text-[#FDBB00]', items: ['Strong 3s hook', 'No dead frames', 'Brand ID by 2s', 'Headline by 2s'] },
                { title: 'Motion Graphics', weight: '20%', icon: <Target />, color: 'text-blue-400', items: ['Natural easing', 'Legible typography', 'Consistent transitions', 'Visual hierarchy'] },
                { title: 'Visual & Technical', weight: '15%', icon: <ShieldAlert />, color: 'text-red-400', items: ['Resolution compliance', 'No artifacts', 'Consistent grading', 'Safe zones'] },
                { title: 'Messaging & Copy', weight: '15%', icon: <ShieldCheck />, color: 'text-green-400', items: ['Benefit-led headlines', 'No spelling errors', 'Price accuracy', 'Location clarity'] },
                { title: 'Audio & Captions', weight: '15%', icon: <Volume2 />, color: 'text-purple-400', items: ['Balanced VO/Music mix', 'No clipping', 'Tone matches positioning', 'Accurate captions'] },
                { title: 'Platform Policy', weight: '15%', icon: <Gauge />, color: 'text-orange-400', items: ['No unverified claims', 'No discriminatory language', 'Text-to-image ratio', 'Regulatory disclaimers'] }
              ].map((cat, idx) => (
                <div key={idx} className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 space-y-6 hover:border-[#FDBB00]/20 transition-all group shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className={`p-3 bg-zinc-800 rounded-xl ${cat.color} group-hover:scale-110 transition-transform border border-white/5`}>{React.cloneElement(cat.icon as React.ReactElement, { size: 20 })}</div>
                    <span className="text-xl font-black text-zinc-800 tracking-tighter">{cat.weight}</span>
                  </div>
                  <div className="space-y-4">
                    <h5 className="text-lg font-bold uppercase tracking-tight group-hover:text-white transition-colors">{cat.title}</h5>
                    <ul className="space-y-2">
                      {cat.items.map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-xs text-zinc-500 font-medium">
                          <div className="w-1 h-1 rounded-full bg-[#FDBB00]/40" /> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-zinc-900/40 border border-white/5 rounded-[3rem] p-12 shadow-xl">
               <div className="flex flex-col lg:flex-row justify-between gap-12">
                  <div className="space-y-8 lg:w-1/2">
                    <div className="space-y-2">
                      <h4 className="text-3xl font-black tracking-tight uppercase">Decision <span className="text-[#FDBB00]">Logic</span></h4>
                      <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.4em]">Weighted Scoring Protocol</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Critical', points: '-10 pts', color: 'text-red-500' },
                        { label: 'High', points: '-5 pts', color: 'text-orange-500' },
                        { label: 'Medium', points: '-2 pts', color: 'text-yellow-500' },
                        { label: 'Low', points: '-1 pt', color: 'text-blue-500' }
                      ].map((w, i) => (
                        <div key={i} className="bg-zinc-800/50 p-4 rounded-2xl border border-white/5 flex justify-between items-center group hover:border-white/10 transition-all">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{w.label}</span>
                          <span className={`${w.color} font-black text-sm`}>{w.points}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-4">
                      <h5 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Approval Thresholds</h5>
                      <ul className="space-y-3">
                        {[
                          'ANY Critical failure = REJECTED',
                          'Score ≥ 85 + 0 Critical + ≤ 3 High = APPROVED',
                          'Score ≥ 65 + 0 Critical = NEEDS REVIEW',
                          'Score < 65 = REJECTED'
                        ].map((rule, i) => (
                          <li key={i} className="flex items-center gap-3 text-xs font-bold text-zinc-500">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#FDBB00]" /> {rule}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="lg:w-1/2 flex flex-col gap-4">
                    {[
                      { score: '85–100', status: 'Approved', action: 'Ready for Publishing', color: 'text-green-500', bg: 'bg-green-500/5', border: 'border-green-500/20' },
                      { score: '65–84', status: 'Needs Review', action: 'Revision Recommended', color: 'text-[#FDBB00]', bg: 'bg-[#FDBB00]/5', border: 'border-[#FDBB00]/20' },
                      { score: 'Below 65', status: 'Rejected', action: 'Re-edit Required', color: 'text-red-500', bg: 'bg-red-500/5', border: 'border-red-500/20' }
                    ].map((m, i) => (
                      <div key={i} className={`${m.bg} ${m.border} border rounded-3xl p-8 flex items-center justify-between group hover:scale-[1.02] transition-all shadow-lg`}>
                        <div className="space-y-1">
                          <div className={`text-sm font-black uppercase tracking-widest ${m.color}`}>{m.status}</div>
                          <div className="text-xs font-medium text-zinc-500">{m.action}</div>
                        </div>
                        <div className="text-2xl font-black text-zinc-300 tracking-tighter">{m.score}</div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          </div>
        )}
        {activeTab === 'feed' && (
           <div className="max-w-[1200px] mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 py-12">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h3 className="text-4xl font-black tracking-tight uppercase">Creative <span className="text-[#FDBB00]">Feed</span></h3>
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.4em]">Global Creative Standard Benchmarks</p>
                </div>
                <button 
                  onClick={() => setShowFeedForm(true)} 
                  className="px-8 py-4 bg-[#FDBB00] text-black rounded-2xl font-bold uppercase tracking-widest text-xs flex items-center gap-3 shadow-lg hover:scale-105 transition-all"
                >
                  <Plus size={18} strokeWidth={3} /> Stage Benchmark
                </button>
              </div>

              {showFeedForm && (
                <div className="bg-zinc-900/40 border border-white/5 p-10 rounded-[3rem] shadow-xl space-y-8 animate-in zoom-in duration-300">
                   <div className="flex items-center justify-between">
                     <h4 className="text-2xl font-black tracking-tight uppercase">New <span className="text-[#FDBB00]">Benchmark</span></h4>
                     <button onClick={() => setShowFeedForm(false)} className="text-zinc-600 hover:text-zinc-300 transition-colors"><X size={24} /></button>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Creative Title</label>
                       <input type="text" className="w-full bg-zinc-800/50 border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-[#FDBB00]/50 transition-all text-sm" value={newFeedItem.title} onChange={e => setNewFeedItem({...newFeedItem, title: e.target.value})} placeholder="Ex: Optimized Pacing Hook" />
                     </div>
                     <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Asset URL</label>
                       <input type="text" className="w-full bg-zinc-800/50 border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-[#FDBB00]/50 transition-all text-sm" value={newFeedItem.url} onChange={e => setNewFeedItem({...newFeedItem, url: e.target.value})} placeholder="Link to asset" />
                     </div>
                     <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Category</label>
                       <select className="w-full bg-zinc-800/50 border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-[#FDBB00]/50 transition-all text-sm appearance-none cursor-pointer" value={newFeedItem.category} onChange={e => setNewFeedItem({...newFeedItem, category: e.target.value})}>
                         <option>Gold Standard</option>
                         <option>High Conversion</option>
                         <option>Best Hook</option>
                         <option>Technical Peak</option>
                       </select>
                     </div>
                     <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Tags</label>
                       <input type="text" className="w-full bg-zinc-800/50 border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-[#FDBB00]/50 transition-all text-sm" value={newFeedItem.tags} onChange={e => setNewFeedItem({...newFeedItem, tags: e.target.value})} placeholder="Hook, Pacing, Lighting" />
                     </div>
                     <div className="md:col-span-2 space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Rationale</label>
                       <textarea className="w-full bg-zinc-800/50 border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-[#FDBB00]/50 min-h-[100px] transition-all text-sm" value={newFeedItem.description} onChange={e => setNewFeedItem({...newFeedItem, description: e.target.value})} placeholder="Why is this asset a benchmark?" />
                     </div>
                   </div>
                   <button onClick={addFeedItem} className="w-full py-5 bg-[#FDBB00] text-black font-black uppercase tracking-widest rounded-2xl shadow-lg hover:bg-[#ffc933] transition-all">Broadcast Benchmark</button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {feedItems.length > 0 ? feedItems.map(item => (
                  <div key={item.id} className="bg-zinc-900/40 border border-white/5 rounded-[2.5rem] overflow-hidden group hover:border-[#FDBB00]/20 transition-all shadow-lg flex flex-col">
                     <div className="aspect-video bg-zinc-800 relative flex items-center justify-center overflow-hidden border-b border-white/5">
                        <PlayCircle size={48} className="text-zinc-700 group-hover:text-[#FDBB00] group-hover:scale-110 transition-all duration-500" />
                        <div className="absolute top-4 right-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded-lg text-[9px] font-bold uppercase tracking-widest border border-white/5 text-[#FDBB00]">{item.category}</div>
                     </div>
                     <div className="p-8 space-y-6 flex-1 flex flex-col">
                        <div className="space-y-2 flex-1">
                           <h4 className="text-xl font-bold tracking-tight group-hover:text-[#FDBB00] transition-colors">{item.title}</h4>
                           <p className="text-zinc-500 text-xs leading-relaxed line-clamp-3 italic">"{item.description}"</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                           {item.tags.map(tag => <span key={tag} className="px-2 py-1 bg-zinc-800 rounded-md text-[9px] font-bold uppercase tracking-widest text-zinc-500 border border-white/5">#{tag}</span>)}
                        </div>
                        <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-[10px] font-bold border border-white/5">{item.addedBy[0]}</div>
                             <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{item.addedBy}</p>
                           </div>
                           {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-2 bg-zinc-800 hover:bg-[#FDBB00] hover:text-black rounded-lg transition-all border border-white/5"><ExternalLink size={16} /></a>}
                        </div>
                     </div>
                  </div>
                )) : (
                  <div className="lg:col-span-3 py-32 text-center opacity-20 flex flex-col items-center">
                    <Sparkles size={64} className="mb-6 animate-pulse" />
                    <p className="text-2xl font-black uppercase tracking-[0.4em]">Feed core empty</p>
                  </div>
                )}
              </div>
           </div>
        )}

        {activeTab === 'feedback' && (
           <div className="max-w-[800px] mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 py-12">
              <div className="space-y-2 text-center">
                 <h3 className="text-4xl font-black tracking-tight uppercase">System <span className="text-[#FDBB00]">Evolution</span></h3>
                 <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.4em]">Refining the Review Engine Algorithm</p>
              </div>

              <div className="bg-zinc-900/40 border border-white/5 p-10 rounded-[3rem] shadow-xl space-y-10">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">User Sentiment</p>
                      <div className="flex gap-3">
                        {[1, 2, 3, 4, 5].map(s => (
                          <button key={s} onClick={() => setFeedbackRating(s)} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all border ${feedbackRating >= s ? 'bg-[#FDBB00] border-[#FDBB00] text-black shadow-lg' : 'bg-zinc-800 border-white/5 text-zinc-600 hover:bg-zinc-700 hover:border-white/10'}`}>
                            <Star size={20} fill={feedbackRating >= s ? "currentColor" : "none"} strokeWidth={2.5} />
                          </button>
                        ))}
                      </div>
                   </div>
                   <div className="space-y-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Update Category</p>
                      <div className="flex flex-wrap gap-2">
                        {['Improvement', 'Bug', 'Feature', 'Other'].map(t => (
                          <button key={t} onClick={() => setFeedbackType(t as any)} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${feedbackType === t ? 'bg-zinc-800 border-white/20 text-white shadow-lg' : 'bg-zinc-800/50 border-white/5 text-zinc-600 hover:text-zinc-400 hover:border-white/10'}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                   </div>
                 </div>
                 <div className="space-y-4">
                   <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Protocol Suggestion</p>
                   <textarea value={feedbackMsg} onChange={e => setFeedbackMsg(e.target.value)} placeholder="What can we refine in the Video Review Engine?" className="w-full bg-zinc-800/50 border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-[#FDBB00]/50 min-h-[120px] text-sm italic transition-all shadow-inner" />
                 </div>
                 <button onClick={submitFeedback} className="w-full py-5 bg-[#FDBB00] text-black font-black uppercase tracking-widest rounded-2xl shadow-lg hover:bg-[#ffc933] transition-all flex items-center justify-center gap-3">
                   <Sparkles size={18} strokeWidth={3} /> Submit Suggestion
                 </button>
              </div>

              <div className="space-y-6">
                 <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-600">Agency Development Log</h4>
                 <div className="space-y-4">
                    {feedbacks.length > 0 ? feedbacks.slice(0, 5).map(fb => (
                      <div key={fb.id} className="bg-zinc-900/40 border border-white/5 p-6 rounded-2xl flex items-start gap-5 hover:bg-zinc-800/40 transition-all group shadow-sm">
                         <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0 border border-white/5 group-hover:border-[#FDBB00]/20 transition-all">
                            {fb.type === 'Bug' ? <AlertTriangle className="text-red-400" size={18} /> : <Sparkles className="text-[#FDBB00]" size={18} />}
                         </div>
                         <div className="space-y-1 flex-1">
                            <div className="flex items-center justify-between">
                               <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest">{fb.user}</p>
                               <span className="text-zinc-700 text-[9px] uppercase font-bold">{new Date(fb.date).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm text-zinc-500 italic leading-relaxed">"{fb.message}"</p>
                         </div>
                      </div>
                    )) : <p className="text-center text-zinc-800 py-10 uppercase tracking-widest font-bold text-xs italic">Log core empty</p>}
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'archive' && (
           <div className="max-w-[1000px] mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 py-12">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h3 className="text-4xl font-black tracking-tight uppercase">Session <span className="text-[#FDBB00]">Vault</span></h3>
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.4em]">Permanent Agency Review Archives</p>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900/40 px-6 py-3 rounded-2xl border border-white/5">{history.length} SESSIONS</span>
                  {history.length > 0 && <button onClick={clearHistory} className="p-3 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-red-500/20 group"><Trash2 size={20} className="group-hover:scale-110 transition-transform" /></button>}
                </div>
              </div>
              {history.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {history.map(item => (
                    <div key={item.id} className="bg-zinc-900/40 border border-white/5 p-8 rounded-3xl flex items-center justify-between hover:border-[#FDBB00]/20 transition-all group cursor-pointer shadow-lg" onClick={() => loadFromHistory(item)}>
                      <div className="flex items-center gap-8">
                        <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-600 group-hover:text-[#FDBB00] transition-all border border-white/5">
                          <FileVideo size={24} strokeWidth={1.5} />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-xl font-bold group-hover:text-white transition-colors tracking-tight">{item.fileName}</h4>
                          <div className="flex items-center gap-6 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                            <span className="flex items-center gap-2"><UserCheck size={14} className="text-[#FDBB00]" /> {item.auditorName}</span>
                            <span className="flex items-center gap-2"><Clock size={14} /> {new Date(item.date).toLocaleDateString()}</span>
                            <span className="px-2 py-1 bg-zinc-800 rounded-lg text-[9px] font-black border border-white/5">{item.result.videoType}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-12">
                        <div className="text-right space-y-0.5">
                          <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Master Score</p>
                          <p className={`text-3xl font-black ${item.result.overallScore >= 75 ? 'text-green-500' : 'text-red-500'} tracking-tighter`}>{item.result.overallScore}%</p>
                        </div>
                        <div className="p-4 bg-zinc-800 rounded-2xl group-hover:bg-[#FDBB00] group-hover:text-black transition-all duration-300">
                          <ChevronRight size={20} strokeWidth={3} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : ( 
                <div className="py-32 text-center opacity-20 flex flex-col items-center">
                  <HistoryIcon size={64} className="mb-6 animate-pulse" />
                  <p className="text-2xl font-black uppercase tracking-[0.4em]">Vault core empty</p>
                </div> 
              )}
           </div>
        )}

        {activeTab === 'team' && (
          <div className="max-w-[1000px] mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 py-12">
             <div className="flex items-center justify-between">
               <div className="space-y-2">
                 <h3 className="text-4xl font-black tracking-tight uppercase">Team <span className="text-[#FDBB00]">Scores</span></h3>
                 <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.4em]">Global Operational KPI Metrics</p>
               </div>
               <div className="flex items-center gap-6">
                 <div className="text-right">
                   <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Unified Performance</p>
                   <p className="text-3xl font-black text-[#FDBB00] tracking-tighter leading-none">{history.length > 0 ? Math.round(history.reduce((a, b) => a + b.result.overallScore, 0) / history.length) : 0}%</p>
                 </div>
                 <BarChart3 className="text-[#FDBB00]" size={32} />
               </div>
             </div>

             <div className="bg-zinc-900/40 border border-white/5 rounded-[3rem] p-10 shadow-xl space-y-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                   <div className="space-y-4">
                     <div className="flex items-center gap-3 text-[#FDBB00]">
                       <Database size={20} />
                       <h3 className="text-lg font-bold uppercase tracking-tight">Agency Sync Hub</h3>
                     </div>
                     <p className="text-zinc-500 max-w-md text-xs leading-relaxed">Consolidate scoreboards from all systems. Export your local master vault or merge teammate data to build a truly global agency performance dashboard.</p>
                   </div>
                   <div className="flex gap-3">
                      <button onClick={exportTeamData} className="px-6 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest border border-white/5 flex items-center gap-2 transition-all"><DownloadCloud size={16} /> Export</button>
                      <button onClick={() => importFileRef.current?.click()} className="px-6 py-4 bg-[#FDBB00] text-black rounded-2xl hover:bg-[#ffc933] text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all"><UploadCloud size={16} strokeWidth={3} /> Merge</button>
                      <input type="file" ref={importFileRef} className="hidden" accept=".json" onChange={importTeamData} />
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {teamStats.map(stat => (
                   <div key={stat.name} className="bg-zinc-900/40 border border-white/5 p-10 rounded-[2.5rem] space-y-8 group hover:border-[#FDBB00]/20 transition-all shadow-lg">
                      <div className="flex items-center justify-between">
                        <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center text-[#FDBB00] border border-white/5 group-hover:scale-110 transition-transform duration-500">
                          <UserCheck size={28} />
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Rating</p>
                          <p className="text-4xl font-black text-white group-hover:text-[#FDBB00] transition-colors tracking-tighter leading-none">{stat.avgScore}%</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-2xl font-bold tracking-tight">{stat.name}</h4>
                        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{stat.count} Audits Finalized</p>
                      </div>
                      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-[#FDBB00] transition-all duration-1000" style={{ width: `${stat.avgScore}%` }} />
                      </div>
                   </div>
                ))}
             </div>
          </div>
        )}
      </main>
      <footer className="max-w-[1700px] mx-auto p-12 text-center opacity-20 border-t border-white/5 select-none">
        <p className="text-[10px] font-black uppercase tracking-[1em]">VideoIQ | Video Review Engine v2.4.0</p>
      </footer>
    </div>
  );
};

export default App;
