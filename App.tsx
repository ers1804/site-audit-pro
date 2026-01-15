
import React, { useState, useEffect } from 'react';
import { SiteReport, TextModule, Deviation } from './types';
import Dashboard from './components/Dashboard';
import ReportEditor from './components/ReportEditor';
import { TEXT_MODULES } from './constants';
import { 
  getAllReports, 
  saveReportToDB, 
  deleteReportFromDB, 
  getAllCustomModules, 
  saveModuleToDB, 
  deleteModuleFromDB,
  syncFromCloud
} from './services/storage';
import { initDriveApi, authenticateDrive, isDriveAuthenticated, saveToDrive, loadFromDrive, listDriveReports } from './services/googleDrive';

const App: React.FC = () => {
  const [reports, setReports] = useState<SiteReport[]>([]);
  const [customModules, setCustomModules] = useState<TextModule[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'editor'>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        await initDriveApi().catch(err => console.warn("Google API not initialized - might be missing Client ID"));
        
        let modulesData = await getAllCustomModules();
        if (modulesData.length === 0) {
          const seededModules = TEXT_MODULES.map(m => ({ ...m, id: crypto.randomUUID(), lastUpdated: Date.now() }));
          await Promise.all(seededModules.map(m => saveModuleToDB(m)));
          modulesData = seededModules;
        }

        const reportsData = await getAllReports();
        setReports(reportsData.sort((a, b) => b.visitDate.localeCompare(a.visitDate)));
        setCustomModules(modulesData);
      } catch (error) {
        console.error("Failed to load data", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleDriveConnect = async () => {
    try {
      setIsCloudSyncing(true);
      await authenticateDrive();
      setIsDriveConnected(true);
      await syncAllWithDrive();
    } catch (err) {
      console.error("Drive connection failed", err);
      alert("Google Drive connection failed. Please check your internet connection and Client ID configuration.");
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const syncAllWithDrive = async () => {
    if (!isDriveAuthenticated()) return;
    setIsCloudSyncing(true);
    try {
      // 1. Pull modules
      const cloudModules = await loadFromDrive<TextModule[]>('modules_v1.json') || [];
      
      // 2. Pull all reports
      const cloudReportNames = await listDriveReports();
      const cloudReports: SiteReport[] = [];
      for (const name of cloudReportNames) {
        const r = await loadFromDrive<SiteReport>(name);
        if (r) cloudReports.push(r);
      }

      // 3. Merge locally
      await syncFromCloud(cloudReports, cloudModules);

      // 4. Update UI
      const updatedModules = await getAllCustomModules();
      const updatedReports = await getAllReports();
      setReports(updatedReports.sort((a, b) => b.visitDate.localeCompare(a.visitDate)));
      setCustomModules(updatedModules);

      // 5. Push current state back to cloud (to ensure cloud is updated with any newer local items)
      await saveToDrive('modules_v1.json', updatedModules);
      for (const r of updatedReports) {
        await saveToDrive(`report_${r.id}.json`, r);
      }
    } catch (err) {
      console.error("Sync failed", err);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const createNewReport = async () => {
    const now = new Date();
    const newReport: SiteReport = {
      id: crypto.randomUUID(),
      projectName: '',
      projectNumber: '',
      reportNumber: '',
      visitDate: now.toISOString().split('T')[0],
      visitTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      location: '',
      author: '',
      inspector: '',
      distributionList: [],
      deviations: [],
      status: 'Draft',
      lastUpdated: Date.now()
    };
    
    try {
      await saveReportToDB(newReport);
      if (isDriveAuthenticated()) {
        saveToDrive(`report_${newReport.id}.json`, newReport);
      }
      setReports(prev => [newReport, ...prev]);
      setActiveReportId(newReport.id);
      setView('editor');
    } catch (error) {
      console.error("Failed to create report", error);
    }
  };

  const updateReport = async (updatedReport: SiteReport) => {
    const reportWithTime = { ...updatedReport, lastUpdated: Date.now() };
    setReports(prev => prev.map(r => r.id === reportWithTime.id ? reportWithTime : r));
    try {
      await saveReportToDB(reportWithTime);
      if (isDriveAuthenticated()) {
        saveToDrive(`report_${reportWithTime.id}.json`, reportWithTime);
      }
    } catch (error) {
      console.error("Failed to sync update", error);
    }
  };

  const updateDeviationInReport = async (reportId: string, deviationId: string, updates: Partial<Deviation>) => {
    setReports(prev => prev.map(r => {
      if (r.id !== reportId) return r;
      const updatedDeviations = r.deviations.map(d => 
        d.id === deviationId ? { ...d, ...updates } : d
      );
      const updatedReport = { ...r, deviations: updatedDeviations, lastUpdated: Date.now() };
      saveReportToDB(updatedReport);
      if (isDriveAuthenticated()) {
        saveToDrive(`report_${updatedReport.id}.json`, updatedReport);
      }
      return updatedReport;
    }));
  };

  const deleteReport = async (id: string) => {
    if (confirm('Are you sure you want to delete this report?')) {
      try {
        await deleteReportFromDB(id);
        setReports(prev => prev.filter(r => r.id !== id));
        // Note: Drive deletion would require drive.files.delete permission if desired
      } catch (error) {
        console.error("Failed to delete report", error);
      }
    }
  };

  const addCustomModule = async (category: string, content: string) => {
    const newModule: TextModule = { id: crypto.randomUUID(), category, content, lastUpdated: Date.now() };
    try {
      await saveModuleToDB(newModule);
      const updated = [...customModules, newModule];
      setCustomModules(updated);
      if (isDriveAuthenticated()) {
        saveToDrive('modules_v1.json', updated);
      }
    } catch (error) {
      console.error("Failed to save module", error);
    }
  };

  const updateCustomModule = async (id: string, category: string, content: string) => {
    const updatedModule = { id, category, content, lastUpdated: Date.now() };
    try {
      await saveModuleToDB(updatedModule);
      const updated = customModules.map(m => m.id === id ? updatedModule : m);
      setCustomModules(updated);
      if (isDriveAuthenticated()) {
        saveToDrive('modules_v1.json', updated);
      }
    } catch (error) {
      console.error("Failed to update module", error);
    }
  };

  const deleteCustomModule = async (id: string) => {
    try {
      await deleteModuleFromDB(id);
      const updated = customModules.filter(m => m.id !== id);
      setCustomModules(updated);
      if (isDriveAuthenticated()) {
        saveToDrive('modules_v1.json', updated);
      }
    } catch (error) {
      console.error("Failed to delete module", error);
    }
  };

  const activeReport = reports.find(r => r.id === activeReportId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Initializing SiteAudit Pro...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-slate-900 text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <i className="fas fa-hard-hat text-yellow-400 text-2xl"></i>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white leading-tight">SiteAudit Pro</h1>
              {isDriveConnected && (
                <div className="flex items-center gap-1.5 text-[10px] text-blue-300 font-bold uppercase tracking-wider">
                  <span className={`w-1.5 h-1.5 rounded-full ${isCloudSyncing ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></span>
                  Cloud Connected
                </div>
              )}
            </div>
          </div>
          {view === 'editor' && (
            <button 
              onClick={() => setView('dashboard')}
              className="text-sm bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition"
            >
              <i className="fas fa-chevron-left mr-2"></i> Dashboard
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6">
        {view === 'dashboard' ? (
          <Dashboard 
            reports={reports} 
            customModules={customModules}
            isCloudConnected={isDriveConnected}
            isSyncing={isCloudSyncing}
            onConnectDrive={handleDriveConnect}
            onCreateNew={createNewReport} 
            onEdit={(id) => { setActiveReportId(id); setView('editor'); }}
            onDelete={deleteReport}
            onAddModule={addCustomModule}
            onUpdateModule={updateCustomModule}
            onDeleteModule={deleteCustomModule}
          />
        ) : activeReport ? (
          <ReportEditor 
            report={activeReport} 
            customModules={customModules}
            onUpdate={updateReport} 
            onUpdateDeviation={(devId, updates) => updateDeviationInReport(activeReport.id, devId, updates)}
          />
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-500">Report not found.</p>
            <button onClick={() => setView('dashboard')} className="text-blue-600 mt-4 underline">Return to Dashboard</button>
          </div>
        )}
      </main>

      {view === 'dashboard' && (
        <button 
          onClick={createNewReport}
          className="fixed bottom-6 right-6 bg-yellow-500 hover:bg-yellow-600 text-slate-900 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
          title="New Report"
        >
          <i className="fas fa-plus text-xl"></i>
        </button>
      )}
    </div>
  );
};

export default App;
