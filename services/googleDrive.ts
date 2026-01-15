/**
 * Service for interacting with Google Drive AppData folder.
 * This keeps application data private from the user's main drive files.
 */

// Global declarations for Google API libraries
declare const gapi: any;
declare const google: any;

const CLIENT_ID = '292238528070-e51njlj48b3qi3mstrba1hh495jr72pe.apps.googleusercontent.com'; // User must replace this or it will fall back to local only
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];

let tokenClient: any = null;
let gapiInited = false;
let gapiAuthenticated = false;

export const initDriveApi = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Initialize the gapi client
    gapi.load('client', async () => {
      try {
        // Initialize with discovery docs
        await gapi.client.init({
          discoveryDocs: DISCOVERY_DOCS,
        });
        gapiInited = true;
        
        // Initialize Identity Services
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: '', // defined at request time
        });

        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
};

export const authenticateDrive = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    tokenClient.callback = async (resp: any) => {
      if (resp.error !== undefined) {
        reject(resp);
      }
      gapiAuthenticated = true;
      resolve(resp.access_token);
    };

    // Use current token if available to avoid unnecessary prompts
    if (gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
};

export const isDriveAuthenticated = () => gapiAuthenticated;

async function findFile(name: string): Promise<any | null> {
  // Search for specific file in AppData folder
  const response = await gapi.client.drive.files.list({
    q: `name = '${name}' and 'appDataFolder' in parents`,
    spaces: 'appDataFolder',
    fields: 'files(id, name, modifiedTime)',
  });
  const files = response.result.files;
  return files && files.length > 0 ? files[0] : null;
}

export async function saveToDrive(name: string, data: any): Promise<void> {
  if (!gapiAuthenticated) return;

  const existingFile = await findFile(name);
  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const contentType = 'application/json';
  const metadata = {
    name: name,
    mimeType: contentType,
    parents: ['appDataFolder']
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: ' + contentType + '\r\n\r\n' +
    JSON.stringify(data) +
    close_delim;

  if (existingFile) {
    // Update existing file
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${gapi.client.getToken().access_token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });
  } else {
    // Create new file
    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gapi.client.getToken().access_token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });
  }
}

export async function loadFromDrive<T>(name: string): Promise<T | null> {
  if (!gapiAuthenticated) return null;

  const file = await findFile(name);
  if (!file) return null;

  // Retrieve file content with media alt format
  const response = await gapi.client.drive.files.get({
    fileId: file.id,
    alt: 'media'
  });

  return response.result;
}

export async function listDriveReports(): Promise<string[]> {
  // List all files starting with 'report_' in AppData folder
  const response = await gapi.client.drive.files.list({
    q: "name contains 'report_' and 'appDataFolder' in parents",
    spaces: 'appDataFolder',
    fields: 'files(name)',
  });
  return response.result.files.map((f: any) => f.name);
}
