
import React, { useState, useEffect } from 'react';
import { SiteReport, TextModule, Deviation } from './types';
import Dashboard from './components/Dashboard';
import ReportEditor from './components/ReportEditor';
import { TEXT_MODULES } from './constants';
import { getAllReports, saveReportToDB, deleteReportFromDB, getAllCustomModules, saveModuleToDB, deleteModuleFromDB } from './services/storage';

const App: React.FC = () => {
  const [reports, setReports] = useState<SiteReport[]>([]);
  const [customModules, setCustomModules] = useState<TextModule[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'editor'>('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        let modulesData = await getAllCustomModules();
        
        // Seed standard modules if the store is empty
        if (modulesData.length === 0) {
          const seededModules = TEXT_MODULES.map(m => ({ ...m, id: crypto.randomUUID() }));
          await Promise.all(seededModules.map(m => saveModuleToDB(m)));
          modulesData = seededModules;
        }

        const reportsData = await getAllReports();
        setReports(reportsData.sort((a, b) => b.visitDate.localeCompare(a.visitDate)));
        setCustomModules(modulesData);
      } catch (error) {
        console.error("Failed to load data from IndexedDB", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

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
      status: 'Draft'
    };
    
    try {
      await saveReportToDB(newReport);
      setReports(prev => [newReport, ...prev]);
      setActiveReportId(newReport.id);
      setView('editor');
    } catch (error) {
      console.error("Failed to create report", error);
      alert("Error: Could not save new report.");
    }
  };

  const updateReport = async (updatedReport: SiteReport) => {
    setReports(prev => prev.map(r => r.id === updatedReport.id ? updatedReport : r));
    try {
      await saveReportToDB(updatedReport);
    } catch (error) {
      console.error("Failed to sync update to storage", error);
    }
  };

  const updateDeviationInReport = async (reportId: string, deviationId: string, updates: Partial<Deviation>) => {
    setReports(prev => prev.map(r => {
      if (r.id !== reportId) return r;
      const updatedDeviations = r.deviations.map(d => 
        d.id === deviationId ? { ...d, ...updates } : d
      );
      const updatedReport = { ...r, deviations: updatedDeviations };
      saveReportToDB(updatedReport).catch(err => console.error("Auto-save deviation failed", err));
      return updatedReport;
    }));
  };

  const deleteReport = async (id: string) => {
    if (confirm('Are you sure you want to delete this report?')) {
      try {
        await deleteReportFromDB(id);
        setReports(prev => prev.filter(r => r.id !== id));
      } catch (error) {
        console.error("Failed to delete report", error);
      }
    }
  };

  const addCustomModule = async (category: string, content: string) => {
    const newModule: TextModule = { id: crypto.randomUUID(), category, content };
    try {
      await saveModuleToDB(newModule);
      setCustomModules(prev => [...prev, newModule]);
    } catch (error) {
      console.error("Failed to save module", error);
    }
  };

  const updateCustomModule = async (id: string, category: string, content: string) => {
    const updatedModule = { id, category, content };
    try {
      await saveModuleToDB(updatedModule);
      setCustomModules(prev => prev.map(m => m.id === id ? updatedModule : m));
    } catch (error) {
      console.error("Failed to update module", error);
    }
  };

  const deleteCustomModule = async (id: string) => {
    try {
      await deleteModuleFromDB(id);
      setCustomModules(prev => prev.filter(m => m.id !== id));
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
            <h1 className="text-xl font-bold tracking-tight text-white">SiteAudit Pro</h1>
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
