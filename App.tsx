
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { 
  Upload, Trophy, Target, ShieldAlert, ShieldCheck, Palette, Activity,
  UserCheck, History as HistoryIcon, Clock, RefreshCcw, Cpu, Zap, AlertCircle, Play, Home, PlayCircle, Layers, Scissors, Split, X, TrendingUp, Users, BarChart3, FileVideo, ChevronRight, Info, CheckCircle2, AlertTriangle, BookOpen, Sparkles, ChevronDown, Download, Share2, Gauge, MousePointer2, Scan, ChevronLeft, Trash2, DownloadCloud, UploadCloud, Database, Link as LinkIcon, MessageSquare, Send, Rss, MessageSquareText, Star, Plus, ExternalLink, Headphones, Volume2, Waves
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { VideoType, AnalysisResult, FrameData, AgencyCategory, HistoryItem, FeedItem, UserFeedback } from './types';
import { analyzeVideoFrames, chatWithMarkerAI } from './services/geminiService';

const TEAM_MEMBERS = ["Akhil", "Siva Prasad", "Theja Sagar", "Sai Teja"];
const MASTER_VAULT_KEY = 'videoiq_master_persistent_vault_v1';
const FEED_VAULT_KEY = 'videoiq_feed_vault_v1';
const FEEDBACK_VAULT_KEY = 'videoiq_feedback_vault_v1';
const LEGACY_VAULT_KEYS = ['videoiq_session_vault_v3', 'videoiq_session_vault', 'videoiq_history_v2'];

const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
  const radius = 65;
  const strokeWidth = 14;
  const dimension = 160;
  const center = dimension / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 85 ? '#22c55e' : score >= 70 ? '#fdbb00' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center w-44 h-44 drop-shadow-[0_0_20px_rgba(0,0,0,0.6)]">
      <svg width={dimension} height={dimension} viewBox={`0 0 ${dimension} ${dimension}`} className="transform -rotate-90">
        <circle cx={center} cy={center} r={radius} stroke="rgba(255,255,255,0.03)" strokeWidth={strokeWidth} fill="transparent" />
        <circle cx={center} cy={center} r={radius} stroke={color} strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} style={{ strokeDashoffset, transition: 'stroke-dashoffset 2s cubic-bezier(0.34, 1.56, 0.64, 1)' }} strokeLinecap="round" />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-4xl font-black text-white leading-none">{score}%</span>
        <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mt-1">Quality</span>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ label: string; score: number; maxScore: number; icon: React.ReactNode }> = ({ label, score, maxScore, icon }) => {
  const percentage = (score / maxScore) * 100;
  const isHigh = percentage >= 80;
  const isMid = percentage >= 60;
  
  return (
    <div className="bg-[#111]/80 backdrop-blur-md border border-white/5 p-5 rounded-3xl hover:bg-white/[0.05] transition-all group border-t-white/10 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2.5 bg-white/5 rounded-xl text-white/40 group-hover:text-[#FDBB00] transition-colors">{icon}</div>
        <span className={`text-[14px] font-black ${isHigh ? 'text-green-400' : isMid ? 'text-yellow-400' : 'text-red-400'}`}>
          {score.toFixed(0)}/{maxScore}
        </span>
      </div>
      <p className="text-[11px] font-black text-white/30 uppercase tracking-widest">{label}</p>
      <div className="mt-3 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
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
  
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackType, setFeedbackType] = useState<UserFeedback['type']>('Improvement');
  const [showFeedForm, setShowFeedForm] = useState(false);
  const [newFeedItem, setNewFeedItem] = useState({ title: '', description: '', url: '', category: 'Gold Standard', tags: '' });

  const videoRef = useRef<HTMLVideoElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

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
    if (!mainFile) return;
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
      setAnalysisResult(result);
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
            const impact = updatedMarker.severity === 'High' ? 10 : updatedMarker.severity === 'Medium' ? 5 : 2;
            newResult.overallScore = Math.min(100, newResult.overallScore + impact);
            
            if (newResult.overallScore >= 90) newResult.final_verdict = 'APPROVED';
            else if (newResult.overallScore >= 75) newResult.final_verdict = 'MINOR FIX REQUIRED';
            else newResult.final_verdict = 'REJECTED';
          } else if (aiResponse.action === 'UPDATE_SEVERITY' && aiResponse.newSeverity) {
            updatedMarker.severity = aiResponse.newSeverity;
          }

          setAnalysisResult(newResult);
          return { ...item, result: newResult };
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
        
        const impact = marker.severity === 'High' ? 10 : marker.severity === 'Medium' ? 5 : 2;
        
        if (marker.isIgnored) {
          marker.isIgnored = false;
          newResult.overallScore = Math.max(0, newResult.overallScore - impact);
        } else {
          marker.isIgnored = true;
          newResult.overallScore = Math.min(100, newResult.overallScore + impact);
        }
        
        if (newResult.overallScore >= 90) newResult.final_verdict = 'APPROVED';
        else if (newResult.overallScore >= 75) newResult.final_verdict = 'MINOR FIX REQUIRED';
        else newResult.final_verdict = 'REJECTED';
        
        setAnalysisResult(newResult);
        return { ...item, result: newResult };
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
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#FDBB00] selection:text-black antialiased">
      <header className="sticky top-0 z-[60] bg-black/80 backdrop-blur-2xl border-b border-white/5 h-20 px-8 flex items-center shadow-2xl overflow-x-auto no-scrollbar">
        <div className="max-w-[1700px] w-full mx-auto flex items-center justify-between gap-10">
          <div className="flex items-center gap-8 shrink-0">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setAnalysisResult(null); setActiveTab('audit'); }}>
              <div className="w-11 h-11 bg-gradient-to-tr from-[#FDBB00] to-orange-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform"><Scan size={24} className="text-black" strokeWidth={3} /></div>
              <h1 className="text-2xl font-black italic tracking-tighter uppercase">VIDEO<span className="text-[#FDBB00]">IQ</span></h1>
            </div>
            <nav className="flex items-center gap-1 bg-[#0a0a0a] p-1.5 rounded-[2rem] border border-white/10 shadow-inner">
              <button onClick={() => setActiveTab('audit')} className={`px-6 py-2.5 rounded-[1.8rem] text-[11px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${activeTab === 'audit' ? 'bg-[#FDBB00] text-black shadow-xl scale-[1.05]' : 'text-white/40 hover:text-white'}`}><Scan size={14} /> Audit</button>
              <button onClick={() => setActiveTab('guidelines')} className={`px-6 py-2.5 rounded-[1.8rem] text-[11px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${activeTab === 'guidelines' ? 'bg-[#FDBB00] text-black shadow-xl scale-[1.05]' : 'text-white/40 hover:text-white'}`}><BookOpen size={14} /> Guidelines</button>
              <button onClick={() => setActiveTab('archive')} className={`px-6 py-2.5 rounded-[1.8rem] text-[11px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${activeTab === 'archive' ? 'bg-[#FDBB00] text-black shadow-xl scale-[1.05]' : 'text-white/40 hover:text-white'}`}><HistoryIcon size={14} /> Archive</button>
              <button onClick={() => setActiveTab('feed')} className={`px-6 py-2.5 rounded-[1.8rem] text-[11px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${activeTab === 'feed' ? 'bg-[#FDBB00] text-black shadow-xl scale-[1.05]' : 'text-white/40 hover:text-white'}`}><Rss size={14} /> Feed</button>
              <button onClick={() => setActiveTab('team')} className={`px-6 py-2.5 rounded-[1.8rem] text-[11px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${activeTab === 'team' ? 'bg-[#FDBB00] text-black shadow-xl scale-[1.05]' : 'text-white/40 hover:text-white'}`}><Users size={14} /> Team</button>
              <button onClick={() => setActiveTab('feedback')} className={`px-6 py-2.5 rounded-[1.8rem] text-[11px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${activeTab === 'feedback' ? 'bg-[#FDBB00] text-black shadow-xl scale-[1.05]' : 'text-white/40 hover:text-white'}`}><MessageSquareText size={14} /> Feedback</button>
            </nav>
          </div>
          <div className="flex items-center gap-6 shrink-0">
            <div className="hidden lg:block text-right"><p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Active Auditor</p><p className="text-[13px] font-black text-white/80 tracking-tight">{selectedAuditor}</p></div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FDBB00]/10 to-orange-500/10 border border-[#FDBB00]/30 flex items-center justify-center text-[#FDBB00] shadow-glow"><UserCheck size={20} /></div>
          </div>
        </div>
      </header>

      <main className="max-w-[1700px] mx-auto p-8">
        {activeTab === 'audit' && (
          isAnalyzing ? (
            <div className="py-44 flex flex-col items-center justify-center space-y-12 animate-in fade-in duration-700">
               <div className="relative"><div className="w-56 h-56 rounded-full border border-white/5 flex items-center justify-center bg-white/[0.01] shadow-[0_0_80px_rgba(253,187,0,0.1)]"><div className="w-40 h-40 rounded-full border-4 border-t-[#FDBB00] border-r-transparent border-b-transparent border-l-transparent animate-spin" /></div><div className="absolute inset-0 flex items-center justify-center"><Cpu className="text-[#FDBB00] animate-pulse" size={56} /></div></div>
               <div className="text-center space-y-6"><h2 className="text-5xl font-black tracking-tighter italic uppercase">Initializing <span className="text-[#FDBB00]">Video Review Core</span></h2><p className="text-[14px] text-white/30 font-mono tracking-[0.6em] uppercase animate-pulse">{loadingText}</p></div>
            </div>
          ) : analysisResult ? (
            <div className="space-y-10 animate-in fade-in duration-700">
              <div className="bg-[#0f0f0f] border border-white/5 rounded-[4rem] p-12 flex flex-col xl:flex-row items-center justify-between gap-12 shadow-3xl border-t-white/10">
                 <div className="flex flex-col md:flex-row items-center gap-16">
                    <ScoreRing score={analysisResult.overall_score} />
                    <div className="space-y-6 text-center md:text-left">
                      <div className="flex flex-wrap items-center gap-4 justify-center md:justify-start">
                        <span className={`px-10 py-3.5 rounded-2xl text-[13px] font-black uppercase tracking-widest border-2 ${
                          analysisResult.verdict === 'PASS' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 
                          analysisResult.verdict === 'NEEDS_REVIEW' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                          'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}>{analysisResult.verdict === 'PASS' ? 'Approved' : analysisResult.verdict === 'NEEDS_REVIEW' ? 'Needs Review' : 'Rejected'}</span>
                        {analysisResult.resubmission_required && (
                          <span className="px-6 py-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-[11px] font-black text-red-400 uppercase tracking-widest">Resubmission Required</span>
                        )}
                        <span className="px-6 py-3.5 rounded-2xl bg-white/5 border border-white/5 text-[11px] font-black text-white/40 uppercase tracking-widest">{selectedType}</span>
                        <div className="flex items-center gap-4 ml-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-white/20 tracking-widest">Points</span>
                            <span className="text-xl font-black text-white">{analysisResult.points_earned}<span className="text-white/20">/{analysisResult.points_possible}</span></span>
                          </div>
                          {analysisResult.critical_failures > 0 && (
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase text-red-500/40 tracking-widest">Critical</span>
                              <span className="text-xl font-black text-red-500">{analysisResult.critical_failures}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-7xl font-black italic tracking-tighter uppercase leading-none">Analysis <span className="text-[#FDBB00]">Complete</span></h2>
                        <p className="text-white/40 text-sm font-medium italic">{analysisResult.verdict_message}</p>
                      </div>
                    </div>
                 </div>
                 <div className="flex flex-col sm:flex-row gap-5">
                   <button onClick={() => { setAnalysisResult(null); setMainFile(null); }} className="px-10 py-6 bg-white/5 hover:bg-white/10 rounded-2xl text-[14px] font-black uppercase tracking-widest border border-white/5 flex items-center gap-3 transition-all"><RefreshCcw size={22} /> New Audit</button>
                   <button onClick={downloadReport} className="px-10 py-6 bg-[#FDBB00] text-black rounded-2xl hover:scale-105 transition-all shadow-3xl text-[14px] font-black uppercase tracking-widest flex items-center gap-3"><Download size={22} strokeWidth={3} /> Save Report</button>
                 </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                <div className="xl:col-span-8 space-y-10">
                  <div className="bg-black rounded-[4rem] overflow-hidden border border-white/5 aspect-video shadow-2xl relative ring-[12px] ring-[#111]">
                    {mainVideoUrl ? <video ref={videoRef} src={mainVideoUrl} controls className="w-full h-full object-contain" /> : <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0a0a] text-white/5 italic"><PlayCircle size={120} strokeWidth={0.5} /><p className="mt-4 font-black uppercase tracking-[0.5em]">Playback Stream Unlinked</p></div>}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <MetricCard label="Hook Performance" score={analysisResult.hook_performance.score} maxScore={47} icon={<Scissors size={20} />} />
                    <MetricCard label="Motion Graphics" score={analysisResult.motion_graphics.score} maxScore={68} icon={<Target size={20} />} />
                    <MetricCard label="Visual & Technical" score={analysisResult.visual_technical.score} maxScore={52} icon={<ShieldAlert size={20} />} />
                    <MetricCard label="Messaging & Copy" score={analysisResult.messaging_copy.score} maxScore={58} icon={<ShieldCheck size={20} />} />
                    <MetricCard label="Audio & Captions" score={analysisResult.audio_captions.score} maxScore={38} icon={<Volume2 size={20} />} />
                    <MetricCard label="Platform Policy" score={analysisResult.platform_policy.score} maxScore={57} icon={<Gauge size={20} />} />
                  </div>

                  <div className="bg-[#0f0f0f] border border-white/5 p-12 rounded-[3.5rem] space-y-6 shadow-2xl group relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-10 opacity-[0.03] rotate-12"><BookOpen size={120} /></div>
                     <div className="flex items-center gap-4 text-[#FDBB00] mb-2"><Waves size={28} /><h3 className="text-3xl font-black uppercase tracking-tighter italic">Technical Narrative</h3></div>
                     <p className="text-white/70 text-[20px] leading-relaxed font-medium italic relative z-10">"{analysisResult.overall_summary}"</p>
                  </div>
                </div>

                <div className="xl:col-span-4 space-y-10">
                  <div className="bg-[#0f0f0f] border border-white/5 rounded-[4rem] h-full flex flex-col overflow-hidden shadow-2xl border-t-[#FDBB00]/20 min-h-[900px]">
                    <div className="p-10 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-4"><Clock size={28} className="text-[#FDBB00]" /><h3 className="text-2xl font-black italic tracking-tighter uppercase">Audit <span className="text-[#FDBB00]">Markers</span></h3></div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                      {analysisResult.timestamped_betterment.map((marker, i) => (
                        <div key={i} className={`bg-white/[0.02] border p-8 rounded-[3rem] transition-all flex flex-col gap-6 shadow-inner ${marker.isIgnored ? 'opacity-40 grayscale' : ''} ${activeCommentMarker === i ? 'border-[#FDBB00]/50 bg-[#FDBB00]/5' : 'border-white/5 hover:border-[#FDBB00]/30'}`}>
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <span className="text-[14px] font-black text-[#FDBB00] bg-[#FDBB00]/10 px-6 py-2.5 rounded-2xl border border-[#FDBB00]/20 font-mono shadow-md">{marker.timestamp}</span>
                                 <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                                   marker.isIgnored ? 'bg-white/10 border-white/20 text-white/40' :
                                   marker.severity === 'Critical' ? 'bg-red-600 border-red-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]' :
                                   marker.severity === 'High' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                   marker.severity === 'Medium' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                                   'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                 }`}>
                                   {marker.isIgnored ? 'Ignored' : marker.severity}
                                 </span>
                                {mainVideoUrl && <button onClick={() => seekToTimestamp(marker.timestamp)} className="w-12 h-12 bg-[#FDBB00]/10 hover:bg-[#FDBB00] hover:text-black rounded-xl flex items-center justify-center transition-all shadow-xl group/play"><Play size={20} fill="currentColor" /></button>}
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={() => setActiveCommentMarker(activeCommentMarker === i ? null : i)} className={`p-3 rounded-xl transition-all ${activeCommentMarker === i ? 'bg-[#FDBB00] text-black' : 'bg-white/5 text-white/40 hover:text-white'}`}><MessageSquare size={20} /></button>
                              </div>
                           </div>
                           <div className="space-y-4">
                             <p className="text-[17px] font-bold text-white/90 leading-snug">{marker.description}</p>
                             <div className="bg-[#FDBB00]/5 p-6 rounded-[2rem] border-l-4 border-[#FDBB00] flex items-start gap-4 shadow-inner">
                                <Zap size={20} className="text-[#FDBB00] shrink-0 mt-1" />
                                <div className="space-y-1"><p className="text-[11px] font-black uppercase text-[#FDBB00] tracking-[0.2em]">Fix Recommendation</p><p className="text-[15px] font-black text-white leading-relaxed">{marker.actionable_fix}</p></div>
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
            <div className="max-w-[1200px] mx-auto space-y-16 animate-in fade-in slide-in-from-bottom-12 duration-1000 py-10">
               <div className="text-center space-y-8"><h2 className="text-[100px] font-black italic tracking-tighter uppercase leading-[0.8] tracking-[-0.04em]"><span className="text-[#FDBB00]">Video</span><br/>Review Engine</h2><p className="text-[16px] font-black text-white/20 uppercase tracking-[0.8em]">Technical Content Audit Protocol</p></div>
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-8 space-y-8">
                    <div 
                      className={`bg-[#0f0f0f] border-2 border-dashed rounded-[5rem] p-36 text-center cursor-pointer group shadow-3xl relative overflow-hidden transition-all duration-700 ${mainFile ? 'border-green-500/40 bg-green-500/5' : isDragging ? 'border-[#FDBB00] bg-[#FDBB00]/[0.05]' : 'border-white/5 hover:border-[#FDBB00] hover:bg-[#FDBB00]/[0.02]'}`} 
                      onClick={() => document.getElementById('main-input')?.click()}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <input id="main-input" type="file" className="hidden" accept="video/*" onChange={e => e.target.files?.[0] && setMainFile(e.target.files[0])} />
                      <div className="w-32 h-32 bg-white/5 rounded-[3rem] flex items-center justify-center mx-auto mb-12 group-hover:scale-110 transition-all shadow-3xl border border-white/5 shadow-[0_0_50px_rgba(253,187,0,0.05)]">{mainFile ? <CheckCircle2 className="text-green-500" size={56} /> : <Upload className="text-[#FDBB00]" size={56} />}</div>
                      <h4 className="text-5xl font-black mb-6 tracking-tighter">{mainFile ? mainFile.name : 'Staging Asset for Review'}</h4>
                      <p className="text-[16px] font-bold text-white/20 uppercase tracking-[0.4em]">{isDragging ? 'Drop to Upload' : 'Optimized for UHD Playback Containers'}</p>
                    </div>
                  </div>
                 <div className="lg:col-span-4 space-y-8">
                   <div className="bg-[#0f0f0f] border border-white/5 rounded-[4rem] p-12 space-y-12 shadow-3xl border-t-white/10">
                      <div className="space-y-6"><p className="text-[12px] font-black text-white/30 uppercase tracking-[0.4em]">Review Context</p><div className="space-y-3">{(['Social Media', 'Ad / Commercial', 'Educational', 'Entertainment'] as VideoType[]).map(t => (<button key={t} onClick={() => setSelectedType(t)} className={`w-full px-8 py-5 rounded-2xl text-[14px] font-black text-left flex items-center justify-between border transition-all ${selectedType === t ? 'bg-[#FDBB00] border-[#FDBB00] text-black shadow-3xl scale-[1.03]' : 'bg-white/[0.02] border-white/5 text-white/40 hover:border-white/20 hover:text-white'}`}>{t} {selectedType === t && <CheckCircle2 size={20} strokeWidth={3} />}</button>))}</div></div>
                      <div className="space-y-6"><p className="text-[12px] font-black text-white/30 uppercase tracking-[0.4em]">Assigned Auditor</p><div className="grid grid-cols-2 gap-3">{TEAM_MEMBERS.map(m => (<button key={m} onClick={() => setSelectedAuditor(m)} className={`px-6 py-5 rounded-2xl text-[13px] font-black border transition-all ${selectedAuditor === m ? 'bg-white/10 border-white/30 text-white shadow-2xl scale-[1.05]' : 'bg-transparent border-white/5 text-white/30 hover:border-white/10 hover:text-white'}`}>{m}</button>))}</div></div>
                   </div>
                   <button disabled={!mainFile} onClick={runAnalysis} className="w-full py-14 bg-gradient-to-tr from-[#FDBB00] to-orange-500 text-black font-black text-3xl rounded-[4rem] uppercase tracking-[0.5em] shadow-[0_40px_80px_-20px_rgba(253,187,0,0.4)] hover:scale-[1.03] active:scale-95 transition-all disabled:opacity-20 disabled:grayscale group relative overflow-hidden"><span className="relative z-10 group-hover:tracking-[0.7em] transition-all duration-700">Initiate Review</span><div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-700" /></button>
                 </div>
               </div>
            </div>
          )
        )}

        {activeTab === 'guidelines' && (
          <div className="max-w-[1400px] mx-auto space-y-20 animate-in fade-in slide-in-from-bottom-10 py-10">
            <div className="text-center space-y-6">
              <h3 className="text-8xl font-black italic tracking-tighter uppercase leading-none">Quality <span className="text-[#FDBB00]">Benchmarks</span></h3>
              <p className="text-[16px] font-black text-white/20 uppercase tracking-[0.8em]">3DM Agency Video Review Protocol</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              {/* Format Standards */}
              <div className="lg:col-span-5 bg-[#0f0f0f] border border-white/5 rounded-[4rem] p-12 shadow-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-[0.02] rotate-12"><FileVideo size={160} /></div>
                <div className="space-y-8 relative z-10">
                  <div className="flex items-center gap-4 text-[#FDBB00]"><FileVideo size={32} /><h4 className="text-3xl font-black italic tracking-tighter uppercase">Format Standards</h4></div>
                  <div className="space-y-4">
                    {[
                      { label: 'Aspect Ratio', value: '9:16 Preferred' },
                      { label: 'Resolution', value: '1080 × 1920 Minimum' },
                      { label: 'Frame Rate', value: '24fps or 30fps' },
                      { label: 'Codec', value: 'H.264 / H.265' },
                      { label: 'Bitrate', value: '8–20 Mbps' },
                      { label: 'Duration', value: '6–45 seconds' },
                      { label: 'File Format', value: 'MP4' }
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-4 border-b border-white/5 last:border-0">
                        <span className="text-[11px] font-black uppercase tracking-widest text-white/30">{item.label}</span>
                        <span className="text-[15px] font-black text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quality Breakdown */}
              <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-8">
                {[
                  { title: 'Hook Performance', weight: '20%', icon: <Scissors />, color: 'text-[#FDBB00]', items: ['Strong 3s hook', 'No dead frames', 'Property ID by 2s', 'Headline by 2s', 'No logo-first'] },
                  { title: 'Motion Graphics', weight: '20%', icon: <Target />, color: 'text-blue-400', items: ['Natural easing', 'Legible typography', 'Consistent transitions', 'Visual hierarchy', 'Hold durations'] },
                  { title: 'Visual & Technical', weight: '15%', icon: <ShieldAlert />, color: 'text-red-400', items: ['Resolution compliance', 'No artifacts', 'Consistent grading', 'Safe zones', 'Correct codec'] },
                  { title: 'Messaging & Copy', weight: '15%', icon: <ShieldCheck />, color: 'text-green-400', items: ['Benefit-led headlines', 'No spelling errors', 'Price accuracy', 'Location clarity', 'Single CTA'] },
                  { title: 'Audio & Captions', weight: '15%', icon: <Volume2 />, color: 'text-purple-400', items: ['Balanced VO/Music mix', 'No clipping/distortion', 'Tone matches positioning', 'Accurate captions', 'Clean audio fades'] },
                  { title: 'Platform Policy', weight: '15%', icon: <Gauge />, color: 'text-orange-400', items: ['No unverified ROI claims', 'No discriminatory language', 'Text-to-image ratio', 'Pacing by segment', 'Regulatory disclaimers'] }
                ].map((cat, idx) => (
                  <div key={idx} className="bg-[#0f0f0f] border border-white/5 rounded-[3.5rem] p-10 space-y-6 hover:border-white/10 transition-all group">
                    <div className="flex items-center justify-between">
                      <div className={`p-4 bg-white/5 rounded-2xl ${cat.color} group-hover:scale-110 transition-transform`}>{React.cloneElement(cat.icon as React.ReactElement, { size: 24 })}</div>
                      <span className="text-2xl font-black italic text-white/20">{cat.weight}</span>
                    </div>
                    <div className="space-y-4">
                      <h5 className="text-xl font-black uppercase tracking-tighter italic">{cat.title}</h5>
                      <ul className="space-y-2">
                        {cat.items.map((item, i) => (
                          <li key={i} className="flex items-center gap-3 text-[13px] text-white/50 font-medium italic">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/10" /> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Unified Decision Protocol */}
            <div className="bg-gradient-to-br from-[#0f0f0f] to-black border border-white/5 rounded-[5rem] p-16 shadow-3xl relative overflow-hidden space-y-16">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#FDBB00] to-transparent" />
               
               <div className="flex flex-col xl:flex-row justify-between gap-16">
                  <div className="space-y-8 xl:w-1/3">
                    <div className="space-y-4">
                      <h4 className="text-5xl font-black italic tracking-tighter uppercase">Approval <span className="text-[#FDBB00]">Protocol</span></h4>
                      <p className="text-[14px] font-black text-white/20 uppercase tracking-[0.4em]">Standardized Decision Logic</p>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="flex items-center gap-4 text-[#FDBB00]"><Zap size={24} /><h5 className="text-xl font-black uppercase tracking-widest italic">Weighted Point System</h5></div>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { label: 'Critical', points: '10 pts', color: 'text-red-500' },
                          { label: 'High', points: '5 pts', color: 'text-orange-500' },
                          { label: 'Medium', points: '2 pts', color: 'text-yellow-500' },
                          { label: 'Low', points: '1 pt', color: 'text-blue-500' }
                        ].map((w, i) => (
                          <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/30">{w.label}</span>
                            <span className={`${w.color} font-black text-sm`}>{w.points}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4 pt-4">
                      <div className="flex items-center gap-4 text-[#FDBB00]"><ShieldCheck size={24} /><h5 className="text-xl font-black uppercase tracking-widest italic">Priority Rules</h5></div>
                      <ul className="space-y-3">
                        {[
                          'ANY Critical failure = REJECTED',
                          'Score ≥ 85 + 0 Critical + ≤ 3 High = APPROVED',
                          'Score ≥ 65 + 0 Critical = NEEDS REVIEW',
                          'Score < 65 = REJECTED'
                        ].map((rule, i) => (
                          <li key={i} className="flex items-center gap-3 text-[13px] font-black italic text-white/40">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#FDBB00]" /> {rule}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="xl:w-2/3 flex flex-wrap justify-center xl:justify-end gap-8 self-center">
                    {[
                      { score: '85–100', status: 'Approved', action: 'Ready for Publishing', color: 'text-green-400', bg: 'bg-green-500/10', note: '0 Critical Failures' },
                      { score: '65–84', status: 'Needs Review', action: 'Revision Recommended', color: 'text-[#FDBB00]', bg: 'bg-[#FDBB00]/10', note: '0 Critical Failures' },
                      { score: 'Below 65', status: 'Rejected', action: 'Re-edit Required', color: 'text-red-400', bg: 'bg-red-500/10', note: 'Or Any Critical Failure' }
                    ].map((m, i) => (
                      <div key={i} className={`${m.bg} border border-white/5 rounded-[4rem] p-12 text-center space-y-6 min-w-[280px] hover:scale-105 transition-all group relative overflow-hidden shadow-2xl`}>
                        <div className="absolute top-0 right-0 p-6 opacity-[0.05] group-hover:opacity-10 transition-opacity"><ShieldCheck size={60} /></div>
                        <div className="text-5xl font-black text-white tracking-tighter">{m.score}</div>
                        <div className="space-y-1">
                          <div className={`text-[14px] font-black uppercase tracking-[0.2em] ${m.color}`}>{m.status}</div>
                          <div className="text-[13px] font-medium italic text-white/40">{m.action}</div>
                        </div>
                        <div className="pt-6 border-t border-white/5 text-[10px] font-black uppercase tracking-widest text-white/20">{m.note}</div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          </div>
        )}
        {activeTab === 'feed' && (
           <div className="max-w-[1400px] mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-10 py-10">
              <div className="flex flex-col md:flex-row items-center justify-between border-b border-white/5 pb-12 gap-8">
                <div className="space-y-3">
                  <h3 className="text-7xl font-black italic tracking-tighter uppercase leading-none">Best <span className="text-[#FDBB00]">Practices</span></h3>
                  <p className="text-[14px] font-black text-white/20 uppercase tracking-[0.5em]">Global Creative Standard Benchmarks</p>
                </div>
                <button onClick={() => setShowFeedForm(true)} className="px-10 py-5 bg-[#FDBB00] text-black rounded-3xl font-black uppercase tracking-widest text-[13px] flex items-center gap-3 shadow-3xl hover:scale-105 transition-all"><Plus size={20} strokeWidth={3} /> Stage New Benchmark</button>
              </div>

              {showFeedForm && (
                <div className="bg-[#0f0f0f] border border-[#FDBB00]/20 p-12 rounded-[4rem] shadow-3xl space-y-10 animate-in zoom-in duration-300 relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-[#FDBB00] to-transparent opacity-50" />
                   <div className="flex items-center justify-between"><h4 className="text-3xl font-black italic tracking-tighter uppercase">Agency <span className="text-[#FDBB00]">Creative Feed</span></h4><button onClick={() => setShowFeedForm(false)} className="text-white/20 hover:text-white p-2 hover:bg-white/5 rounded-full transition-all"><X size={32} /></button></div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-3"><label className="text-[11px] font-black uppercase tracking-widest text-white/30">Creative Title</label><input type="text" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-[#FDBB00] transition-all" value={newFeedItem.title} onChange={e => setNewFeedItem({...newFeedItem, title: e.target.value})} placeholder="Ex: Optimized Pacing Hook" /></div>
                     <div className="space-y-3"><label className="text-[11px] font-black uppercase tracking-widest text-white/30">Asset Location URL</label><input type="text" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-[#FDBB00] transition-all" value={newFeedItem.url} onChange={e => setNewFeedItem({...newFeedItem, url: e.target.value})} placeholder="Internal or External link" /></div>
                     <div className="space-y-3"><label className="text-[11px] font-black uppercase tracking-widest text-white/30">Benchmark Category</label><select className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-[#FDBB00] transition-all" value={newFeedItem.category} onChange={e => setNewFeedItem({...newFeedItem, category: e.target.value})}><option>Gold Standard</option><option>High Conversion</option><option>Best Hook</option><option>Technical Peak</option></select></div>
                     <div className="space-y-3"><label className="text-[11px] font-black uppercase tracking-widest text-white/30">Technical Tags</label><input type="text" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-[#FDBB00] transition-all" value={newFeedItem.tags} onChange={e => setNewFeedItem({...newFeedItem, tags: e.target.value})} placeholder="Separate with commas" /></div>
                     <div className="md:col-span-2 space-y-3"><label className="text-[11px] font-black uppercase tracking-widest text-white/30">Technical Rationale</label><textarea className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-[#FDBB00] min-h-[100px] transition-all" value={newFeedItem.description} onChange={e => setNewFeedItem({...newFeedItem, description: e.target.value})} placeholder="Why is this asset technically efficient?" /></div>
                   </div>
                   <button onClick={addFeedItem} className="w-full py-6 bg-gradient-to-tr from-[#FDBB00] to-orange-500 text-black font-black uppercase tracking-widest rounded-3xl shadow-3xl shadow-yellow-500/10 hover:scale-[1.01] transition-all">Broadcast Technical Inspo</button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {feedItems.length > 0 ? feedItems.map(item => (
                  <div key={item.id} className="bg-[#0f0f0f] border border-white/5 rounded-[3.5rem] overflow-hidden group hover:border-[#FDBB00]/40 transition-all shadow-3xl hover:translate-y-[-8px]">
                     <div className="aspect-video bg-[#0a0a0a] relative flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-tr from-[#FDBB00]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <PlayCircle size={64} className="text-white/5 group-hover:text-[#FDBB00] group-hover:scale-110 transition-all duration-700" />
                        <div className="absolute top-6 right-6 px-4 py-2 bg-black/80 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 text-[#FDBB00] shadow-glow">{item.category}</div>
                     </div>
                     <div className="p-10 space-y-6">
                        <div className="space-y-2">
                           <h4 className="text-2xl font-black italic tracking-tighter group-hover:text-[#FDBB00] transition-colors">{item.title}</h4>
                           <p className="text-white/40 text-[14px] leading-relaxed line-clamp-3 italic">"{item.description}"</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                           {item.tags.map(tag => <span key={tag} className="px-3 py-1.5 bg-white/5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white/30 border border-white/5 group-hover:border-[#FDBB00]/20 transition-all">#{tag}</span>)}
                        </div>
                        <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                           <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-[#FDBB00]/10 border border-[#FDBB00]/20 flex items-center justify-center text-[#FDBB00] text-[10px] font-black shadow-glow">{item.addedBy[0]}</div><p className="text-[11px] font-black text-white/40 uppercase tracking-widest">{item.addedBy}</p></div>
                           {item.url && <a href={item.url} target="_blank" className="p-3 bg-white/5 hover:bg-[#FDBB00] hover:text-black rounded-xl transition-all shadow-xl"><ExternalLink size={18} /></a>}
                        </div>
                     </div>
                  </div>
                )) : (
                  <div className="lg:col-span-3 py-44 text-center opacity-10 flex flex-col items-center select-none">
                    <Sparkles size={120} strokeWidth={0.5} className="mb-8 animate-pulse" />
                    <p className="text-4xl font-black uppercase tracking-[0.6em]">No staged benchmarks</p>
                  </div>
                )}
              </div>
           </div>
        )}

        {activeTab === 'feedback' && (
           <div className="max-w-4xl mx-auto space-y-16 animate-in fade-in slide-in-from-bottom-10 py-10">
              <div className="text-center space-y-6">
                 <h3 className="text-7xl font-black italic tracking-tighter uppercase leading-none">System <span className="text-[#FDBB00]">Evolution</span></h3>
                 <p className="text-[14px] font-black text-white/20 uppercase tracking-[0.5em]">Refining the Review Engine Algorithm</p>
              </div>

              <div className="bg-[#0f0f0f] border border-white/5 p-12 rounded-[4rem] shadow-3xl space-y-12 border-t-white/5">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   <div className="space-y-4">
                      <p className="text-[11px] font-black uppercase tracking-widest text-white/30">User Sentiment</p>
                      <div className="flex gap-4">
                        {[1, 2, 3, 4, 5].map(s => (
                          <button key={s} onClick={() => setFeedbackRating(s)} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${feedbackRating >= s ? 'bg-[#FDBB00] text-black shadow-[0_0_30px_rgba(253,187,0,0.3)]' : 'bg-white/5 text-white/20 hover:bg-white/10'}`}>
                            <Star size={24} fill={feedbackRating >= s ? "currentColor" : "none"} strokeWidth={2.5} />
                          </button>
                        ))}
                      </div>
                   </div>
                   <div className="space-y-4">
                      <p className="text-[11px] font-black uppercase tracking-widest text-white/30">Update Category</p>
                      <div className="flex flex-wrap gap-2">
                        {['Improvement', 'Bug', 'Feature', 'Other'].map(t => (
                          <button key={t} onClick={() => setFeedbackType(t as any)} className={`px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${feedbackType === t ? 'bg-white/10 border-white/40 text-white shadow-xl' : 'bg-white/5 border-transparent text-white/20 hover:text-white/40'}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                   </div>
                 </div>
                 <div className="space-y-4">
                   <p className="text-[11px] font-black uppercase tracking-widest text-white/30">Protocol Suggestion / Field Report</p>
                   <textarea value={feedbackMsg} onChange={e => setFeedbackMsg(e.target.value)} placeholder="What can we refine in the Video Review Engine?" className="w-full bg-white/5 border border-white/10 rounded-3xl px-8 py-6 outline-none focus:border-[#FDBB00] min-h-[160px] text-lg italic transition-all" />
                 </div>
                 <button onClick={submitFeedback} className="w-full py-8 bg-gradient-to-tr from-[#FDBB00] to-orange-500 text-black font-black uppercase tracking-[0.4em] rounded-[2.5rem] shadow-[0_20px_60px_-10px_rgba(253,187,0,0.4)] hover:scale-[1.02] transition-all">Submit Protocol Suggestion</button>
              </div>

              <div className="space-y-8">
                 <h4 className="text-2xl font-black italic tracking-tighter uppercase opacity-30">Agency Development Log</h4>
                 <div className="space-y-6">
                    {feedbacks.length > 0 ? feedbacks.slice(0, 5).map(fb => (
                      <div key={fb.id} className="bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] flex items-start gap-6 hover:bg-white/[0.04] transition-all group">
                         <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 border border-white/5 group-hover:border-[#FDBB00]/30 transition-all">
                            {fb.type === 'Bug' ? <AlertTriangle className="text-red-400" size={24} /> : <Sparkles className="text-[#FDBB00]" size={24} />}
                         </div>
                         <div className="space-y-2">
                            <div className="flex items-center gap-4">
                               <p className="text-[13px] font-black text-[#FDBB00] uppercase tracking-widest">{fb.user}</p>
                               <span className="text-white/10 text-[10px] uppercase font-black tracking-widest">{new Date(fb.date).toLocaleDateString()}</span>
                            </div>
                            <p className="text-white/70 italic leading-relaxed">"{fb.message}"</p>
                         </div>
                      </div>
                    )) : <p className="text-center text-white/10 py-10 uppercase tracking-[0.6em] font-black text-sm italic">Log core empty</p>}
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'archive' && (
           <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-10 py-10">
              <div className="flex items-center justify-between border-b border-white/5 pb-12 gap-8">
                <div className="space-y-3"><h3 className="text-7xl font-black italic tracking-tighter uppercase leading-none">Session <span className="text-[#FDBB00]">Vault</span></h3><p className="text-[14px] font-black text-white/20 uppercase tracking-[0.5em]">Permanent Agency Review Archives</p></div>
                <div className="flex items-center gap-8"><span className="text-[16px] font-black text-white/30 uppercase tracking-widest bg-white/5 px-8 py-4 rounded-3xl border border-white/5 shadow-inner">{history.length} SESSIONS SAVED</span>{history.length > 0 && <button onClick={clearHistory} className="p-6 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-[2rem] transition-all border border-red-500/20 shadow-3xl group"><Trash2 size={28} className="group-hover:scale-110 transition-transform" /></button>}</div>
              </div>
              {history.length > 0 ? (
                <div className="grid grid-cols-1 gap-8">
                  {history.map(item => (
                    <div key={item.id} className="bg-[#0f0f0f] border border-white/5 p-12 rounded-[4rem] flex flex-col md:flex-row items-center justify-between hover:border-[#FDBB00]/40 transition-all group cursor-pointer shadow-3xl border-t-white/10 gap-8" onClick={() => loadFromHistory(item)}>
                      <div className="flex items-center gap-12"><div className="w-28 h-28 bg-white/5 rounded-[2.5rem] flex items-center justify-center text-white/10 group-hover:text-[#FDBB00] transition-all border border-white/5 shadow-inner duration-500"><FileVideo size={56} strokeWidth={1} /></div><div className="space-y-3"><h4 className="text-4xl font-black group-hover:text-white transition-colors tracking-tighter">{item.fileName}</h4><div className="flex flex-wrap items-center gap-12 text-[14px] font-bold text-white/30 uppercase tracking-widest mt-1"><span className="flex items-center gap-3"><UserCheck size={20} className="text-[#FDBB00] shadow-glow" /> {item.auditorName}</span><span className="flex items-center gap-3"><Clock size={20} /> {new Date(item.date).toLocaleDateString()}</span><span className="px-5 py-2 bg-white/5 rounded-2xl text-[11px] font-black border border-white/5">{item.result.videoType}</span></div></div></div>
                      <div className="flex items-center gap-16 w-full md:w-auto justify-between md:justify-end"><div className="text-right space-y-2 shrink-0"><p className="text-[14px] font-black text-white/20 uppercase tracking-widest">Master Quality Score</p><p className={`text-6xl font-black ${item.result.overallScore >= 75 ? 'text-green-500' : 'text-red-500'} tracking-tighter`}>{item.result.overallScore}%</p></div><div className="p-8 bg-white/5 rounded-[2.5rem] group-hover:bg-[#FDBB00] group-hover:text-black transition-all duration-500 shadow-3xl"><ChevronRight size={40} strokeWidth={4} /></div></div>
                    </div>
                  ))}
                </div>
              ) : ( <div className="py-64 text-center opacity-10 flex flex-col items-center select-none"><HistoryIcon size={160} strokeWidth={0.5} className="mb-12 animate-pulse" /><p className="text-5xl font-black uppercase tracking-[0.8em]">Vault core empty</p></div> )}
           </div>
        )}

        {activeTab === 'team' && (
          <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-10 py-10">
             <div className="flex items-center justify-between border-b border-white/5 pb-12 gap-8"><div className="space-y-3"><h3 className="text-7xl font-black italic tracking-tighter uppercase leading-none">Team <span className="text-[#FDBB00]">Scores</span></h3><p className="text-[14px] font-black text-white/20 uppercase tracking-[0.5em]">Global Operational KPI Metrics</p></div><div className="flex items-center gap-8"><div className="text-right space-y-1"><p className="text-[12px] font-black text-white/20 uppercase tracking-widest">Unified Performance</p><p className="text-5xl font-black text-[#FDBB00] tracking-tighter leading-none shadow-glow">{history.length > 0 ? Math.round(history.reduce((a, b) => a + b.result.overallScore, 0) / history.length) : 0}%</p></div><BarChart3 className="text-[#FDBB00] shadow-glow" size={64} /></div></div>
             <div className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-white/10 rounded-[4rem] p-12 shadow-3xl relative group overflow-hidden border-t-white/10">
                <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity duration-700"><Database size={200} /></div>
                <div className="flex flex-col md:flex-row items-center justify-between gap-10 relative z-10">
                   <div className="space-y-4 text-center md:text-left"><div className="flex items-center gap-3 text-[#FDBB00] justify-center md:justify-start"><Database size={24} className="shadow-glow" /><h3 className="text-2xl font-black uppercase tracking-tighter">Agency Sync Hub</h3></div><p className="text-white/40 max-w-md text-[15px] leading-relaxed">Consolidate scoreboards from all systems. Export your local master vault or merge teammate data to build a truly global agency performance dashboard.</p></div>
                   <div className="flex flex-wrap gap-4 justify-center">
                      <button onClick={exportTeamData} className="px-8 py-5 bg-white/5 hover:bg-white/10 rounded-2xl text-[12px] font-black uppercase tracking-widest border border-white/10 flex items-center gap-3 shadow-xl transition-all"><DownloadCloud size={20} /> Master Export</button>
                      <button onClick={() => importFileRef.current?.click()} className="px-8 py-5 bg-[#FDBB00] text-black rounded-2xl hover:scale-105 shadow-3xl text-[12px] font-black uppercase tracking-widest flex items-center gap-3 transition-all"><UploadCloud size={20} strokeWidth={3} /> Merge Records</button>
                      <input type="file" ref={importFileRef} className="hidden" accept=".json" onChange={importTeamData} />
                   </div>
                </div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {teamStats.map(stat => (
                   <div key={stat.name} className="bg-[#0f0f0f] border border-white/5 p-14 rounded-[5rem] relative overflow-hidden group hover:border-[#FDBB00]/40 transition-all border-t-white/10 shadow-3xl">
                      <div className="flex items-center justify-between mb-16 relative z-10"><div className="w-24 h-24 rounded-[2rem] bg-white/5 flex items-center justify-center text-[#FDBB00] border border-white/5 group-hover:scale-110 shadow-2xl transition-all duration-700 shadow-glow"><UserCheck size={48} /></div><div className="text-right"><p className="text-[14px] font-black text-white/20 uppercase tracking-widest mb-1">Efficiency Rating</p><p className="text-6xl font-black text-white group-hover:text-[#FDBB00] transition-colors tracking-tighter leading-none">{stat.avgScore}%</p></div></div>
                      <div className="relative z-10 space-y-3"><h4 className="text-5xl font-black text-white tracking-tighter">{stat.name}</h4><p className="text-[16px] font-bold text-white/30 uppercase tracking-[0.3em]">{stat.count} Audits Finalized</p></div>
                      <div className="mt-14 h-3 w-full bg-white/5 rounded-full overflow-hidden relative z-10 shadow-inner"><div className="h-full bg-gradient-to-r from-[#FDBB00] to-orange-500 transition-all duration-1000 shadow-[0_0_20px_rgba(253,187,0,0.6)]" style={{ width: `${stat.avgScore}%` }} /></div>
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
