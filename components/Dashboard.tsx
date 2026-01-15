
import React, { useState } from 'react';
import { SiteReport, TextModule } from '../types';

interface DashboardProps {
  reports: SiteReport[];
  customModules: TextModule[];
  isCloudConnected: boolean;
  isSyncing: boolean;
  onConnectDrive: () => void;
  onCreateNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAddModule: (category: string, content: string) => void;
  onUpdateModule: (id: string, category: string, content: string) => void;
  onDeleteModule: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  reports, 
  customModules, 
  isCloudConnected,
  isSyncing,
  onConnectDrive,
  onCreateNew, 
  onEdit, 
  onDelete, 
  onAddModule, 
  onUpdateModule,
  onDeleteModule 
}) => {
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [newCat, setNewCat] = useState('');
  const [newContent, setNewContent] = useState('');

  const handleSubmitModule = () => {
    if (newCat && newContent) {
      if (editingModuleId) {
        onUpdateModule(editingModuleId, newCat, newContent);
        setEditingModuleId(null);
      } else {
        onAddModule(newCat, newContent);
      }
      setNewCat('');
      setNewContent('');
    }
  };

  const handleEditClick = (mod: TextModule) => {
    setEditingModuleId(mod.id!);
    setNewCat(mod.category);
    setNewContent(mod.content);
  };

  const handleCancelEdit = () => {
    setEditingModuleId(null);
    setNewCat('');
    setNewContent('');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Site Management</h2>
          <p className="text-slate-500">Overview of reports and library modules</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {!isCloudConnected ? (
            <button 
              onClick={onConnectDrive}
              className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-md flex items-center justify-center gap-2"
            >
              <i className="fab fa-google-drive"></i>
              Connect Drive
            </button>
          ) : (
            <div className="flex-1 sm:flex-none bg-white border border-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
              <i className={`fas ${isSyncing ? 'fa-sync fa-spin' : 'fa-check-circle'}`}></i>
              {isSyncing ? 'Syncing...' : 'Synced'}
            </div>
          )}
          <button 
            onClick={() => setShowModuleModal(true)}
            className="flex-1 sm:flex-none bg-white border border-gray-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition shadow-sm flex items-center justify-center gap-2"
          >
            <i className="fas fa-book text-blue-500"></i>
            Modules
          </button>
        </div>
      </div>

      <section>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Recent Reports</h3>
        {reports.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-clipboard-list text-gray-400 text-2xl"></i>
            </div>
            <h3 className="text-lg font-medium text-slate-700">No reports yet</h3>
            <p className="text-slate-500 mb-6">Create your first site visit report to get started.</p>
            <button 
              onClick={onCreateNew}
              className="bg-slate-900 text-white px-6 py-2 rounded-xl hover:bg-slate-800 transition shadow-md"
            >
              Create New Report
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {reports.map(report => (
              <div 
                key={report.id}
                className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition group"
              >
                <div className="flex justify-between items-start">
                  <div onClick={() => onEdit(report.id)} className="cursor-pointer flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${report.status === 'Final' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {report.status}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">#{report.projectNumber || 'UNSET'}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800 group-hover:text-blue-600 transition">
                      {report.projectName || 'Untitled Project'}
                    </h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <i className="far fa-calendar text-xs"></i> {report.visitDate}
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <i className="fas fa-camera text-xs"></i> {report.deviations.length} Items
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => onEdit(report.id)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button 
                      onClick={() => onDelete(report.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modules Modal */}
      {showModuleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Library Modules</h3>
                <p className="text-sm text-gray-500">Edit or add standardized text modules</p>
              </div>
              <button onClick={() => { setShowModuleModal(false); handleCancelEdit(); }} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 transition">
                <i className="fas fa-times text-gray-500"></i>
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {/* Add/Edit Module Form */}
              <div className={`${editingModuleId ? 'bg-amber-50 border-amber-200' : 'bg-blue-50/50 border-blue-100'} border p-4 rounded-2xl space-y-3 transition-colors`}>
                <h4 className={`text-xs font-bold uppercase tracking-widest ${editingModuleId ? 'text-amber-600' : 'text-blue-600'}`}>
                  {editingModuleId ? 'Edit Module' : 'Add New Module'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input 
                    placeholder="Category"
                    className="md:col-span-1 p-2.5 bg-white text-slate-900 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newCat}
                    onChange={e => setNewCat(e.target.value)}
                  />
                  <input 
                    placeholder="Module text content..."
                    className="md:col-span-2 p-2.5 bg-white text-slate-900 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newContent}
                    onChange={e => setNewContent(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSubmitModule}
                      className={`flex-1 ${editingModuleId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-xl py-2 px-4 transition font-semibold text-sm`}
                    >
                      {editingModuleId ? 'Update' : 'Add'}
                    </button>
                    {editingModuleId && (
                      <button 
                        onClick={handleCancelEdit}
                        className="bg-gray-200 text-gray-600 rounded-xl py-2 px-3 hover:bg-gray-300 transition font-semibold text-sm"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Modules List */}
              <div className="space-y-3 pb-4">
                {customModules.length === 0 ? (
                  <p className="text-center py-10 text-gray-400 italic text-slate-500">No modules in your library.</p>
                ) : (
                  customModules.map(mod => (
                    <div key={mod.id} className="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 transition group shadow-sm">
                      <div className="flex-1 pr-4">
                        <span className="text-[10px] font-bold uppercase text-blue-500 block mb-1 tracking-wider">{mod.category}</span>
                        <p className="text-sm text-slate-700 leading-relaxed">{mod.content}</p>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEditClick(mod)}
                          className="p-2 text-slate-400 hover:text-blue-500 transition"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button 
                          onClick={() => onDeleteModule(mod.id!)}
                          className="p-2 text-slate-400 hover:text-red-500 transition"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
