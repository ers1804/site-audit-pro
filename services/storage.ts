
import { SiteReport, TextModule } from '../types';

const DB_NAME = 'SiteAuditDB';
const REPORTS_STORE = 'reports';
const MODULES_STORE = 'textModules';
const DB_VERSION = 2; // Bumped version for new store

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
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(REPORTS_STORE, 'readwrite');
    const store = transaction.objectStore(REPORTS_STORE);
    const request = store.put(report);

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
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MODULES_STORE, 'readwrite');
    const store = transaction.objectStore(MODULES_STORE);
    const request = store.put(module);

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
