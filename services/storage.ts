
import { SiteReport, TextModule } from '../types';

const DB_NAME = 'SiteAuditDB';
const REPORTS_STORE = 'reports';
const MODULES_STORE = 'textModules';
const DB_VERSION = 3;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(REPORTS_STORE)) {
        db.createObjectStore(REPORTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(MODULES_STORE)) {
        db.createObjectStore(MODULES_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllReports(): Promise<SiteReport[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(REPORTS_STORE, 'readonly');
    const store = transaction.objectStore(REPORTS_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveReportToDB(report: SiteReport): Promise<void> {
  const db = await openDB();
  const reportWithTimestamp = { ...report, lastUpdated: Date.now() };
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(REPORTS_STORE, 'readwrite');
    const store = transaction.objectStore(REPORTS_STORE);
    const request = store.put(reportWithTimestamp);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteReportFromDB(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(REPORTS_STORE, 'readwrite');
    const store = transaction.objectStore(REPORTS_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllCustomModules(): Promise<TextModule[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MODULES_STORE, 'readonly');
    const store = transaction.objectStore(MODULES_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveModuleToDB(module: TextModule): Promise<void> {
  const db = await openDB();
  const moduleWithTimestamp = { ...module, lastUpdated: Date.now() };
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MODULES_STORE, 'readwrite');
    const store = transaction.objectStore(MODULES_STORE);
    const request = store.put(moduleWithTimestamp);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteModuleFromDB(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MODULES_STORE, 'readwrite');
    const store = transaction.objectStore(MODULES_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Merges cloud data into local DB if cloud data is newer.
 */
export async function syncFromCloud(reports: SiteReport[], modules: TextModule[]): Promise<void> {
  const db = await openDB();
  
  // Merge Reports
  const reportTx = db.transaction(REPORTS_STORE, 'readwrite');
  const reportStore = reportTx.objectStore(REPORTS_STORE);
  for (const cloudReport of reports) {
    const localReq = reportStore.get(cloudReport.id);
    localReq.onsuccess = () => {
      const local = localReq.result;
      if (!local || cloudReport.lastUpdated > (local.lastUpdated || 0)) {
        reportStore.put(cloudReport);
      }
    };
  }

  // Merge Modules
  const modTx = db.transaction(MODULES_STORE, 'readwrite');
  const modStore = modTx.objectStore(MODULES_STORE);
  for (const cloudMod of modules) {
    if (cloudMod.id) {
      const localReq = modStore.get(cloudMod.id);
      localReq.onsuccess = () => {
        const local = localReq.result;
        if (!local || (cloudMod.lastUpdated || 0) > (local.lastUpdated || 0)) {
          modStore.put(cloudMod);
        }
      };
    }
  }
}
