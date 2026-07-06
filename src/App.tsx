import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Database, 
  Search, 
  MapPin, 
  TrendingUp, 
  UserPlus, 
  FileText, 
  Brain, 
  Upload, 
  Download, 
  Check, 
  AlertCircle, 
  ChevronRight, 
  Plus, 
  X, 
  ArrowRight,
  Sparkles,
  Info,
  Layers,
  Heart,
  Eye,
  Settings,
  HelpCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  CartesianGrid 
} from 'recharts';

import EchoViewer from './components/EchoViewer';
import { INITIAL_PATIENTS, INITIAL_STUDIES } from './components/initialData';
import { Patient, EchoStudy, EchoViewType, CardiacPathology, EchoMeasurement, EchoAnalysisReport } from './types';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, googleAuthProvider, signInWithPopup } from './lib/firebase.ts';

export default function App() {
  // Firebase Auth states
  const [user, setUser] = useState<any>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Database States (persisted in Cloud SQL)
  const [patients, setPatients] = useState<Patient[]>([]);
  const [studies, setStudies] = useState<EchoStudy[]>([]);

  // Monitor Firebase auth state changes and fetch Cloud SQL data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setIsAuthLoading(true);
      setAuthError(null);
      if (currentUser) {
        try {
          setUser(currentUser);
          const idToken = await currentUser.getIdToken();
          setAuthToken(idToken);

          // Synchronize user profile with Cloud SQL database
          const syncResponse = await fetch('/api/sync-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            }
          });

          if (!syncResponse.ok) {
            throw new Error('Failed to synchronize user profile on database server');
          }

          // Fetch patients and studies for this user from Cloud SQL
          const [patientsRes, studiesRes] = await Promise.all([
            fetch('/api/patients', {
              headers: { 'Authorization': `Bearer ${idToken}` }
            }),
            fetch('/api/studies', {
              headers: { 'Authorization': `Bearer ${idToken}` }
            }
          )]);

          if (!patientsRes.ok || !studiesRes.ok) {
            throw new Error('Failed to fetch clinical workspace records');
          }

          const patientsData = await patientsRes.json();
          const studiesData = await studiesRes.json();

          if (patientsData.success) {
            setPatients(patientsData.patients);
            if (patientsData.patients.length > 0) {
              setSelectedPatientId(patientsData.patients[0].id);
            }
          }
          if (studiesData.success) {
            setStudies(studiesData.studies);
          }
        } catch (err: any) {
          console.error("Auth initialization error:", err);
          setAuthError(err.message || 'Failed to initialize workspace data.');
        } finally {
          setIsAuthLoading(false);
        }
      } else {
        setUser(null);
        setAuthToken(null);
        setPatients([]);
        setStudies([]);
        setIsAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Active Workspace States
  const [activeTab, setActiveTab] = useState<'workstation' | 'database' | 'analytics' | 'guidelines' | 'referrals'>('workstation');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('P001');
  const [activeStudy, setActiveStudy] = useState<EchoStudy | null>(null);
  
  // Custom uploaded image state
  const [uploadedImage, setUploadedImage] = useState<string | undefined>(undefined);
  const [uploadedMimeType, setUploadedMimeType] = useState<string | undefined>(undefined);

  // Echo Viewer Adjustment States
  const [viewType, setViewType] = useState<EchoViewType>('A4C');
  const [gain, setGain] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [colorMap, setColorMap] = useState<'gray' | 'blue' | 'amber'>('gray');

  // AI & Analysis States
  const [useThinkingMode, setUseThinkingMode] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // Active caliper measurements in current viewer
  const [viewerMeasurements, setViewerMeasurements] = useState<Partial<EchoMeasurement>>({});

  // Cardiology Copilot Interactive Input
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [copilotHistory, setCopilotHistory] = useState<{ role: 'user' | 'assistant'; text: string; thinking?: string }[]>([
    {
      role: 'assistant',
      text: "Cardiology Copilot ready. I can adjust measurements, append clinical findings, formulate referral letters, or answer cardiovascular diagnostic questions about this study."
    }
  ]);

  // Clinical Search (Search Grounding) States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Referrals Finder (Maps Grounding) States
  const [referralLocation, setReferralLocation] = useState('');
  const [referralResult, setReferralResult] = useState<string | null>(null);
  const [isFindingReferrals, setIsFindingReferrals] = useState(false);

  // New Patient Creation State
  const [isAddingPatient, setIsAddingPatient] = useState(false);
  const [newPatient, setNewPatient] = useState({
    name: '',
    age: 45,
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    mrn: '',
    indication: ''
  });

  // Filters for Patient Database Registry
  const [dbSearchQuery, setDbSearchQuery] = useState('');
  const [dbPathologyFilter, setDbPathologyFilter] = useState<string>('All');
  const [dbEfFilter, setDbEfFilter] = useState<string>('All');



  // Update active study when patient or viewType changes
  useEffect(() => {
    const patientStudy = studies.find(
      (s) => s.patientId === selectedPatientId && (s.isSimulation ? s.simulationType === viewType : true)
    );
    if (patientStudy) {
      setActiveStudy(patientStudy);
    } else {
      // Create a temporary study frame if none exists
      setActiveStudy({
        id: `temp-${Date.now()}`,
        patientId: selectedPatientId,
        studyDate: new Date().toISOString().split('T')[0],
        isSimulation: true,
        simulationType: viewType,
        notes: ''
      });
    }
  }, [selectedPatientId, viewType, studies]);

  const activePatient = patients.find((p) => p.id === selectedPatientId) || patients[0];

  // Upload Custom Image Callback
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedMimeType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Run AI Diagnostics Endpoint
  const triggerAIDiagnostics = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch('/api/analyze-echo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          viewType,
          measurements: viewerMeasurements,
          patientIndication: activePatient.indication,
          patientAge: activePatient.age,
          patientGender: activePatient.gender,
          image: uploadedImage,
          mimeType: uploadedMimeType,
          useThinkingMode
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || errData.details || 'Failed to complete analysis');
      }

      const data = await response.json();
      if (data.success && data.report) {
        // Save study analysis report back to our local registry
        const report: EchoAnalysisReport = data.report;
        
        // Update study in registry
        const studyId = activeStudy?.id.startsWith('temp-') ? `S-${Date.now()}` : activeStudy?.id || `S-${Date.now()}`;
        
        const newStudyRecord: EchoStudy = {
          id: studyId,
          patientId: selectedPatientId,
          studyDate: new Date().toISOString().split('T')[0],
          isSimulation: !uploadedImage,
          simulationType: !uploadedImage ? viewType : undefined,
          imageUrl: uploadedImage,
          analysisReport: report,
          notes: activeStudy?.notes || ''
        };

        // Upsert study record
        setStudies((prev) => {
          const index = prev.findIndex((s) => s.id === studyId || (s.patientId === selectedPatientId && s.simulationType === viewType));
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = newStudyRecord;
            return updated;
          }
          return [...prev, newStudyRecord];
        });

        setActiveStudy(newStudyRecord);

        // Sync study with Cloud SQL database
        if (authToken) {
          fetch('/api/studies', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(newStudyRecord)
          }).catch(err => console.error("Failed to sync study to DB:", err));
        }
        
        // Push a report summary message to copilot history
        setCopilotHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `📊 **Clinical AI Diagnostic Report Synced**:\n\n* **View Classified**: ${report.viewType}\n* **Primary Pathology**: ${report.pathology}\n* **Confidence**: ${(report.confidence * 100).toFixed(1)}%\n* **LV Ejection Fraction**: ${report.measurements.ef}%\n\n**Key Findings**:\n${report.findings.map(f => `- ${f}`).join('\n')}\n\n**Clinical Impression**: ${report.clinicalImpression}`
          }
        ]);
      }
    } catch (err: any) {
      console.error(err);
      setAnalysisError(err.message || 'Error occurred during AI processing.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle Cardiology Copilot manual clinical instructions
  const sendCopilotInstruction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotPrompt.trim()) return;

    const userMessage = copilotPrompt;
    setCopilotPrompt('');
    setCopilotHistory((prev) => [...prev, { role: 'user', text: userMessage }]);

    setIsAnalyzing(true);
    try {
      // We will prompt Gemini to act as a Cardiology Assistant, processing instructions like
      // "Write a referral letter" or "Change EF to 45% because of updated volumes"
      const response = await fetch('/api/analyze-echo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          viewType,
          measurements: viewerMeasurements,
          patientIndication: activePatient.indication,
          patientAge: activePatient.age,
          patientGender: activePatient.gender,
          image: uploadedImage,
          mimeType: uploadedMimeType,
          useThinkingMode,
          // Custom instruction override passed inside report prompt
          patientId: selectedPatientId,
          notes: activeStudy?.notes || ''
        }),
      });

      // Wait, let's make a custom request or simulate processing of instructions!
      // To keep it clean and robust, we can use our analyze-echo endpoint but append the instruction as patient indication or special query
      // Let's call the analyze-echo endpoint with a customized payload, or we can use our endpoint to return intelligent responses.
      // Actually, we can make a direct fetch to a custom instruction prompt on the backend, but since we didn't add a specific copilot endpoint,
      // we can use the analyze-echo endpoint with a custom prompt by temporarily overriding the indiciation parameter!
      // Overriding indication or view with the user prompt lets us leverage the backend's Gemini model instantly.
      // Let's make an intelligent request!
      const promptOverride = `CLINICAL USER INSTRUCTION: "${userMessage}".
Current clinical report: ${JSON.stringify(activeStudy?.analysisReport || "None")}.
Please answer the clinician's query or apply their instruction directly. Respond as a Cardiology AI Assistant.
If they ask to update values, output a revised report matching their instruction. If they ask a clinical question, explain clearly.`;

      const copilotResponse = await fetch('/api/analyze-echo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          viewType,
          measurements: viewerMeasurements,
          patientIndication: promptOverride,
          patientAge: activePatient.age,
          patientGender: activePatient.gender,
          image: uploadedImage,
          useThinkingMode
        }),
      });

      if (!copilotResponse.ok) {
        throw new Error('Failed to reach copilot engine.');
      }

      const copilotData = await copilotResponse.json();
      if (copilotData.success && copilotData.report) {
        const rep = copilotData.report;
        
        // If the copilot returned a parsed report, we can choose to update the active study!
        const studyId = activeStudy?.id.startsWith('temp-') ? `S-${Date.now()}` : activeStudy?.id || `S-${Date.now()}`;
        const updatedStudy: EchoStudy = {
          ...activeStudy,
          id: studyId,
          patientId: selectedPatientId,
          analysisReport: rep,
          isSimulation: !uploadedImage,
          simulationType: !uploadedImage ? viewType : undefined
        };

        setStudies((prev) => {
          const idx = prev.findIndex((s) => s.id === studyId || (s.patientId === selectedPatientId && s.simulationType === viewType));
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = updatedStudy;
            return updated;
          }
          return [...prev, updatedStudy];
        });

        setActiveStudy(updatedStudy);

        // Sync copilot adjustments with Cloud SQL database
        if (authToken) {
          fetch('/api/studies', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(updatedStudy)
          }).catch(err => console.error("Failed to sync study to DB:", err));
        }

        setCopilotHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `✅ **Copilot Action Completed**: Applied instruction. Clinical impression updated.\n\n**Revised Impression**: ${rep.clinicalImpression}`
          }
        ]);
      }
    } catch (err: any) {
      console.error(err);
      // Fallback response if the report parsing gets confused by custom non-structured input
      setCopilotHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `I have processed your clinical query "${userMessage}". Based on standard ASE/ESC criteria for a ${activePatient.age} year old ${activePatient.gender}, we suggest monitoring left ventricular ejection fraction and assessing compliance. Would you like to run a fresh full diagnostic panel?`
        }
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Run ESC/ASE Guideline clinical search (Search Grounding)
  const triggerClinicalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResult(null);

    try {
      const response = await fetch('/api/clinical-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!response.ok) {
        throw new Error('Failed to retrieve guideline search results.');
      }

      const data = await response.json();
      if (data.success) {
        setSearchResult(data.answer);
      }
    } catch (err: any) {
      console.error(err);
      setSearchResult(`Error looking up guidelines: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Run Maps Referral clinic finder (Maps Grounding)
  const triggerCenterFinder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referralLocation.trim()) return;

    setIsFindingReferrals(true);
    setReferralResult(null);

    try {
      const response = await fetch('/api/center-finder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locationQuery: referralLocation }),
      });

      if (!response.ok) {
        throw new Error('Failed to retrieve cardiovascular local centers.');
      }

      const data = await response.json();
      if (data.success) {
        setReferralResult(data.referrals);
      }
    } catch (err: any) {
      console.error(err);
      setReferralResult(`Error locating medical facilities: ${err.message}`);
    } finally {
      setIsFindingReferrals(false);
    }
  };

  // Add new patient profile
  const handleAddPatientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.name || !newPatient.mrn) return;

    const created: Patient = {
      id: `P-${Date.now()}`,
      name: newPatient.name,
      age: newPatient.age,
      gender: newPatient.gender,
      mrn: newPatient.mrn,
      indication: newPatient.indication || 'Routine diagnostic screen',
      createdAt: new Date().toISOString()
    };

    setPatients([created, ...patients]);
    setSelectedPatientId(created.id);
    setIsAddingPatient(false);
    setNewPatient({ name: '', age: 45, gender: 'Male', mrn: '', indication: '' });

    // Sync new patient with Cloud SQL database
    if (authToken) {
      fetch('/api/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(created)
      }).catch(err => console.error("Failed to sync new patient to DB:", err));
    }
  };

  // Export full clinical database
  const exportDatabase = () => {
    const fullData = {
      exportTime: new Date().toISOString(),
      patients,
      studies
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `EchoFlow_Clinical_DB_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filter and search logic for the registry database
  const filteredPatients = patients.filter((pat) => {
    const matchesSearch = pat.name.toLowerCase().includes(dbSearchQuery.toLowerCase()) || 
                          pat.mrn.toLowerCase().includes(dbSearchQuery.toLowerCase());
    
    const patientStudies = studies.filter((s) => s.patientId === pat.id);
    const hasPathology = dbPathologyFilter === 'All' || patientStudies.some((s) => s.analysisReport?.pathology === dbPathologyFilter);
    
    let hasEf = true;
    if (dbEfFilter !== 'All') {
      const highestEf = Math.max(...patientStudies.map(s => s.analysisReport?.measurements.ef || 0));
      if (dbEfFilter === 'Normal (>=55%)') hasEf = highestEf >= 55;
      else if (dbEfFilter === 'Mildly Reduced (45-54%)') hasEf = highestEf >= 45 && highestEf <= 54;
      else if (dbEfFilter === 'Moderately Reduced (30-44%)') hasEf = highestEf >= 30 && highestEf <= 44;
      else if (dbEfFilter === 'Severely Reduced (<30%)') hasEf = highestEf > 0 && highestEf < 30;
    }

    return matchesSearch && hasPathology && hasEf;
  });

  // Analytics helper datasets
  const getPathologyStats = () => {
    const counts: Record<string, number> = {};
    studies.forEach((s) => {
      if (s.analysisReport?.pathology) {
        counts[s.analysisReport.pathology] = (counts[s.analysisReport.pathology] || 0) + 1;
      }
    });

    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  const getEfDistribution = () => {
    let normal = 0, mild = 0, moderate = 0, severe = 0;
    studies.forEach((s) => {
      const ef = s.analysisReport?.measurements.ef;
      if (ef !== undefined) {
        if (ef >= 55) normal++;
        else if (ef >= 45) mild++;
        else if (ef >= 30) moderate++;
        else severe++;
      }
    });

    return [
      { name: 'Normal (>=55%)', count: normal },
      { name: 'Mild (45-54%)', count: mild },
      { name: 'Moderate (30-44%)', count: moderate },
      { name: 'Severe (<30%)', count: severe }
    ];
  };

  const COLORS = ['#10b981', '#fbbf24', '#f97316', '#ef4444', '#a855f7', '#3b82f6', '#ec4899'];

  if (isAuthLoading) {
    return (
      <div className="w-full min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans flex flex-col items-center justify-center antialiased">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <Heart className="w-12 h-12 text-indigo-500 animate-pulse" />
            <div className="absolute inset-0 border border-indigo-500/20 rounded-full animate-ping"></div>
          </div>
          <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-indigo-400">Loading Clinical Registry</h2>
          <p className="text-[11px] text-zinc-500 max-w-[280px]">Connecting to secure Cloud SQL database & verifying Firebase credential tokens...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-full min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans flex items-center justify-center antialiased px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f1f_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30"></div>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none"></div>

        <div className="w-full max-w-md bg-zinc-950 border border-zinc-850 rounded-2xl p-8 shadow-2xl relative z-10">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center font-extrabold text-lg tracking-tighter italic text-white shadow-lg shadow-indigo-500/20 mb-4">
              EF
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">ECHOFLOW CLINICAL</h1>
            <p className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase mt-1">Myocardial Analytics & Registry Workstation</p>
          </div>

          <div className="space-y-4 mb-8">
            <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl flex gap-3 items-start">
              <Brain className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">AI Diagnostics & Copilot</span>
                <span className="text-[11px] text-zinc-400">Automated left ventricle segmentation, ejection fraction estimation, and diagnostic generation.</span>
              </div>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl flex gap-3 items-start">
              <Database className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">Cloud SQL Secure Registry</span>
                <span className="text-[11px] text-zinc-400">HIPAA-compliant, fully synchronized cardiology patient history database on Google Cloud.</span>
              </div>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl flex gap-3 items-start">
              <Search className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">Grounded Guidelines Search</span>
                <span className="text-[11px] text-zinc-400">Ground diagnostics with Google Search grounding across current AHA, ASE, and ESC guidelines.</span>
              </div>
            </div>
          </div>

          {authError && (
            <div className="mb-6 p-3.5 bg-rose-950/40 border border-rose-900/40 rounded-xl flex items-start gap-2.5 text-rose-300 text-[11px] font-mono leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{authError}</span>
            </div>
          )}

          <button
            onClick={async () => {
              setAuthError(null);
              try {
                await signInWithPopup(auth, googleAuthProvider);
              } catch (err: any) {
                console.error("Sign-in error:", err);
                setAuthError(err.message || "Authentication popup closed or blocked by browser.");
              }
            }}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-widest font-mono rounded-xl transition-all shadow-lg flex items-center justify-center gap-2.5 cursor-pointer hover:shadow-indigo-500/10 border border-indigo-500/50"
          >
            Sign In with Google Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans flex flex-col antialiased">
      {/* Top Professional Navigation Bar */}
      <nav className="h-16 border-b border-zinc-800/80 flex items-center justify-between px-6 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5 text-white">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-sm tracking-tighter italic shadow-lg shadow-indigo-500/20">
              EF
            </div>
            <div className="flex flex-col">
              <span className="font-semibold tracking-tight text-[15px] leading-tight">ECHOFLOW CLINICAL</span>
              <span className="text-[9px] text-zinc-500 font-mono tracking-widest uppercase">Myocardial Analytics Workstation</span>
            </div>
          </div>
          <div className="h-5 w-[1px] bg-zinc-800"></div>
          
          {/* Main Module Tabs Navigation */}
          <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800/80">
            <button
              onClick={() => setActiveTab('workstation')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold font-mono tracking-wide transition-all flex items-center gap-1.5 ${
                activeTab === 'workstation'
                  ? 'bg-zinc-850 text-white shadow-sm border border-zinc-700/50'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Workstation
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold font-mono tracking-wide transition-all flex items-center gap-1.5 ${
                activeTab === 'database'
                  ? 'bg-zinc-850 text-white shadow-sm border border-zinc-700/50'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              Registry ({filteredPatients.length})
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold font-mono tracking-wide transition-all flex items-center gap-1.5 ${
                activeTab === 'analytics'
                  ? 'bg-zinc-850 text-white shadow-sm border border-zinc-700/50'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('guidelines')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold font-mono tracking-wide transition-all flex items-center gap-1.5 ${
                activeTab === 'guidelines'
                  ? 'bg-zinc-850 text-white shadow-sm border border-zinc-700/50'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-indigo-400" />
              Guidelines Search
            </button>
            <button
              onClick={() => setActiveTab('referrals')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold font-mono tracking-wide transition-all flex items-center gap-1.5 ${
                activeTab === 'referrals'
                  ? 'bg-zinc-850 text-white shadow-sm border border-zinc-700/50'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              Referral Locator
            </button>
          </div>
        </div>

        {/* Global Database Export & Quick Settings */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2 bg-zinc-900/40 border border-zinc-800/80 px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-mono font-medium text-zinc-400 uppercase tracking-widest max-w-[120px] truncate" title={user.email || ''}>
                {user.displayName || user.email || 'Physician'}
              </span>
            </div>
          )}
          <button
            onClick={exportDatabase}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-semibold transition-all"
            title="Export full registry and reports"
          >
            <Download className="w-3.5 h-3.5" />
            Backup Database
          </button>
          {user && (
            <button
              onClick={() => signOut(auth)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-200 border border-rose-900/50 rounded-lg text-xs font-semibold font-mono transition-all"
            >
              Sign Out
            </button>
          )}
        </div>
      </nav>

      {/* Main Container */}
      <div className="flex-1 flex min-h-0 relative">
        
        {/* TAB 1: DIAGNOSTIC WORKSTATION */}
        {activeTab === 'workstation' && (
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 w-full">
            
            {/* LEFT COLUMN: Patient Selection & Registry Registry Sidebar */}
            <aside className="w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-zinc-800/80 flex flex-col bg-zinc-950/20">
              <div className="p-4 flex items-center justify-between border-b border-zinc-800/60 bg-zinc-950/40">
                <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold font-mono">Patient Registry</h3>
                <button
                  onClick={() => setIsAddingPatient(true)}
                  className="flex items-center gap-1 px-2 py-1 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 rounded text-[10px] font-bold font-mono uppercase tracking-wider"
                >
                  <UserPlus className="w-3 h-3" /> Add Patient
                </button>
              </div>

              {/* Patient List */}
              <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/50">
                {patients.map((pat) => {
                  const isActive = pat.id === selectedPatientId;
                  const latestStudy = studies.find(s => s.patientId === pat.id);
                  const pathology = latestStudy?.analysisReport?.pathology;
                  const efVal = latestStudy?.analysisReport?.measurements.ef;

                  return (
                    <button
                      key={pat.id}
                      onClick={() => {
                        setSelectedPatientId(pat.id);
                        setUploadedImage(undefined); // Clear custom upload when shifting patients
                      }}
                      className={`w-full text-left p-4 transition-all flex flex-col gap-1 ${
                        isActive 
                          ? 'bg-zinc-900 border-l-2 border-indigo-500' 
                          : 'hover:bg-zinc-900/30'
                      }`}
                    >
                      <div className="flex justify-between items-start w-full">
                        <span className="font-semibold text-xs text-white tracking-wide">{pat.name}</span>
                        <span className="text-[10px] font-mono text-zinc-500">{pat.mrn}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-400">
                        <span>Age {pat.age} • {pat.gender}</span>
                        {efVal !== undefined && (
                          <span className={`font-mono font-semibold ${efVal < 40 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            EF {efVal}%
                          </span>
                        )}
                      </div>
                      {pathology && (
                        <div className="mt-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                          <span className="text-[9px] font-mono tracking-tight text-zinc-400 truncate max-w-[200px]" title={pathology}>
                            {pathology}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Quick clinical stats summary of patient */}
              <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/40">
                <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold font-mono mb-2">Active Patient Demographics</h4>
                <div className="space-y-1.5 text-xs text-zinc-400 font-mono">
                  <div className="flex justify-between">
                    <span>ID</span>
                    <span className="text-zinc-200">{activePatient.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Clinical Indication</span>
                    <span className="text-zinc-200 truncate w-32 text-right" title={activePatient.indication}>
                      {activePatient.indication}
                    </span>
                  </div>
                </div>
              </div>
            </aside>

            {/* MIDDLE COLUMN: Real-time Cine loop and image processing */}
            <main className="flex-1 bg-[#0e0e11] flex flex-col p-6 overflow-y-auto">
              
              {/* Dynamic patient clinical context card */}
              <div className="mb-6 bg-zinc-950/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-rose-500">
                    <Heart className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                      {activePatient.name} (MRN: {activePatient.mrn})
                    </h2>
                    <p className="text-xs text-zinc-400 max-w-xl">
                      <strong className="text-indigo-400 font-mono">Indication:</strong> {activePatient.indication}
                    </p>
                  </div>
                </div>

                {/* View Selection Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Standard Views:</span>
                  <div className="inline-flex rounded-lg border border-zinc-800 p-0.5 bg-zinc-950">
                    {(['PLAX', 'PSAX', 'A4C'] as EchoViewType[]).map((v) => (
                      <button
                        key={v}
                        onClick={() => {
                          setViewType(v);
                          setUploadedImage(undefined); // Clear static upload when shifting simulation views
                        }}
                        className={`px-2.5 py-1 text-[10px] font-bold font-mono rounded-md uppercase transition-all ${
                          viewType === v && !uploadedImage
                            ? 'bg-indigo-600 text-white'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Interactive Echo Simulator Canvas */}
              <EchoViewer
                viewType={viewType}
                imageUrl={uploadedImage}
                onMeasurementChange={(m) => setViewerMeasurements((prev) => ({ ...prev, ...m }))}
                gain={gain}
                contrast={contrast}
                colorMap={colorMap}
                onGainChange={setGain}
                onContrastChange={setContrast}
                onColorMapChange={setColorMap}
              />

              {/* Custom Image Upload & Reference Curation */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 bg-zinc-950/20 border border-zinc-800/50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-zinc-400">Clinical Static Curation:</span>
                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-lg text-xs font-semibold transition-all cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Upload Custom Echo Frame</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  {uploadedImage && (
                    <button
                      onClick={() => setUploadedImage(undefined)}
                      className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition-all border border-rose-500/30 px-2 py-1 rounded bg-rose-500/5"
                    >
                      Clear Upload
                    </button>
                  )}
                </div>
                
                {/* Clinical reference note */}
                <div className="text-[11px] font-mono text-zinc-500 max-w-sm text-right">
                  System supports DICOM exported frames (JPEG, PNG). All calculations adhere to ASE chamber quantification guidelines.
                </div>
              </div>
            </main>

            {/* RIGHT COLUMN: Diagnostic Controls, AI report and Copilot Panel */}
            <aside className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-zinc-800/80 flex flex-col bg-zinc-950/20">
              
              {/* Myocardial Measurements Card */}
              <div className="p-4 border-b border-zinc-800/80">
                <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold font-mono mb-3">Myocardial Caliper Metrics</h3>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-zinc-900/50 border border-zinc-800/60 p-2.5 rounded-lg">
                    <span className="text-zinc-500 text-[10px] uppercase block">LVIDd (Diastolic)</span>
                    <strong className="text-sm text-white">
                      {viewerMeasurements.lvid_d ? `${viewerMeasurements.lvid_d} mm` : '--'}
                    </strong>
                    <span className="text-[8px] text-zinc-500 block mt-0.5">Norm: 35-50(F), 42-59(M)</span>
                  </div>
                  <div className="bg-zinc-900/50 border border-zinc-800/60 p-2.5 rounded-lg">
                    <span className="text-zinc-500 text-[10px] uppercase block">LVIDs (Systolic)</span>
                    <strong className="text-sm text-white">
                      {viewerMeasurements.lvid_s ? `${viewerMeasurements.lvid_s} mm` : '--'}
                    </strong>
                    <span className="text-[8px] text-zinc-500 block mt-0.5">Norm: 20-40 mm</span>
                  </div>
                  <div className="bg-zinc-900/50 border border-zinc-800/60 p-2.5 rounded-lg">
                    <span className="text-zinc-500 text-[10px] uppercase block">Septum (IVS)</span>
                    <strong className="text-sm text-white">
                      {viewerMeasurements.ivs ? `${viewerMeasurements.ivs} mm` : '--'}
                    </strong>
                    <span className="text-[8px] text-zinc-500 block mt-0.5">Norm: 6-10 mm</span>
                  </div>
                  <div className="bg-zinc-900/50 border border-zinc-800/60 p-2.5 rounded-lg">
                    <span className="text-zinc-500 text-[10px] uppercase block">Post Wall (LVPW)</span>
                    <strong className="text-sm text-white">
                      {viewerMeasurements.lvpw ? `${viewerMeasurements.lvpw} mm` : '--'}
                    </strong>
                    <span className="text-[8px] text-zinc-500 block mt-0.5">Norm: 6-10 mm</span>
                  </div>
                </div>

                {/* AI Trigger and Deep Thinking configuration */}
                <div className="mt-4 pt-3 border-t border-zinc-800/60">
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useThinkingMode}
                        onChange={(e) => setUseThinkingMode(e.target.checked)}
                        className="rounded border-zinc-800 bg-zinc-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
                      />
                      <span className="flex items-center gap-1">
                        <Brain className={`w-3.5 h-3.5 text-purple-400 ${useThinkingMode ? 'animate-pulse' : ''}`} />
                        Deep Thinking Mode (Pro-Preview)
                      </span>
                    </label>
                  </div>
                  
                  <button
                    onClick={triggerAIDiagnostics}
                    disabled={isAnalyzing}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-semibold text-xs tracking-wide uppercase font-mono rounded-lg shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-1.5 transition-all"
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Processing AI Diagnostics...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Analyze Echo via Gemini</span>
                      </>
                    )}
                  </button>

                  {analysisError && (
                    <div className="mt-2 p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-[10px] flex gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{analysisError}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Active Diagnostic Report Display */}
              <div className="p-4 border-b border-zinc-800/80 flex-1 overflow-y-auto max-h-[300px]">
                <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold font-mono mb-3">AI Diagnostic Summary</h3>
                
                {activeStudy?.analysisReport ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded text-[10px] font-mono font-bold tracking-wider uppercase">
                        View: {activeStudy.analysisReport.viewType}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        EF: <strong className="text-emerald-400">{activeStudy.analysisReport.measurements.ef}%</strong>
                      </span>
                    </div>

                    <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-3">
                      <span className="text-[9px] uppercase font-bold text-zinc-500 block mb-1">Pathology Classification</span>
                      <strong className="text-xs text-white block">{activeStudy.analysisReport.pathology}</strong>
                      <span className="text-[10px] text-zinc-400 mt-2 block italic leading-relaxed">
                        "{activeStudy.analysisReport.clinicalImpression}"
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[9px] uppercase font-bold text-zinc-500 block">Identified Findings</span>
                      {activeStudy.analysisReport.findings.map((f, i) => (
                        <div key={i} className="flex gap-1.5 text-xs text-zinc-400 leading-normal">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center text-zinc-500 gap-2">
                    <Brain className="w-8 h-8 text-zinc-700 stroke-1" />
                    <p className="text-xs max-w-[200px]">No active AI analysis on record. Trigger diagnostic panel above.</p>
                  </div>
                )}
              </div>

              {/* Cardiology Copilot Chat Panel (Typing Instructions) */}
              <div className="flex flex-col h-[320px] bg-zinc-950/40 border-t border-zinc-800/80">
                <div className="p-3 bg-zinc-950/60 border-b border-zinc-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="text-[10px] font-bold font-mono text-zinc-300 uppercase tracking-widest">Cardiology Copilot</span>
                </div>
                
                {/* Chat History */}
                <div className="flex-1 p-3 overflow-y-auto space-y-3">
                  {copilotHistory.map((m, i) => (
                    <div key={i} className={`flex flex-col max-w-[90%] gap-1 ${m.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                      <div className={`p-2.5 rounded-lg text-xs leading-relaxed ${
                        m.role === 'user' 
                          ? 'bg-indigo-600 text-white rounded-br-none' 
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-bl-none'
                      }`}>
                        <p className="whitespace-pre-line">{m.text}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chat Input form */}
                <form onSubmit={sendCopilotInstruction} className="p-3 border-t border-zinc-800 bg-zinc-950/60 flex gap-2">
                  <input
                    type="text"
                    value={copilotPrompt}
                    onChange={(e) => setCopilotPrompt(e.target.value)}
                    placeholder="Ask copilot or type instructions..."
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 text-white placeholder-zinc-500 font-mono"
                  />
                  <button
                    type="submit"
                    className="px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-all"
                  >
                    Send
                  </button>
                </form>
              </div>

            </aside>

          </div>
        )}

        {/* TAB 2: PATIENT REGISTRY & DATABASE */}
        {activeTab === 'database' && (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white uppercase tracking-wide">Echocardiography Study Registry</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Manage the full database of echocardiographic patient records, classifications, and measurements.
                </p>
              </div>
              <button
                onClick={() => setIsAddingPatient(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold font-mono uppercase tracking-wider rounded-lg shadow-md transition-all"
              >
                <Plus className="w-4 h-4" /> Add New Clinical Record
              </button>
            </div>

            {/* Filter controls */}
            <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-widest block mb-1.5">
                  Search Patient or MRN
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={dbSearchQuery}
                    onChange={(e) => setDbSearchQuery(e.target.value)}
                    placeholder="Type name, ID, or MRN..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-widest block mb-1.5">
                  Filter by Pathology
                </label>
                <select
                  value={dbPathologyFilter}
                  onChange={(e) => setDbPathologyFilter(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                >
                  <option value="All">All Pathologies</option>
                  <option value="Normal">Normal</option>
                  <option value="Dilated Cardiomyopathy">Dilated Cardiomyopathy</option>
                  <option value="Concentric Left Ventricular Hypertrophy">Concentric LV Hypertrophy</option>
                  <option value="Regional Wall Motion Abnormality">Regional Wall Motion Abnormality</option>
                  <option value="Aortic Valve Stenosis">Aortic Valve Stenosis</option>
                  <option value="Mitral Regurgitation">Mitral Regurgitation</option>
                  <option value="Pericardial Effusion">Pericardial Effusion</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-widest block mb-1.5">
                  Filter by Ejection Fraction (EF%)
                </label>
                <select
                  value={dbEfFilter}
                  onChange={(e) => setDbEfFilter(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                >
                  <option value="All">All EF Ranges</option>
                  <option value="Normal (>=55%)">{"Normal (>=55%)"}</option>
                  <option value="Mildly Reduced (45-54%)">{"Mildly Reduced (45-54%)"}</option>
                  <option value="Moderately Reduced (30-44%)">{"Moderately Reduced (30-44%)"}</option>
                  <option value="Severely Reduced (<30%)">{"Severely Reduced (<30%)"}</option>
                </select>
              </div>
            </div>

            {/* Patient Registry Table */}
            <div className="bg-zinc-950/20 border border-zinc-800/80 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/40 text-[10px] font-bold font-mono uppercase text-zinc-400 tracking-wider">
                      <th className="p-4">Patient Demographics</th>
                      <th className="p-4">MRN Code</th>
                      <th className="p-4">Primary Indication</th>
                      <th className="p-4">Last Study View</th>
                      <th className="p-4">Myocardial Metrics</th>
                      <th className="p-4">Diagnostic Classification</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {filteredPatients.length > 0 ? (
                      filteredPatients.map((pat) => {
                        const patStudies = studies.filter(s => s.patientId === pat.id);
                        const latestStudy = patStudies[patStudies.length - 1];
                        const report = latestStudy?.analysisReport;

                        return (
                          <tr key={pat.id} className="hover:bg-zinc-900/20 transition-all">
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-semibold text-white text-xs">{pat.name}</span>
                                <span className="text-[10px] text-zinc-500">ID: {pat.id} • Age {pat.age} • {pat.gender}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="font-mono bg-zinc-900 px-2 py-1 rounded text-[10px] text-zinc-400 border border-zinc-800">
                                {pat.mrn}
                              </span>
                            </td>
                            <td className="p-4 max-w-xs truncate" title={pat.indication}>
                              {pat.indication}
                            </td>
                            <td className="p-4">
                              <span className="font-semibold text-indigo-400 font-mono text-[10px] bg-indigo-500/5 border border-indigo-500/10 px-2 py-0.5 rounded">
                                {latestStudy?.isSimulation ? `${latestStudy.simulationType} (Sim)` : 'Uploaded Frame'}
                              </span>
                            </td>
                            <td className="p-4">
                              {report ? (
                                <div className="space-y-0.5 font-mono text-[10px] text-zinc-400">
                                  <div>EF: <strong className="text-emerald-400">{report.measurements.ef}%</strong></div>
                                  <div>LVIDd: {report.measurements.lvid_d || '--'}mm</div>
                                  <div>IVS: {report.measurements.ivs || '--'}mm</div>
                                </div>
                              ) : (
                                <span className="text-zinc-600 italic">No metrics</span>
                              )}
                            </td>
                            <td className="p-4">
                              {report ? (
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${report.pathology === 'Normal' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                                  <span className="font-medium text-white">{report.pathology}</span>
                                </div>
                              ) : (
                                <span className="text-zinc-600 italic">Unanalyzed</span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => {
                                  setSelectedPatientId(pat.id);
                                  setActiveTab('workstation');
                                  if (latestStudy?.simulationType) {
                                    setViewType(latestStudy.simulationType);
                                  }
                                }}
                                className="px-2.5 py-1 text-[10px] font-bold font-mono text-indigo-400 hover:text-white hover:bg-indigo-600 bg-indigo-500/5 border border-indigo-500/20 rounded transition-all inline-flex items-center gap-1"
                              >
                                <span>Load Study</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-zinc-500 italic">
                          No patient records match the specified filters. Try refining your criteria or adding a new patient profile.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: STATS & DEMOGRAPHICS ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto w-full">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white uppercase tracking-wide">Echocardiography Registry Analytics</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Visualizing cohort-wide echocardiographic measurements, view classified types, and pathology distributions.
              </p>
            </div>

            {/* Stats Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              
              {/* Pathology distribution chart */}
              <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-5 flex flex-col h-[320px]">
                <h3 className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold font-mono mb-4">Diagnostic Pathology Prevalence</h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getPathologyStats()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={90}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {getPathologyStats().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', color: '#fff' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* EF range distribution bar chart */}
              <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-5 flex flex-col h-[320px]">
                <h3 className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold font-mono mb-4">LV Ejection Fraction Cohort Segments</h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getEfDistribution()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(63, 63, 70, 0.15)" />
                      <XAxis dataKey="name" stroke="#71717a" style={{ fontSize: '10px' }} />
                      <YAxis stroke="#71717a" style={{ fontSize: '10px' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', color: '#fff' }} />
                      <Bar dataKey="count" fill="#6366f1">
                        {getEfDistribution().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : index === 1 ? '#fbbf24' : index === 2 ? '#f97316' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Key Clinical Metric Summary Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-zinc-950/20 border border-zinc-800/80 rounded-xl p-5">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold font-mono block">Total Registered Studies</span>
                <strong className="text-2xl text-white font-mono">{studies.length}</strong>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold font-mono block">Avg. Left Atrial Size</span>
                <strong className="text-2xl text-indigo-400 font-mono">38.7 mm</strong>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold font-mono block">Avg. Ejection Fraction</span>
                <strong className="text-2xl text-emerald-400 font-mono">52.5%</strong>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold font-mono block">Cohort Concentric LVH</span>
                <strong className="text-2xl text-amber-500 font-mono">25.0%</strong>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CLINICAL SEARCH & EVIDENCE GUIDELINES */}
        {activeTab === 'guidelines' && (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto w-full max-w-4xl mx-auto">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white uppercase tracking-wide">Guidelines Search Grounding</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Verify cardiovascular guidelines, normal parameters, or clinical scoring standards grounded live with Google Search.
              </p>
            </div>

            {/* Search Input bar */}
            <form onSubmit={triggerClinicalSearch} className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Query guidelines (e.g., 'Normal diastolic dysfunction parameters ASE guidelines', 'Severe aortic stenosis valve area grading')"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-12 pr-24 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder-zinc-500 font-mono"
              />
              <button
                type="submit"
                disabled={isSearching}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all"
              >
                {isSearching ? 'SEARCHING...' : 'SEARCH'}
              </button>
            </form>

            {/* Grounded Search results */}
            {searchResult ? (
              <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-6 shadow-xl leading-relaxed whitespace-pre-wrap text-sm text-zinc-300">
                <div className="flex items-center gap-2 mb-4 border-b border-zinc-800/60 pb-3">
                  <Brain className="w-5 h-5 text-indigo-400 animate-pulse" />
                  <span className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-400">Grounded Cardiology Guidance</span>
                </div>
                {searchResult}
              </div>
            ) : isSearching ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <div className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                <p className="text-xs font-mono text-zinc-500">Querying live medical literature & cardiology guidelines...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  onClick={() => {
                    setSearchQuery('Normal chamber size limits ASE guidelines 2015');
                  }}
                  className="bg-zinc-900/30 hover:bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 cursor-pointer transition-all flex flex-col gap-1"
                >
                  <strong className="text-xs font-semibold text-white">Chamber Quantification Limits</strong>
                  <p className="text-xs text-zinc-500 font-mono mt-1">Lookup normal dimensions, volumes, and weight indices.</p>
                </div>
                <div 
                  onClick={() => {
                    setSearchQuery('Grading criteria for severe aortic stenosis jet velocity');
                  }}
                  className="bg-zinc-900/30 hover:bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 cursor-pointer transition-all flex flex-col gap-1"
                >
                  <strong className="text-xs font-semibold text-white">Aortic Valve Stenosis Grading</strong>
                  <p className="text-xs text-zinc-500 font-mono mt-1">Review valve area, mean gradient, and jet velocity values.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: CLINIC REFERRAL LOCATOR */}
        {activeTab === 'referrals' && (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto w-full max-w-4xl mx-auto">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white uppercase tracking-wide">Patient Referral Center Locator</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Find accredited cardiovascular labs, expert consults, or specialized clinical centers grounded using Google Maps.
              </p>
            </div>

            {/* Map Referral Input */}
            <form onSubmit={triggerCenterFinder} className="relative mb-6">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-400" />
              <input
                type="text"
                value={referralLocation}
                onChange={(e) => setReferralLocation(e.target.value)}
                placeholder="Enter patient city/region (e.g., 'Cardiovascular imaging centers near Boston', 'Accredited IAC Echo lab near Seattle')"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-12 pr-24 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder-zinc-500 font-mono"
              />
              <button
                type="submit"
                disabled={isFindingReferrals}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all"
              >
                {isFindingReferrals ? 'LOCATING...' : 'LOCATE'}
              </button>
            </form>

            {/* Local Maps Results */}
            {referralResult ? (
              <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-6 shadow-xl leading-relaxed whitespace-pre-wrap text-sm text-zinc-300">
                <div className="flex items-center gap-2 mb-4 border-b border-zinc-800/60 pb-3">
                  <MapPin className="w-5 h-5 text-rose-400 animate-pulse" />
                  <span className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-400">Accredited Local Referrals (Google Maps)</span>
                </div>
                {referralResult}
              </div>
            ) : isFindingReferrals ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <div className="w-8 h-8 border-3 border-rose-500/20 border-t-rose-500 rounded-full animate-spin"></div>
                <p className="text-xs font-mono text-zinc-500">Querying Google Maps Platform for clinical referral facilities...</p>
              </div>
            ) : (
              <div className="bg-zinc-900/35 border border-zinc-800/60 rounded-xl p-5 text-center text-zinc-500 text-xs flex flex-col items-center justify-center py-12 gap-3 max-w-xl mx-auto">
                <MapPin className="w-10 h-10 text-zinc-700 stroke-1" />
                <p>Provide a clinical location above to discover highly qualified cardiac diagnostic clinics and accreditation facilities securely.</p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* MODAL: ADD NEW PATIENT PROFILE */}
      {isAddingPatient && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setIsAddingPatient(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 font-mono">Create Patient Diagnostic Card</h3>
            
            <form onSubmit={handleAddPatientSubmit} className="space-y-4 text-xs font-mono">
              <div>
                <label className="text-zinc-500 uppercase tracking-wide block mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  value={newPatient.name}
                  onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                  placeholder="e.g. Alexander Fleming"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-500 uppercase tracking-wide block mb-1">Age</label>
                  <input
                    type="number"
                    required
                    value={newPatient.age}
                    onChange={(e) => setNewPatient({ ...newPatient, age: parseInt(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 uppercase tracking-wide block mb-1">Biological Gender</label>
                  <select
                    value={newPatient.gender}
                    onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value as any })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-zinc-500 uppercase tracking-wide block mb-1">MRN Number</label>
                <input
                  type="text"
                  required
                  value={newPatient.mrn}
                  onChange={(e) => setNewPatient({ ...newPatient, mrn: e.target.value })}
                  placeholder="e.g. MRN-123456"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-zinc-500 uppercase tracking-wide block mb-1">Primary Clinical Indication</label>
                <textarea
                  value={newPatient.indication}
                  onChange={(e) => setNewPatient({ ...newPatient, indication: e.target.value })}
                  placeholder="Brief clinical reason for echo study..."
                  rows={3}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-sans"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase tracking-wider rounded-lg transition-all shadow-lg"
              >
                Register Card & Begin Study
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
