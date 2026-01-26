
import React, { useState, useEffect, useRef } from 'react';
import { SiteReport, DistributionRecipient, Deviation, TextModule } from '../types';
import { SEVERITIES, ACTION_STATUSES } from '../constants';
import { generatePDF } from '../services/pdfService';
import { GoogleGenAI } from "@google/genai";

interface ReportEditorProps {
  report: SiteReport;
  customModules: TextModule[];
  onUpdate: (report: SiteReport) => void;
  onUpdateDeviation: (deviationId: string, updates: Partial<Deviation>) => void;
}

const ReportEditor: React.FC<ReportEditorProps> = ({ report, customModules, onUpdate, onUpdateDeviation }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'people' | 'deviations'>('info');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const allModules = customModules;

  // Auto-locate on first load if location is empty
  useEffect(() => {
    if (activeTab === 'info' && !report.location) {
      handleAutoLocate();
    }
  }, []);

  useEffect(() => {
    const handleGlobalClick = () => setOpenDropdownId(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleAutoLocate = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Use OpenStreetMap Nominatim for free reverse geocoding
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, {
            headers: {
              'Accept-Language': 'en'
            }
          });
          const data = await response.json();
          const address = data.address;
          // Heuristic for "next city": try city, then town, then village, then suburb
          const city = address.city || address.town || address.village || address.suburb || address.municipality || 'Unknown Location';
          const road = address.road ? `${address.road}, ` : '';
          const zipCode = address.postcode || '';
          updateField('location', `${zipCode} ${city}`);
        } catch (error) {
          console.error("Geocoding failed", error);
          updateField('location', `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`);
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error("Location detection failed", error);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const updateField = (field: keyof SiteReport, value: any) => {
    onUpdate({ ...report, [field]: value });
  };

  const addItem = <T,>(field: 'distributionList' | 'deviations', item: T) => {
    onUpdate({ ...report, [field]: [...report[field], item] });
  };

  const removeItem = (field: 'distributionList' | 'deviations', id: string) => {
    onUpdate({ ...report, [field]: (report[field] as any[]).filter(item => item.id !== id) });
  };

  const compressImage = (base64Str: string, maxWidth = 1200, maxHeight = 1200): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const compressedBase64 = await compressImage(base64String);
        
        const newDeviation: Deviation = {
          id: crypto.randomUUID(),
          photoUrl: compressedBase64,
          textModule: '',
          severity: 'Gruen',
          actionStatus: 'laufend',
          responsible: ''
        };
        
        addItem('deviations', newDeviation);
      };
      reader.readAsDataURL(file);
    }
  };

  const addGeneralDeviation = () => {
    const newDeviation: Deviation = {
      id: crypto.randomUUID(),
      textModule: '',
      severity: 'Gruen',
      actionStatus: 'laufend',
      responsible: ''
    };
    addItem('deviations', newDeviation);
  };

  const handleAiAnalyze = async (deviation: Deviation) => {
    if (!process.env.API_KEY || !deviation.photoUrl) return;
    
    setAnalyzingIds(prev => new Set(prev).add(deviation.id));
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64Data = deviation.photoUrl.split(',')[1];
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
            { text: "Analyze this construction site photo. Suggest a professional deviation report entry. Keep it concise. Focus on safety or quality." }
          ]
        }
      });
      
      if (response.text) {
        const currentText = deviation.textModule;
        const suggestion = response.text;
        const newText = currentText ? `${currentText}\n\nAI Suggestion: ${suggestion}` : suggestion;
        onUpdateDeviation(deviation.id, { textModule: newText });
      }
    } catch (error) {
      console.error("AI Analysis failed", error);
      alert("AI analysis failed.");
    } finally {
      setAnalyzingIds(prev => {
        const next = new Set(prev);
        next.delete(deviation.id);
        return next;
      });
    }
  };

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    try {
      await generatePDF(report);
    } catch (e) {
      console.error(e);
      alert('Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200">
        <button onClick={() => setActiveTab('info')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${activeTab === 'info' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <i className="fas fa-info-circle mr-2"></i> Info
        </button>
        <button onClick={() => setActiveTab('people')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${activeTab === 'people' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <i className="fas fa-users mr-2"></i> Verteilerliste
        </button>
        <button onClick={() => setActiveTab('deviations')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${activeTab === 'deviations' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <i className="fas fa-exclamation-triangle mr-2"></i> Beobachtungen ({report.deviations.length})
        </button>
      </div>

      <div className="min-h-[60vh] pb-32">
        {activeTab === 'info' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4">Projekt Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1"><label className="text-xs font-semibold text-gray-500 uppercase">Bauvorhaben</label><input type="text" value={report.projectName} onChange={(e) => updateField('projectName', e.target.value)} placeholder="e.g. Skyline Apartments" className="w-full p-2.5 bg-white text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" /></div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-xs font-semibold text-gray-500 uppercase">Dok. Nr.</label><input type="text" value={report.projectNumber} onChange={(e) => updateField('projectNumber', e.target.value)} placeholder="e.g. PRJ-001" className="w-full p-2.5 bg-white text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" /></div>
                <div className="space-y-1"><label className="text-xs font-semibold text-gray-500 uppercase">Protokoll lfd. Nr.</label><input type="text" value={report.reportNumber} onChange={(e) => updateField('reportNumber', e.target.value)} placeholder="e.g. 01" className="w-full p-2.5 bg-white text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" /></div>
              </div>
              
              <div className="md:col-span-2 space-y-1">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Ort</label>
                  <button 
                    onClick={handleAutoLocate}
                    disabled={isLocating}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                  >
                    {isLocating ? (
                      <><i className="fas fa-circle-notch fa-spin"></i> Position wird ermittelt...</>
                    ) : (
                      <><i className="fas fa-location-crosshairs"></i> Position aktualisieren</>
                    )}
                  </button>
                </div>
                <input 
                  type="text" 
                  value={report.location} 
                  onChange={(e) => updateField('location', e.target.value)} 
                  placeholder="Street Address or City" 
                  className="w-full p-2.5 bg-white text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" 
                />
              </div>

              <div className="space-y-1"><label className="text-xs font-semibold text-gray-500 uppercase">Datum</label><input type="date" value={report.visitDate} onChange={(e) => updateField('visitDate', e.target.value)} className="w-full p-2.5 bg-white text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" /></div>
              <div className="space-y-1"><label className="text-xs font-semibold text-gray-500 uppercase">Zeit</label><input type="time" value={report.visitTime} onChange={(e) => updateField('visitTime', e.target.value)} className="w-full p-2.5 bg-white text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" /></div>
              
              <div className="space-y-1"><label className="text-xs font-semibold text-gray-500 uppercase">Verfasser</label><input type="text" value={report.author} onChange={(e) => updateField('author', e.target.value)} placeholder="Name of Author" className="w-full p-2.5 bg-white text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" /></div>
              <div className="space-y-1"><label className="text-xs font-semibold text-gray-500 uppercase">Leiter</label><input type="text" value={report.inspector} onChange={(e) => updateField('inspector', e.target.value)} placeholder="Name of Inspector" className="w-full p-2.5 bg-white text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" /></div>
            </div>
          </div>
        )}

        {activeTab === 'people' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800">Verteiler- & Anwesenheitsliste</h3>
                <button onClick={() => addItem<DistributionRecipient>('distributionList', { id: crypto.randomUUID(), name: '', role: '', company: '', email: '', isPresent: false })} className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition"><i className="fas fa-plus mr-1"></i> Empfänger hinzufügen</button>
              </div>
              <div className="space-y-3">
                {report.distributionList.map((person, idx) => (
                  <div key={person.id} className="p-4 bg-gray-50 rounded-xl relative border border-slate-100">
                    <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                          checked={person.isPresent}
                          onChange={(e) => { const nl = [...report.distributionList]; nl[idx].isPresent = e.target.checked; updateField('distributionList', nl); }}
                        />
                        <span className={`text-xs font-bold uppercase ${person.isPresent ? 'text-blue-600' : 'text-gray-400'}`}>Anwesend</span>
                      </label>
                      <button onClick={() => removeItem('distributionList', person.id)} className="p-2 text-red-400 hover:text-red-600 transition"><i className="fas fa-trash-alt"></i></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <input placeholder="Name" className="p-2 bg-white text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" value={person.name} onChange={(e) => { const nl = [...report.distributionList]; nl[idx].name = e.target.value; updateField('distributionList', nl); }} />
                      <input placeholder="Funktion" className="p-2 bg-white text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" value={person.role} onChange={(e) => { const nl = [...report.distributionList]; nl[idx].role = e.target.value; updateField('distributionList', nl); }} />
                      <input placeholder="Firma" className="p-2 bg-white text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" value={person.company} onChange={(e) => { const nl = [...report.distributionList]; nl[idx].company = e.target.value; updateField('distributionList', nl); }} />
                      <input placeholder="Email" className="p-2 bg-white text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" value={person.email} onChange={(e) => { const nl = [...report.distributionList]; nl[idx].email = e.target.value; updateField('distributionList', nl); }} />
                    </div>
                  </div>
                ))}
                {report.distributionList.length === 0 && (
                  <div className="text-center py-8 text-gray-400 italic text-sm">Keine Empfänger vorhanden.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'deviations' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex flex-wrap gap-3 justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800">Beobachtungen</h3>
                <div className="flex gap-2">
                  <button onClick={addGeneralDeviation} className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition shadow-md flex items-center gap-2">
                    <i className="fas fa-plus"></i> <span>Beobachtung hinzufügen</span>
                  </button>
                  <label className="cursor-pointer bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition shadow-md flex items-center gap-2">
                    <i className="fas fa-camera"></i> <span>Foto hinzufügen</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                </div>
              </div>

              <div className="space-y-8">
                {report.deviations.map((deviation, idx) => (
                  <div 
                    key={deviation.id} 
                    className={`grid grid-cols-1 md:grid-cols-12 gap-6 p-4 border border-slate-200 rounded-2xl relative bg-white shadow-sm transition-all overflow-visible ${openDropdownId === deviation.id ? 'ring-2 ring-blue-500/20 z-[100]' : 'z-10'}`}
                  >
                    <div className="absolute top-0 left-0 bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-br-lg uppercase z-10">Item #{idx + 1}</div>
                    <button onClick={() => removeItem('deviations', deviation.id)} className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg z-20 hover:bg-red-600 transition"><i className="fas fa-times"></i></button>

                    <div className="md:col-span-4 mt-4 md:mt-0 self-start">
                      {deviation.photoUrl ? (
                        <div className="space-y-2">
                          <div className="w-full h-48 overflow-hidden rounded-xl border border-slate-100 bg-gray-50 flex items-center justify-center">
                            <img src={deviation.photoUrl} alt={`Item ${idx + 1}`} className="w-full h-full object-cover" />
                          </div>
                          <button 
                            onClick={() => handleAiAnalyze(deviation)}
                            disabled={analyzingIds.has(deviation.id)}
                            className="w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition disabled:opacity-50 flex items-center justify-center gap-2 border border-blue-100"
                          >
                            {analyzingIds.has(deviation.id) ? (
                              <><i className="fas fa-circle-notch fa-spin"></i> Analyzing...</>
                            ) : (
                              <><i className="fas fa-magic"></i> Suggest with AI</>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="w-full h-48 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                          <i className="fas fa-align-left text-3xl mb-2 text-slate-300"></i>
                          <span className="text-xs font-medium">Beobachtung ohne Bild</span>
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-8 space-y-4">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Schweregrad</label>
                          <select 
                            className={`w-full text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 focus:ring-2 ${
                              deviation.severity === 'Rot' ? 'bg-red-50 text-red-700' : deviation.severity === 'Gruen' ? 'bg-green-50 text-green-700' : 'bg-green-50 text-green-700'
                            }`}
                            value={deviation.severity}
                            onChange={(e) => onUpdateDeviation(deviation.id, { severity: e.target.value as any })}
                          >
                            {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">erledigen</label>
                          <select 
                            className="w-full text-xs bg-white text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={deviation.actionStatus || 'laufend'}
                            onChange={(e) => onUpdateDeviation(deviation.id, { actionStatus: e.target.value as any })}
                          >
                            {ACTION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Verantwortlich</label>
                          <input 
                            placeholder="Verantwortliche Person/Firma"
                            className="w-full text-xs bg-white text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={deviation.responsible || ''}
                            onChange={(e) => onUpdateDeviation(deviation.id, { responsible: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Beobachtungsdetails</label>
                          <div className="relative overflow-visible">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(openDropdownId === deviation.id ? null : deviation.id);
                              }}
                              className="text-[10px] bg-blue-50 text-blue-600 px-3 py-1 rounded border border-blue-200 hover:bg-blue-100 transition shadow-sm font-semibold flex items-center gap-1"
                            >
                              <i className="fas fa-list-ul"></i> Textmodul <i className="fas fa-chevron-down"></i>
                            </button>
                            {openDropdownId === deviation.id && (
                              <div 
                                className="absolute right-0 top-full mt-2 w-[280px] sm:w-[400px] bg-white border border-slate-200 shadow-2xl rounded-2xl z-[200] max-h-[300px] overflow-y-auto p-2 animate-in fade-in zoom-in duration-150 ring-1 ring-black/5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="sticky top-0 bg-white p-2 border-b mb-2 flex justify-between items-center z-10">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Textmodule</span>
                                  <button onClick={() => setOpenDropdownId(null)} className="text-slate-400 p-1 hover:text-slate-600"><i className="fas fa-times"></i></button>
                                </div>
                                {allModules.length === 0 ? (
                                  <div className="p-6 text-center text-xs text-gray-400 italic">Keine Module vorhanden</div>
                                ) : (
                                  allModules.map((m, mIdx) => (
                                    <button 
                                      key={m.id || mIdx} 
                                      onClick={() => { 
                                        const newText = (deviation.textModule ? deviation.textModule + ' ' : '') + m.content;
                                        onUpdateDeviation(deviation.id, { textModule: newText });
                                        setOpenDropdownId(null);
                                      }} 
                                      className="w-full text-left p-3 text-xs hover:bg-blue-50 rounded-xl border-b border-slate-50 last:border-0 transition-colors group flex flex-col"
                                    >
                                      <span className="font-bold text-blue-600 mb-0.5 uppercase tracking-tighter text-[9px] group-hover:text-blue-700">{m.category}</span>
                                      <span className="text-slate-800 leading-relaxed font-medium">{m.content}</span>
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <textarea 
                          className="w-full p-4 bg-white text-slate-900 border border-slate-200 rounded-xl text-sm min-h-[140px] focus:ring-2 focus:ring-blue-500 outline-none shadow-inner leading-relaxed resize-none" 
                          placeholder="Manually describe the observation or use the modules library..." 
                          value={deviation.textModule} 
                          onChange={(e) => onUpdateDeviation(deviation.id, { textModule: e.target.value })} 
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-4xl mx-auto flex justify-between gap-4">
          <button 
            onClick={() => updateField('status', report.status === 'Draft' ? 'Final' : 'Draft')} 
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 shadow-sm ${report.status === 'Final' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}
          >
            <i className={`fas ${report.status === 'Final' ? 'fa-lock' : 'fa-pencil-alt'}`}></i> 
            <span className="font-bold">{report.status}</span>
          </button>
          <button 
            disabled={isGenerating} 
            onClick={handleGeneratePDF} 
            className="flex-1 max-w-xs bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isGenerating ? <><i className="fas fa-circle-notch fa-spin"></i> Generating...</> : <><i className="fas fa-file-pdf"></i> Export PDF</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportEditor;
