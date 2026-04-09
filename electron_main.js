process.on('uncaughtException', (err) => {
    console.error('CRITICAL FATAL ERROR:', err.stack || err);
});

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

autoUpdater.autoDownload = false;

// Variable global para la ruta del motor
let globalExecutablePath = null;
let mainWindow = null; // Needed for the updater to send messages to the UI

const puppeteerCachePath = path.join(app.getPath('userData'), '.puppeteer_cache');
process.env.PUPPETEER_CACHE_DIR = puppeteerCachePath;

    // PURE REBROWSER PUPPETEER (NO EXTRA JS EVASIONS THAT TRIGGER CREEPJS)
    const originalPuppeteer = require('puppeteer-core');
    const rebrowserPuppeteer = require('rebrowser-puppeteer-core');
    
    // We export the raw rebrowser puppeteer. 
    // No puppeteer-extra, no stealth plugin, all spoofing is done via C++ natively!
    const puppeteer = rebrowserPuppeteer;

async function ensureBrowser() {
    const { install, computeExecutablePath, Browser, BrowserPlatform } = require('@puppeteer/browsers');
    const buildId = '125.0.6422.113'; // Sync with user selection
    
    const platform = process.platform === 'win32' ? 
        (process.arch === 'x64' ? BrowserPlatform.WIN64 : BrowserPlatform.WIN32) : 
        (process.platform === 'darwin' ? BrowserPlatform.MAC : BrowserPlatform.LINUX);

    // --- PRIORIDAD 1: MOTOR C++ COMPILADO CLANDESTINO ---
    const internalPath = 'C:\\src\\chromium\\src\\out\\CreditPro\\chrome.exe';
    if (fs.existsSync(internalPath)) {
        globalExecutablePath = internalPath;
        console.log("Motor Stealth Compilado C++ detectado y ruteado.");
        return;
    }

    // --- PRIORIDAD 2: APPDATA (Descargado) ---
    globalExecutablePath = computeExecutablePath({
        browser: Browser.CHROME,
        buildId: buildId,
        cacheDir: puppeteerCachePath,
        platform: platform
    });

    const browserFolder = path.dirname(path.dirname(globalExecutablePath));
    if (!fs.existsSync(globalExecutablePath) && fs.existsSync(browserFolder)) {
        try { fs.rmSync(browserFolder, { recursive: true, force: true }); } catch(e) {}
    }

    if (!fs.existsSync(globalExecutablePath)) {
        console.log("--- INICIANDO DESCARGA DE EMERGENCIA ---");
        try {
            await install({
                browser: Browser.CHROME,
                buildId: buildId,
                cacheDir: puppeteerCachePath,
                platform: platform
            });
            console.log("--- DESCARGA COMPLETADA ---");
        } catch (err) {
            console.error("Error en descarga:", err);
            dialog.showErrorBox("Error Crítico", "No se encontró el motor de navegación interno ni se pudo descargar uno. Verifica tu conexión.");
        }
    }
}

let splashWindow = null;

function createSplash() {
    splashWindow = new BrowserWindow({
        width: 500,
        height: 380,
        icon: path.join(__dirname, 'SquircleMain.ico'),
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    splashWindow.loadFile('splash.html');
}

function launchMainGuiFromSplash() {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('splash-progress', { percent: 100, text: 'Abriendo Consola, finalizando...' });
        setTimeout(() => {
            if (!mainWindow) createWindow();
        }, 500);
    } else if (!mainWindow) {
        createWindow();
    }
}

// Ejecutar al iniciar
app.whenReady().then(async () => {
    createSplash();

    splashWindow.webContents.on('did-finish-load', async () => {
        const delay = ms => new Promise(r => setTimeout(r, ms));

        splashWindow.webContents.send('splash-progress', { percent: 15, text: 'Cargando Estilos y Core...' });
        await delay(1200); 

        splashWindow.webContents.send('splash-progress', { percent: 45, text: 'Iniciando Motor del Navegador...' });
        try { await ensureBrowser(); } catch(e) { console.error('Browser Check Error:', e); }
        await delay(1000); 

        splashWindow.webContents.send('splash-progress', { percent: 80, text: 'Buscando Actualizaciones...' });
        await delay(1500); 
        
        try {
            if (app.isPackaged) {
                // Avoid conflict with GUI update handlers
                const check = await autoUpdater.checkForUpdates();
                // check.updateInfo holds version if available
                if (check && check.updateInfo && check.updateInfo.version && check.updateInfo.version !== app.getVersion()) {
                    splashWindow.webContents.send('splash-update-available', check.updateInfo.version);
                    return; // Detenemos aquí para esperar respuesta del usuario
                }
            } else {
                // Modo dev/local: evitamos el error del autoUpdater
                console.log("Modo de desarrollo activo. Omitiendo validación nativa de updates.");
                await delay(1000); 
            }
        } catch(e) {
            console.error('Update server check fail:', e);
            await delay(1000);
        }
        
        launchMainGuiFromSplash();
    });
});

ipcMain.on('splash-action', (event, action) => {
    if (action === 'skip-update') {
        launchMainGuiFromSplash();
    } else if (action === 'start-update') {
        autoUpdater.on('download-progress', (p) => {
            if (splashWindow && !splashWindow.isDestroyed()) {
                let per = Math.round(p.percent);
                splashWindow.webContents.send('splash-progress', { percent: per, text: 'Descargando: ' + per + '%' });
            }
        });
        autoUpdater.on('update-downloaded', () => {
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.webContents.send('splash-progress', { percent: 100, text: 'Instalando y Reiniciando...' });
            }
            setTimeout(() => autoUpdater.quitAndInstall(), 800);
        });
        autoUpdater.downloadUpdate();
    }
});

const PROFILES_DIR = path.join(app.getPath('userData'), 'profiles_db');
if (!fs.existsSync(PROFILES_DIR)) {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
}

let activeBrowsers = {};

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 850,
        icon: path.join(__dirname, 'SquircleMain.ico'),
        minWidth: 1000,
        minHeight: 600,
        backgroundColor: '#0f111a',
        show: false,
        title: 'Nexium Anti-Detect Browser',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('gui.html');
    mainWindow.setMenuBarVisibility(false); // Hide the standard white menu bar
    
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.destroy();
            splashWindow = null;
        }
    });
}


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

const os = require('os');
const ADMIN_PC_NAME = 'blood';

const FIREBASE_URL = "https://Nexium-admin-default-rtdb.firebaseio.com";

async function reportStatus() {
    try {
        const pcId = os.hostname().replace(/\./g, '_'); //Firebase no permite puntos en keys
        const data = {
            pc_name: os.hostname(),
            username: os.userInfo().username,
            platform: os.platform(),
            lastSeen: new Date().toISOString(),
            status: 'Online'
        };
        
        // Enviamos el "Latido" a Firebase
        await fetch(`${FIREBASE_URL}/active_users/${pcId}.json`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    } catch (e) {
        // Silencioso para no molestar al usuario si no hay internet
    }
}

// Iniciar reporte y heartbeat
reportStatus();
setInterval(reportStatus, 300000); // Cada 5 min

ipcMain.handle('is-admin', () => {
    return os.userInfo().username.toLowerCase() === ADMIN_PC_NAME.toLowerCase();
});

ipcMain.handle('get-active-users', async () => {
    try {
        const response = await fetch(`${FIREBASE_URL}/active_users.json`);
        const users = await response.json();
        if (!users) return [];
        const now = Date.now();
        let list = Object.values(users).map(u => {
            const time = new Date(u.lastSeen).getTime();
            const isOnline = (now - time) < 600000; // 10 minutes threshold
            return {
                pc: u.pc_name,
                user: u.username,
                last: new Date(u.lastSeen).toLocaleString(),
                status: isOnline ? 'Online' : 'Offline',
                _rawDate: time
            };
        });
        list.sort((a, b) => b._rawDate - a._rawDate); // Sort by most recent
        return list;
    } catch (e) {
        return [];
    }
});


// --- LÓGICA DE ACTUALIZACIÓN (AUTO-UPDATER) ---

// 1. Cuando la app inicia y busca, avisa si hay una actualización
autoUpdater.on('update-available', (info) => {
    if (mainWindow) {
        mainWindow.webContents.send('update_available', info.version);
    }
});

// 2. Si el usuario decide descargarla, va mostrando el progreso
autoUpdater.on('download-progress', (progressObj) => {
    let percent = Math.round(progressObj.percent);
    if (mainWindow) {
        mainWindow.webContents.send('update_progress', percent);
    }
});

// 3. Cuando termina de descargar, avisa que está lista para instalar
autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) {
        mainWindow.webContents.send('update_downloaded');
    }
});

// 4. Si hay un error, lo mostramos
autoUpdater.on('error', (err) => {
    if (mainWindow) {
        mainWindow.webContents.send('update_error', err.message);
    }
});

// --- IPC de la Interfaz GUI hacia el Actualizador ---
// La GUI pregunta si debe forzar la comprobación (al abrir)
ipcMain.on('comprobar_actualizacion', () => {
    autoUpdater.checkForUpdates();
});

// El usuario dio clic a "Actualizar Ahora" en la GUI
ipcMain.on('descargar_actualizacion', () => {
    autoUpdater.downloadUpdate();
});

// El usuario dio clic a "Instalar y Reiniciar" luego de la descarga
ipcMain.on('instalar_actualizacion', () => {
    autoUpdater.quitAndInstall();
});


// --- MANEJO DE CATÁLOGOS (HARDWARE Y USER AGENTS) ---
// Estos manejadores sirven los datos a la interfaz de forma segura en cualquier PC
ipcMain.handle('get-catalog-hw', async () => {
    try {
        const p = path.join(app.getAppPath(), 'hardware_catalog.json');
        if (!fs.existsSync(p)) return null;
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) { return null; }
});

ipcMain.handle('get-catalog-ua', async () => {
    try {
        const p = path.join(app.getAppPath(), 'useragents_catalog.json');
        if (!fs.existsSync(p)) {
            // If the file doesn't exist, return a default catalog including the new Android 14 data
            return [
                {
                    platform: 'windows',
                    platform_versions: ['Windows 11', 'Windows 10'],
                    browsers: {
                        chrome: [
                            { browser_version: '125.0.6422.113', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.113 Safari/537.36' },
                            { browser_version: '124.0.6367.201', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.201 Safari/537.36' }
                        ],
                        firefox: [
                            { browser_version: '126.0', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0' }
                        ]
                    }
                },
                {
                    platform: 'mac',
                    platform_versions: ['macOS 14', 'macOS 13', 'macOS 12'],
                    browsers: {
                        chrome: [
                            { browser_version: '125.0.6422.113', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.113 Safari/537.36' }
                        ],
                        safari: [
                            { browser_version: '17.5', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15' }
                        ]
                    }
                },
                {
                    platform: 'android',
                    platform_versions: ['Android 14', 'Android 13', 'Android 12', 'Android 11'],
                    browsers: {
                        chrome: [
                            { browser_version: '133.0.6943.127', ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 9 Pro Build/AD1A.240530.030) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.127 Mobile Safari/537.36' },
                            { browser_version: '125.0.6422.113', ua: 'Mozilla/5.0 (Linux; Android 12; Pixel 6 Build/SD1A.210817.036) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.113 Mobile Safari/537.36' }
                        ]
                    }
                }
            ];
        }
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) { return null; }
});



// Compatibilidad con llamadas antiguas
ipcMain.handle('get-hw-catalog', async () => {
    try {
        const p = path.join(app.getAppPath(), 'hardware_catalog.json');
        if (!fs.existsSync(p)) return null;
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) { return null; }
});

ipcMain.handle('get-ua-catalog', async () => {
    try {
        const p = path.join(app.getAppPath(), 'useragents_catalog.json');
        if (!fs.existsSync(p)) {
            // If the file doesn't exist, return a default catalog including the new Android 14 data
            return [
                {
                    platform: 'windows',
                    platform_versions: ['Windows 11', 'Windows 10'],
                    browsers: {
                        chrome: [
                            { browser_version: '125.0.6422.113', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.113 Safari/537.36' },
                            { browser_version: '124.0.6367.201', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.201 Safari/537.36' }
                        ],
                        firefox: [
                            { browser_version: '126.0', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0' }
                        ]
                    }
                },
                {
                    platform: 'mac',
                    platform_versions: ['macOS 14', 'macOS 13', 'macOS 12'],
                    browsers: {
                        chrome: [
                            { browser_version: '125.0.6422.113', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.113 Safari/537.36' }
                        ],
                        safari: [
                            { browser_version: '17.5', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15' }
                        ]
                    }
                },
                {
                    platform: 'android',
                    platform_versions: ['Android 14', 'Android 13', 'Android 12', 'Android 11'],
                    browsers: {
                        chrome: [
                            { browser_version: '133.0.6943.127', ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 9 Pro Build/AD1A.240530.030) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.127 Mobile Safari/537.36' },
                            { browser_version: '125.0.6422.113', ua: 'Mozilla/5.0 (Linux; Android 12; Pixel 6 Build/SD1A.210817.036) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.113 Mobile Safari/537.36' }
                        ]
                    }
                }
            ];
        }
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) { return null; }
});

ipcMain.handle('get-profiles', () => {
    if (!fs.existsSync(PROFILES_DIR)) return [];
    const files = fs.readdirSync(PROFILES_DIR).filter(f => f.endsWith('.json'));
    const profiles = files.map(f => {
        try {
            const filePath = path.join(PROFILES_DIR, f);
            const stats = fs.statSync(filePath);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            data._mtime = stats.mtimeMs;
            return data;
        } catch (e) {
            return null;
        }
    }).filter(p => p !== null);

    return profiles.sort((a, b) => b._mtime - a._mtime);
});

ipcMain.handle('save-profile', (event, data) => {
    const safeName = data.profileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    // Configurar renderer falso según GPU
    if (data.webgl_gpu) {
        let vendor = "NVIDIA Corporation";
        let renderer = data.webgl_gpu;
        const gpu = data.webgl_gpu.toLowerCase();

        if (gpu.includes('apple')) {
            vendor = "Apple Inc.";
            renderer = data.webgl_gpu;
        } else if (gpu.includes('amd') || gpu.includes('radeon')) {
            vendor = "ATI Technologies Inc.";
            renderer = data.webgl_gpu;
            if (data.browser === 'chrome' && data.platform === 'windows') {
                vendor = "Google Inc. (AMD)";
                renderer = `ANGLE (AMD, ${data.webgl_gpu} Direct3D11 vs_5_0 ps_5_0, D3D11)`;
            }
        } else if (gpu.includes('intel')) {
            vendor = "Intel Inc.";
            renderer = data.webgl_gpu;
            if (data.browser === 'chrome' && data.platform === 'windows') {
                vendor = "Google Inc. (Intel)";
                renderer = `ANGLE (Intel, ${data.webgl_gpu} Direct3D11 vs_5_0 ps_5_0, D3D11)`;
            }
        } else if (gpu.includes('nvidia') || gpu.includes('rtx') || gpu.includes('gtx')) {
            vendor = "NVIDIA Corporation";
            renderer = data.webgl_gpu;
            if (data.browser === 'chrome' && data.platform === 'windows') {
                vendor = "Google Inc. (NVIDIA)";
                renderer = `ANGLE (NVIDIA, ${data.webgl_gpu} Direct3D11 vs_5_0 ps_5_0, D3D11)`;
            }
        } else if (gpu.includes('adreno') || gpu.includes('mali')) {
            vendor = "Qualcomm";
            renderer = data.webgl_gpu;
        }

        data.gpuVendor = vendor;
        data.unmaskedRenderer = renderer;
    } else {
        data.gpuVendor = 'Google Inc. (NVIDIA)';
        data.unmaskedRenderer = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';
    }

    const profilePath = path.join(PROFILES_DIR, safeName + '.json');
    fs.writeFileSync(profilePath, JSON.stringify(data, null, 2));
    return { success: true, profile: data };
});

ipcMain.handle('get-profile', (event, name) => {
    const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const profilePath = path.join(PROFILES_DIR, safeName + '.json');
    if (fs.existsSync(profilePath)) {
        return JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    }
    return null;
});

async function fetchGeoIP(proxyUrl) {
    return new Promise(async (resolve) => {
        try {
            const { BrowserWindow } = require('electron');

            let proxyServer = '';
            let proxyUser = '';
            let proxyPass = '';

            if (proxyUrl && proxyUrl.trim() !== '') {
                proxyServer = proxyUrl.trim();
                if (proxyServer.includes('@')) {
                    const parts = proxyServer.split('@');
                    proxyServer = parts[1];
                    const authParts = parts[0].split(':');
                    proxyUser = authParts[0];
                    proxyPass = authParts.slice(1).join(':');
                } else if (proxyServer.split(':').length === 4) {
                    const parts = proxyServer.split(':');
                    proxyServer = `${parts[2]}:${parts[3]}`;
                    proxyUser = parts[0];
                    proxyPass = parts[1];
                }
            }

            let bw = new BrowserWindow({
                show: false,
                webPreferences: {
                    partition: `proxy-test-${Date.now()}`,
                    nodeIntegration: false,
                    contextIsolation: true
                }
            });

            const ses = bw.webContents.session;

            if (proxyServer) {
                const cleanProxyString = proxyServer.startsWith('http') ? proxyServer : `http://${proxyServer}`;
                await ses.setProxy({ proxyRules: cleanProxyString, proxyBypassRules: '<local>' });
            }

            if (proxyUser && proxyPass) {
                bw.webContents.on('login', (event, details, authInfo, callback) => {
                    if (authInfo.isProxy) {
                        event.preventDefault();
                        callback(proxyUser, proxyPass);
                    }
                });
            }

            const timer = setTimeout(() => {
                if (bw && !bw.isDestroyed()) bw.close();
                resolve({ success: false, error: 'Timeout' });
            }, 10000);

            bw.webContents.on('did-fail-load', (e, errorCode, errorDescription) => {
                clearTimeout(timer);
                if (bw && !bw.isDestroyed()) bw.close();
                resolve({ success: false, error: (errorDescription || 'net::ERR_FAILED') + ` (Code: ${errorCode})` });
            });

            ses.setCertificateVerifyProc((request, callback) => {
                callback(0); // Trust all certificates for the proxy test session
            });

            bw.loadURL('https://get.geojs.io/v1/ip/geo.json').then(async () => {
                clearTimeout(timer);
                try {
                    const text = await bw.webContents.executeJavaScript('document.body.innerText');
                    const parsed = JSON.parse(text);
                    if (bw && !bw.isDestroyed()) bw.close();
                    resolve({ success: true, geo: { latitude: parsed.latitude, longitude: parsed.longitude, timezone: parsed.timezone } });
                } catch (e) {
                    if (bw && !bw.isDestroyed()) bw.close();
                    resolve({ success: true, geo: null });
                }
            }).catch(e => {
                clearTimeout(timer);
                if (bw && !bw.isDestroyed()) bw.close();
                resolve({ success: false, error: e.message });
            });

        } catch (e) {
            resolve({ success: false, error: e.message });
        }
    });
}



ipcMain.handle('delete-profile', (event, name) => {
    const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const profilePath = path.join(PROFILES_DIR, safeName + '.json');
    const userDataPath = path.join(PROFILES_DIR, safeName + '_data');
    if (fs.existsSync(profilePath)) fs.unlinkSync(profilePath);
    if (fs.existsSync(userDataPath)) fs.rmSync(userDataPath, { recursive: true, force: true });
    return true;
});

ipcMain.handle('clear-local-data', (event, name) => {
    const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const userDataPath = path.join(PROFILES_DIR, safeName + '_data');
    if (fs.existsSync(userDataPath)) {
        fs.rmSync(userDataPath, { recursive: true, force: true });
    }
    return true;
});

ipcMain.handle('clear-local-cookies', (event, name) => {
    // TODO: Implement actual Chromium cookie sqlite deletion
    // For now, as a stub, we delete the stub cookies.json file
    const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const cookiesPath = path.join(PROFILES_DIR, safeName + '_cookies.json');
    if (fs.existsSync(cookiesPath)) {
        fs.unlinkSync(cookiesPath);
    }
    return true;
});

ipcMain.handle('get-cookies', (event, name) => {
    // TODO: Implement actual Chromium cookie sqlite reading
    const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const cookiesPath = path.join(PROFILES_DIR, safeName + '_cookies.json');
    if (fs.existsSync(cookiesPath)) {
        return JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    }
    return []; // return empty array if no stub cookies exist
});

ipcMain.handle('save-cookies', (event, data) => {
    // TODO: Implement actual Chromium cookie setting (via Puppeteer or SQLite)
    const { profileName, cookies } = data;
    const safeName = profileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const cookiesPath = path.join(PROFILES_DIR, safeName + '_cookies.json');
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    return { success: true };
});

ipcMain.handle('test-proxy', async (event, payload) => {
    return new Promise((resolve) => {
        try {
            const { BrowserWindow, session } = require('electron');
            let proxyString = typeof payload === 'string' ? payload : payload.proxyString;
            let format = typeof payload === 'object' && payload.format ? payload.format : 'user_pass_ip_port';
            
            let proxyServer = proxyString.trim();
            let proxyUser = '';
            let proxyPass = '';
            let protocol = 'http://'; 

            if (proxyServer.startsWith('socks5://') || proxyServer.startsWith('socks4://')) {
               protocol = proxyServer.substring(0, 9);
               proxyServer = proxyServer.substring(9);
            } else if (proxyServer.startsWith('http://') || proxyServer.startsWith('https://')) {
               protocol = proxyServer.substring(0, 7);
               proxyServer = proxyServer.substring(7);
            }

            if (format === 'user_pass_at_host_port' || proxyServer.includes('@')) {
                const atParts = proxyServer.split('@');
                proxyServer = atParts[atParts.length > 1 ? 1 : 0] || '';
                if(atParts.length > 1) {
                    const authParts = atParts[0].split(':');
                    proxyUser = authParts[0] || '';
                    proxyPass = authParts.slice(1).join(':') || '';
                }
            } else {
                let parts = proxyServer.split(':');
                if (format === 'ip_port') {
                    proxyServer = parts.length >= 2 ? `${parts[0]}:${parts[1]}` : proxyServer;
                } else if (format === 'ip_port_user_pass') {
                    if (parts.length >= 4) {
                        proxyServer = `${parts[0]}:${parts[1]}`;
                        proxyUser = parts[2];
                        proxyPass = parts[3];
                    }
                } else if (format === 'user_pass_ip_port' || format === 'user_pass_host_port') {
                    if (parts.length >= 4) {
                        proxyUser = parts[0];
                        proxyPass = parts[1];
                        proxyServer = `${parts[2]}:${parts[3]}`;
                    }
                }
            }

            const ses = session.fromPartition(`proxy-test-${Date.now()}`);
            ses.setProxy({ proxyRules: protocol + proxyServer, proxyBypassRules: '<local>' });
            
            let timer = null;
            let bw = new BrowserWindow({
                show: false,
                webPreferences: {
                    session: ses,
                    nodeIntegration: false,
                    contextIsolation: true
                }
            });

            if (proxyUser) {
                bw.webContents.on('login', (event, details, authInfo, callback) => {
                    event.preventDefault();
                    callback(proxyUser, proxyPass);
                });
            }

            timer = setTimeout(() => {
                if (bw && !bw.isDestroyed()) bw.close();
                resolve({ success: false, error: 'Timeout testing proxy (10000ms)' });
            }, 10000);

            bw.webContents.on('did-fail-load', (e, errorCode, errorDescription) => {
                clearTimeout(timer);
                if (bw && !bw.isDestroyed()) bw.close();
                resolve({ success: false, error: (errorDescription || 'net::ERR_FAILED') + ` (Code: ${errorCode})` });
            });

            ses.setCertificateVerifyProc((request, callback) => callback(0));

            let timeStart = Date.now();
            bw.loadURL('http://ip-api.com/json').then(async () => {
                clearTimeout(timer);
                try {
                    const rawData = await bw.webContents.executeJavaScript('document.body.innerText');
                    const json = JSON.parse(rawData);
                    if (bw && !bw.isDestroyed()) bw.close();
                    
                    if (json.status === 'success') {
                        resolve({
                            success: true,
                            ping: Date.now() - timeStart,
                            ip: json.query,
                            country: json.countryCode,
                            timezone: json.timezone,
                            city: json.city,
                            lat: json.lat,
                            lon: json.lon
                        });
                    } else {
                        resolve({ success: false, error: 'API Error: ' + json.message });
                    }
                } catch (e) {
                    if (bw && !bw.isDestroyed()) bw.close();
                    resolve({ success: false, error: 'Error parsing IP API response' });
                }
            }).catch(e => {
                clearTimeout(timer);
                if (bw && !bw.isDestroyed()) bw.close();
                resolve({ success: false, error: e.message });
            });
        } catch (e) {
            resolve({ success: false, error: e.message });
        }
    });
});

ipcMain.handle('launch-profile', async (event, profileName) => {
    const safeName = profileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const profilePath = path.join(PROFILES_DIR, safeName + '.json');
    const userDataPath = path.join(PROFILES_DIR, safeName + '_data');
    const isFirstLaunch = !fs.existsSync(userDataPath);

    // Update modified time if needed
    if (fs.existsSync(profilePath)) {
        const stats = fs.statSync(profilePath);
        const data = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
        data.last_launched = new Date().getTime();
        fs.writeFileSync(profilePath, JSON.stringify(data, null, 2));
    }

    if (!fs.existsSync(profilePath)) return { success: false, error: 'Perfil no existe.' };

    const config = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

    if (activeBrowsers[safeName]) {
        return { success: false, error: 'El navegador ya está ejecutándose para este perfil.' };
    }

    try {

        // Calculate Window Size early
        let winW = 1280, winH = 800;
        const isMobileUA = config.userAgent && (config.userAgent.includes('Android') || config.userAgent.includes('iPhone'));
        
        if (config.screen_resolution) {
            const parts = config.screen_resolution.replace(',', 'x').split('x').map(Number);
            if (parts[0] && parts[1]) { winW = parts[0]; winH = parts[1]; }
        } else if (isMobileUA) {
            winW = 412; winH = 915; // Natural Pixel 8 aspect ratio
        }

        // Core Flags
        const args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--test-type', // SUPPRESSES THE "UNSUPPORTED COMMAND-LINE FLAG" INFOBAR
            '--disable-blink-features=AutomationControlled,OffscreenCanvas',
            `--window-size=${winW},${winH}`,
            '--disable-infobars',
            '--no-first-run'
        ];

        // Ensure user-agent is properly passed
        if (config.userAgent && config.userAgent.trim() !== '') {
            let chVersion = '125';
            const match = config.userAgent.match(/Chrome\/(\d+)/);
            if (match) chVersion = match[1];

            const fullMatch = config.userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
            const fullVersionStr = fullMatch ? fullMatch[1] : chVersion + '.0.0.0';

            let platformName = 'Windows';
            if (config.userAgent.includes('Mac OS')) platformName = 'macOS';
            else if (config.userAgent.includes('Android')) platformName = 'Android';
            else if (config.userAgent.includes('iPhone') || config.userAgent.includes('iPad')) platformName = 'iOS';
            else if (config.userAgent.includes('Linux')) platformName = 'Linux';

            let isMobile = config.userAgent.includes('Mobile') || config.userAgent.includes('Android') || config.userAgent.includes('iPhone');

            args.push(`--user-agent=${config.userAgent}`);
            // REMOVED manual --sec-ch-ua launch args because Windows escapes quotes incorrectly, causing Chromium to ignore them.
            
            // --- NEXIUM NATIVE SPOOFING FLAGS ---
            args.push(`--nexium-perfil=${config.profileName || safeName}`);
            args.push(`--nexium-is-mobile=${isMobile ? "true" : "false"}`);
            args.push(`--nexium-ua-full-version=${fullVersionStr}`);
            let nexiumPlatformV = '15.0.0';
            let nexiumModel = '';
            if (platformName === 'Android') {
                const andMatch = config.userAgent.match(/Android\s+([\d.]+)/);
                if (andMatch) nexiumPlatformV = andMatch[1] + '.0.0';
            } else if (platformName === 'Windows') {
                if (config.userAgent.includes('NT 10.0')) nexiumPlatformV = '15.0.0';
                else if (config.userAgent.includes('NT 6.3')) nexiumPlatformV = '8.1.0';
                else if (config.userAgent.includes('NT 6.2')) nexiumPlatformV = '8.0.0';
                else if (config.userAgent.includes('NT 6.1')) nexiumPlatformV = '7.0.0';
                else nexiumPlatformV = '10.0.0';
            } else if (platformName === 'macOS') {
                const macMatch = config.userAgent.match(/Mac OS X\s+([\d_]+)/);
                if (macMatch) nexiumPlatformV = macMatch[1].replace(/_/g, '.') + '.0';
            }
            if (isMobile) {
                const m = config.userAgent.match(/Build\/([^;)]+)/) || config.userAgent.match(/\(([^;]+);/);
                if (m && m[1]) {
                   nexiumModel = m[1].split(' ')[0].split(';').pop().trim();
                } else {
                   nexiumModel = platformName === 'Android' ? 'Pixel 9 Pro' : 'iPhone';
                }
            }
            
            args.push(`--nexium-os-version=${nexiumPlatformV}`);
            if (nexiumModel) {
                args.push(`--nexium-model=${nexiumModel}`);
            }
            if (isMobile) {
                args.push('--touch-events=enabled');
            }
            
            let mappedOs = "Windows";
            let navPlatform = "Win32";
            if (platformName === "macOS") {
                mappedOs = "macOS";
                navPlatform = "MacIntel";
            } else if (platformName === "Android") {
                mappedOs = "Android";
                navPlatform = "Linux aarch64";
            } else if (platformName === "Linux") {
                mappedOs = "Linux";
                navPlatform = "Linux x86_64";
            }
            args.push(`--nexium-os-platform=${mappedOs}`);
            args.push(`--nexium-navigator-platform=${navPlatform}`);
            
            if (config.cores || config.cpu_cores) {
                args.push(`--nexium-cores=${config.cores || config.cpu_cores}`);
            }
            if (config.memory || config.ram_gb) {
                args.push(`--nexium-ram=${config.memory || config.ram_gb}`);
            }
            let renderer = config.unmaskedRenderer || config.webgl_gpu;
            if (renderer) {
                let vendor = "ARM";
                const rLower = renderer.toLowerCase();
                if (rLower.includes('mali')) vendor = "ARM";
                else if (rLower.includes('adreno') || rLower.includes('qualcomm')) vendor = "Qualcomm";
                else if (rLower.includes('nvidia') || rLower.includes('rtx') || rLower.includes('gtx')) vendor = "NVIDIA";
                else if (rLower.includes('amd') || rLower.includes('radeon')) vendor = "AMD";
                else if (rLower.includes('intel')) vendor = "Intel";
                else if (rLower.includes('apple')) vendor = "Apple";
                
                args.push(`--nexium-gpu-vendor=${vendor}`);
                args.push(`--nexium-gpu-renderer=${renderer}`);
            }
        }

        // Locale from Proxy logic or UI
        let tzStr = 'America/New_York';
        let langStr = 'en-US,en'; // Chromium auto-appends ;q=0.9
        if (config.timezone_mode === 'Custom' && config.timezone) tzStr = config.timezone;
        if (config.language_mode === 'Custom' && config.language) {
            langStr = config.language.replace(/;q=[\d.]+/g, '');
        }
        args.push(`--accept-lang=${langStr}`);

        // Disable hardware acceleration if requested
        if (config.hw_accel_mode === 'Disabled') {
            args.push('--disable-gpu');
            args.push('--disable-software-rasterizer');
        }

        // --- Nexium CORE EXTENSION ---
        // Handles WebRTC Masking & Title Injection natively per profile
        const extPath = path.join(userDataPath, 'Nexium_core');
        if (!fs.existsSync(extPath)) fs.mkdirSync(extPath, { recursive: true });

        const manifest = {
            "name": "Nexium Core",
            "version": "1.0",
            "manifest_version": 3,
            "permissions": ["privacy"],
            "background": { "service_worker": "background.js" },
            "content_scripts": [
                {
                    "matches": ["<all_urls>"],
                    "js": ["content.js"],
                    "run_at": "document_start"
                }
            ]
        };
        fs.writeFileSync(path.join(extPath, 'manifest.json'), JSON.stringify(manifest));

        let bgCode = '';
        if (config.webrtc_mode === 'Disabled' || config.webrtc_mode === 'Masked') {
            bgCode = `chrome.privacy.network.webRTCIPHandlingPolicy.set({ value: 'disable_non_proxied_udp' });`;
            args.push('--enforce-webrtc-ip-permission-check');
            args.push('--force-webrtc-ip-handling-policy=disable_non_proxied_udp');
            if (config.webrtc_mode === 'Disabled') {
                args.push('--disable-webrtc');
            }
        }
        fs.writeFileSync(path.join(extPath, 'background.js'), bgCode);

        const safePName = (config.profileName || safeName).replace(/["']/g, '');
        const contentCode = `
            const pName = "[ ${safePName} ]";
            function updateTitle() {
                if (document.title && !document.title.startsWith(pName)) {
                    document.title = pName + " - " + document.title;
                } else if (!document.title) {
                    document.title = pName;
                }
            }
            updateTitle();
            const observer = new MutationObserver(updateTitle);
            document.addEventListener('DOMContentLoaded', () => {
                const titleEl = document.querySelector('title');
                if (titleEl) {
                    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
                } else {
                    observer.observe(document.head || document.documentElement, { childList: true, subtree: true });
                }
                updateTitle();
            });
        `;
        fs.writeFileSync(path.join(extPath, 'content.js'), contentCode);

        args.push(`--disable-extensions-except=${extPath}`);
        args.push(`--load-extension=${extPath}`);
        // --------------------------------

        // Disable Images
        if (config.disable_images) {
            args.push('--blink-settings=imagesEnabled=false');
        }

        // Proxy
        let proxyUser = '';
        let proxyPass = '';
        if (config.proxy && config.proxy.trim() !== '') {
            let proxyServer = config.proxy.trim();
            if (proxyServer.includes('@')) {
                const parts = proxyServer.split('@');
                proxyServer = parts[1];
                const authParts = parts[0].split(':');
                proxyUser = authParts[0];
                proxyPass = authParts.slice(1).join(':');
            } else if (proxyServer.split(':').length === 4) {
                const parts = proxyServer.split(':');
                proxyServer = `${parts[2]}:${parts[3]}`;
                proxyUser = parts[0];
                proxyPass = parts[1];
            }
            if (!proxyServer.startsWith('http') && !proxyServer.startsWith('socks')) {
                proxyServer = `http://${proxyServer}`; // Default to HTTP Proxy if no scheme is provided
            }
            args.push(`--proxy-server=${proxyServer}`);
            
            // --- STRICT PROXY ENFORCEMENT ---
            // Evitar que nada escape del proxy (excepto red local/localhost)
            args.push('--proxy-bypass-list=<-loopback>');
            // Deshabilitar QUIC (usa UDP) ya que causa fugas frecuentes si el proxy solo es TCP
            args.push('--disable-quic');
            // --------------------------------
        }

        // Custom Launch Args
        if (config.launch_args && config.launch_args.trim() !== '') {
            const customArgs = config.launch_args.split(/\s+/).filter(a => a.startsWith('--'));
            args.push(...customArgs);
        }

        if (config.save_tabs !== false) {
            args.push('--restore-last-session');
        }

        // --- HARDEN WEBRTC PREFERENCES directly to Disk ---
        // Overrides any command line failures by directly mutating Chromium's state
        const defaultDirPath = path.join(userDataPath, 'Default');
        if (!fs.existsSync(defaultDirPath)) fs.mkdirSync(defaultDirPath, { recursive: true });

        const prefsPath = path.join(defaultDirPath, 'Preferences');
        let currentPrefs = {};
        if (fs.existsSync(prefsPath)) {
            try { currentPrefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8')); } catch (e) { }
        }

        if (!currentPrefs.webrtc) currentPrefs.webrtc = {};

        if (config.webrtc_mode === 'Masked' || (config.proxy && config.proxy.trim() !== '')) {
            // STRICT LEAK PREVENTION: If using a proxy, NEVER allow raw UDP leaks via WebRTC
            currentPrefs.webrtc.ip_handling_policy = 'disable_non_proxied_udp';
            currentPrefs.webrtc.multiple_routes_enabled = false;
            currentPrefs.webrtc.nonproxied_udp_enabled = false;
        } else if (config.webrtc_mode === 'Disabled') {
            currentPrefs.webrtc.ip_handling_policy = 'disable_non_proxied_udp'; // Fallback
        }

        // Disable HTTPS-only mode warnings persistently
        if (!currentPrefs.profile) currentPrefs.profile = {};
        currentPrefs.profile.name = config.profileName || safeName;
        currentPrefs.profile.https_only_mode_enabled = false;
        currentPrefs.profile.exit_type = "Normal";
        currentPrefs.profile.exited_cleanly = true;
        currentPrefs.https_only_mode_enabled = false;

        // --- UNIQUE BROWSER THEME COLOR ---
        if (config.profileColor && config.profileColor.startsWith('#')) {
            if (!currentPrefs.browser) currentPrefs.browser = {};
            if (!currentPrefs.browser.theme) currentPrefs.browser.theme = {};
            currentPrefs.browser.theme.color_variant = 1; 
            let c = config.profileColor.replace('#', '');
            if (c.length === 3) c = c.split('').map(x => x + x).join('');
            currentPrefs.browser.theme.user_color = (parseInt('ff' + c, 16) << 0) >> 0;
        }

        // --- TAB/SESSION RETENTION ---
        if (!currentPrefs.session) currentPrefs.session = {};
        if (config.save_tabs !== false) {
            currentPrefs.session.restore_on_startup = 1;
        } else {
            delete currentPrefs.session.restore_on_startup;
        }
        // -----------------------------

        fs.writeFileSync(prefsPath, JSON.stringify(currentPrefs));
        // --------------------------------------------------

        // --- TRICK TO FORCE PROFILE NAME BADGE VISIBILITY ---
        try {
            const localStatePath = path.join(userDataPath, 'Local State');
            let localState = {};
            if (fs.existsSync(localStatePath)) {
                try { localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8')); } catch(e){}
            }
            if (!localState.profile) localState.profile = {};
            if (!localState.profile.info_cache) localState.profile.info_cache = {};
            
            localState.profile.info_cache['Default'] = {
                ...(localState.profile.info_cache['Default'] || {}),
                name: config.profileName || safeName,
                is_using_default_name: false,
                is_using_default_avatar: false,
                avatar_icon: "chrome://theme/IDR_PROFILE_AVATAR_26"
            };
            
            // Adding a second mock profile forces the UI to render the profile name explicitly
            localState.profile.info_cache['Profile 2'] = {
                name: "...",
                is_ephemeral: true,
                is_using_default_name: true
            };
            
            fs.writeFileSync(localStatePath, JSON.stringify(localState));
        } catch(e) { console.error("Could not set Local State", e); }
        // --------------------------------------------------

        // ---- PRE-LAUNCH GEO PRE-FETCH FOR PERFECT TIMEZONE INJECTION ----
        let eTzStr = 'America/New_York';
        let geoLat = 40.7128;
        let geoLon = -74.0060;

        if (config.proxy && config.proxy.trim() !== '') {
            const geoRes = await fetchGeoIP(config.proxy);
            if (!geoRes || !geoRes.success) {
                return {
                    success: false,
                    error: `Prueba de Proxy fallida: Verifica tu conexión o que el proxy esté activo antes de iniciar. Detalle: ${geoRes?.error || 'Desconocido'}`
                };
            }
            if (geoRes.geo) {
                if (geoRes.geo.timezone && config.timezone_mode !== 'Custom') eTzStr = geoRes.geo.timezone;
                if (geoRes.geo.latitude && config.geo_mode !== 'Custom') {
                    geoLat = parseFloat(geoRes.geo.latitude);
                    geoLon = parseFloat(geoRes.geo.longitude);
                }
            }
        } else if (config.timezone_mode !== 'Custom' || config.geo_mode !== 'Custom') {
            const geoRes = await fetchGeoIP('');
            if (geoRes && geoRes.success && geoRes.geo) {
                if (geoRes.geo.timezone && config.timezone_mode !== 'Custom') eTzStr = geoRes.geo.timezone;
                if (geoRes.geo.latitude && config.geo_mode !== 'Custom') {
                    geoLat = parseFloat(geoRes.geo.latitude);
                    geoLon = parseFloat(geoRes.geo.longitude);
                }
            }
        }

        if (config.timezone_mode === 'Custom' && config.timezone) eTzStr = config.timezone;
        if (config.geo_mode === 'Custom') {
            if (config.geo_latitude !== undefined && config.geo_latitude !== '') geoLat = parseFloat(config.geo_latitude);
            if (config.geo_longitude !== undefined && config.geo_longitude !== '') geoLon = parseFloat(config.geo_longitude);
        }

        config._fetchedGeoLat = geoLat;
        config._fetchedGeoLon = geoLon;
        config.isMobileUA = isMobileUA;

        // Viewport & Window Size consolidation (using values calculated at the start)
        if (config.screen_resolution) {
            const parts = config.screen_resolution.replace(',', 'x').split('x').map(Number);
            if (parts[0] && parts[1]) { winW = parts[0]; winH = parts[1]; }
        } else if (isMobileUA) {
            winW = 412; winH = 915; // Natural Pixel 8 aspect ratio
        }

        // Clamp physical window size to monitor work area to prevent off-screen spawning
        let physicalWinW = winW;
        let physicalWinH = winH;
        try {
            const { screen } = electron;
            const primaryDisplay = screen.getPrimaryDisplay();
            const { width, height } = primaryDisplay.workAreaSize;
            if (physicalWinW > width) physicalWinW = width;
            if (physicalWinH > height) physicalWinH = height;
        } catch(e) { console.error("Monitor bounds read failed", e); }

        // Advanced Native Taskbar Icon Generator via Dedicated Executables
        let targetExePath = globalExecutablePath;
        try {
            let initials = "N";
            if (profileName) {
                const words = profileName.trim().split(/\s+/);
                if (words.length >= 2) initials = (words[0][0] + "" + words[1][0]).toUpperCase();
                else if (profileName.length >= 2) initials = profileName.substring(0, 2).toUpperCase();
                else initials = profileName.substring(0, 1).toUpperCase() + " ";
            }
            const safeInitials = initials.replace(/[^A-Za-z0-9]/g, '');

            const browserEngDir = path.dirname(globalExecutablePath);
            const baseExeName = path.basename(globalExecutablePath);
            if (baseExeName.toLowerCase() === 'chrome.exe' && safeInitials.length > 0) {
                // Clear out stale custom executables for this profile to free up space
                try {
                    const files = fs.readdirSync(browserEngDir);
                    for (const f of files) {
                        if (f.startsWith(`chrome_${safeInitials}_`) && f.endsWith('.exe')) {
                            try { fs.unlinkSync(path.join(browserEngDir, f)); } catch(e){}
                        }
                        if (f.startsWith(`icon_${safeInitials}_`) && f.endsWith('.ico')) {
                            try { fs.unlinkSync(path.join(browserEngDir, f)); } catch(e){}
                        }
                    }
                } catch(e){}

                // Create a completely unique string to bypass Windows Taskbar Icon Caching and EBUSY file locks
                const uniqueId = Date.now().toString();
                const customExeName = `chrome_${safeInitials}_${uniqueId}.exe`;
                targetExePath = path.join(browserEngDir, customExeName);
                
                try {
                    fs.copyFileSync(globalExecutablePath, targetExePath);
                } catch(e) {}
                
                const iconTool = path.join(__dirname, 'GenerateIcon.exe');
                const outIco = path.join(browserEngDir, `icon_squircle_${uniqueId}.ico`);
                
                if (fs.existsSync(iconTool)) {
                    try { require('child_process').execFileSync(iconTool, [outIco, safeInitials]); } catch(e){}

                    try {
                        const resedit = require('resedit');
                        const dataExe = fs.readFileSync(targetExePath);
                        const exe = resedit.NtExecutable.from(dataExe);
                        const res = resedit.NtExecutableResource.from(exe);
                        const iconFile = resedit.Data.IconFile.from(fs.readFileSync(outIco));
                        
                        const iconDataList = iconFile.icons.map(i => i.data);
                        ['IDR_MAINFRAME', 'IDR_X001_APP_LIST', 'IDR_X003_INCOGNITO', 1].forEach(id => {
                            try {
                                resedit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, id, 1033, iconDataList);
                            } catch(e) {}
                        });
                        
                        res.outputResource(exe);
                        fs.writeFileSync(targetExePath, Buffer.from(exe.generate()));
                    } catch(err) {
                        console.error('Resedit patch failed:', err);
                        fs.writeFileSync('C:/Users/blood/Desktop/Gestor de credito/icon_error.txt', err.stack || err.toString());
                    }
                }
            }
        } catch(e) {
            console.error("Icon Injection failed, tracking fallback:", e);
            targetExePath = globalExecutablePath;
        }

        const browser = await puppeteer.launch({
            executablePath: targetExePath,
            headless: false,
            ignoreHTTPSErrors: true,
            protocolTimeout: 0,
            userDataDir: userDataPath,
            args: [
                ...args,
                `--window-size=${physicalWinW},${physicalWinH}`
            ],
            defaultViewport: null,
            ignoreDefaultArgs: ['--enable-automation', '--disable-setuid-sandbox', '--no-sandbox'],
            env: {
                ...process.env,
                TZ: eTzStr
            }
        });

        activeBrowsers[safeName] = browser;

        browser.on('disconnected', () => {
            delete activeBrowsers[safeName];
            if (!event.sender.isDestroyed()) {
                event.sender.send('profile-stopped', profileName);
            }
        });

        const pages = await browser.pages();
        const page = pages[0];

        let isFirefox = false;
        let isSafari = false;
        let isChromium = false;
        let isMobile = false;
        let platformName = 'Windows';

        let uaMetadataPayload = null;
        if (config.userAgent && config.userAgent.trim() !== '') {
            const ua = config.userAgent;
            isFirefox = ua.includes('Firefox');
            isSafari = ua.includes('Safari') && !ua.includes('Chrome');
            isChromium = (ua.includes('Chrome') || ua.includes('Chromium')) && !isFirefox;
            isMobile = ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone') || ua.includes('iPad');

            // Detect Platform for Client Hints
            if (ua.includes('Windows')) platformName = 'Windows';
            else if (ua.includes('Android')) platformName = 'Android';
            else if (ua.includes('Mac OS') || ua.includes('Macintosh')) platformName = 'macOS';
            else if (ua.includes('iPhone') || ua.includes('iPad')) platformName = 'iOS';
            else if (ua.includes('Linux')) platformName = 'Linux';
            
            // Version for Chromium
            let chVersion = '125';
            let fullVersion = '125.0.0.0';
            const vMatch = ua.match(/Chrome\/(\d+)\.(\d+\.\d+\.\d+)/);
            if (vMatch) {
                chVersion = vMatch[1];
                fullVersion = vMatch[1] + '.' + vMatch[2];
            }

            let navPlatformStr = 'Win32';
            if (platformName === 'Android') navPlatformStr = 'Linux armv8l';
            else if (platformName === 'macOS') navPlatformStr = 'MacIntel';
            else if (platformName === 'iOS') navPlatformStr = 'iPhone';
            else if (platformName === 'Linux') navPlatformStr = 'Linux x86_64';

            uaMetadataPayload = {
                userAgent: ua,
                acceptLanguage: 'en-US,en',
                platform: navPlatformStr
            };

            // Client Hints (ONLY for Chromium)
            if (isChromium) {
                // Dynamic mapping for consistency
                let platformVersion = '10.0';
                let architecture = 'x86';
                let bitness = '64';

                if (platformName === 'Android') {
                    const andMatch = ua.match(/Android\s+([\d.]+)/);
                    if (andMatch) platformVersion = andMatch[1] + '.0.0'; // CH format
                    architecture = 'arm'; 
                    bitness = '64';
                } else if (platformName === 'Windows') {
                    if (ua.includes('NT 10.0')) platformVersion = '15.0.0'; // Win 11/10
                    else if (ua.includes('NT 6.3')) platformVersion = '8.1.0';
                    else if (ua.includes('NT 6.2')) platformVersion = '8.0.0';
                    else if (ua.includes('NT 6.1')) platformVersion = '7.0.0';
                    else platformVersion = '10.0.0';
                    architecture = 'x86';
                    bitness = '64';
                } else if (platformName === 'macOS') {
                    const macMatch = ua.match(/Mac OS X\s+([\d_]+)/);
                    if (macMatch) platformVersion = macMatch[1].replace(/_/g, '.') + '.0';
                    architecture = ua.includes('arm64') ? 'arm' : 'x86';
                }

                uaMetadataPayload.userAgentMetadata = {
                    brands: [
                        { brand: 'Chromium', version: chVersion },
                        { brand: 'Not.A/Brand', version: '24' },
                        { brand: 'Google Chrome', version: chVersion }
                    ],
                    fullVersionList: [
                        { brand: 'Chromium', version: fullVersion },
                        { brand: 'Not.A/Brand', version: '24.0.0.0' },
                        { brand: 'Google Chrome', version: fullVersion }
                    ],
                    fullVersion: fullVersion,
                    platform: platformName,
                    platformVersion: platformVersion,
                    architecture: architecture,
                    model: (() => {
                        if (!isMobile) return '';
                        const m = ua.match(/Build\/([^;)]+)/) || ua.match(/\(([^;]+);/);
                        if (m && m[1]) {
                           return m[1].split(' ')[0].split(';').pop().trim();
                        }
                        return platformName === 'Android' ? 'Pixel 9 Pro' : 'iPhone';
                    })(),
                    mobile: isMobile,
                    bitness: bitness
                };

                // Propagate isMobileUA to the config object for the injected script
                config.isMobileUA = isMobile;
            }
        }

        // Attach for JS Injection
        config.uaMetadataPayload = uaMetadataPayload;

        const setupPage = async (p) => {
            if (proxyUser && proxyPass) {
                await p.authenticate({ username: proxyUser, password: proxyPass }).catch(() => { });
            }

            // CLEAR DEFAULTS (DNT is disabled by default to avoid bot flags)
            await p.setExtraHTTPHeaders({}).catch(() => { });

            // Geo & Timezone Sync
            await p.emulateTimezone(eTzStr).catch(() => { });
            await p.setGeolocation({ latitude: geoLat, longitude: geoLon }).catch(() => { });
            
            // Override Permissions NATIVELY (Invisible to Intoli/Akamai)
            const context = browser.defaultBrowserContext();
            await context.overridePermissions('https://www.ups.com', ['geolocation']).catch(() => { });
            await context.overridePermissions('https://wwwapps.ups.com', ['geolocation']).catch(() => { });
            await context.overridePermissions('https://intoli.com', ['geolocation']).catch(() => { });

            // Network Identity and Headers (Native CDP handles this better than interception)
            // No request interception here to avoid bot detection flags

            // --- FINGERPRINT STABILITY & CDP EVASION (Browser-side) ---
            if (config.geo_prompt_mode === 'Allow') {
                try {
                    const context = browser.defaultBrowserContext();
                    const uObj = new URL(config.startupUrl || 'https://bot.sannysoft.com/');
                    await context.overridePermissions(uObj.origin, ['geolocation']);
                } catch (e) { }
            }

            // --- INJECT WEBGL VENDOR/RENDERER ---
            // Removed JS-based WebGL injection. Handled natively via C++ engine flags (--nexium-gpu-renderer)

            // --- INJECT BROWSER SPOOFS ---
            await p.evaluateOnNewDocument((isMobile) => {
                try {
                    if (isMobile) {
                        if (!('ontouchstart' in window)) { window.ontouchstart = null; }
                        if (!('TouchEvent' in window)) { window.TouchEvent = function TouchEvent() {}; }
                        
                        // Mask Windows Fonts exclusively for Android to prevent "Windows 11 apps" leak
                        try {
                            const origFont = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
                            if (origFont && origFont.set) {
                                Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', {
                                    set: function(val) {
                                        if (typeof val === 'string' && (val.includes('Segoe') || val.includes('Bahnschrift') || val.includes('Cambria') || val.includes('Lucida'))) {
                                            val = '12px Roboto, sans-serif'; 
                                        }
                                        return origFont.set.call(this, val);
                                    },
                                    get: origFont.get
                                });
                            }
                        } catch(e){}
                    }
                } catch(err) {}
            }, isMobileUA).catch(() => {});
            // Viewport removed (natively handled by --window-size launch flag to allow Taskbar detection)
            // CDP Overrides removed: Handled natively by Nexus C++ Engine

            // Network Client Hints Spoofing (Sec-CH-UA) and AppVersion syncing
            // Handled natively by Nexus C++ Engine. No CDP Emulation used!

            // Trusted Heartbeat removed as requested (User is interacting manually)

        };

        // Apply setup to initial page
        await setupPage(page);

        // Apply setup dynamically to all future tabs, popups, and windows, AND Service Workers
        browser.on('targetcreated', async target => {
            const type = target.type();
            if (['worker', 'service_worker', 'shared_worker'].includes(type) || type.includes('worker')) {
                try {
                    const client = await target.createCDPSession();
                    if (eTzStr) await client.send('Emulation.setTimezoneOverride', { timezoneId: eTzStr }).catch(() => {});
                } catch (e) { }
            }
            if (type === 'page' || type === 'webview') {
                try {
                    const newPage = await target.page();
                    if (newPage) {
                        try {
                            const client = await target.createCDPSession();
                            if (eTzStr) await client.send('Emulation.setTimezoneOverride', { timezoneId: eTzStr }).catch(() => {});
                        } catch(e) {}
                        await setupPage(newPage);
                    }
                } catch (e) { }
            }
        });

        // Loop existing targets to catch any early service workers
        for (const target of browser.targets()) {
            const type = target.type();
            if (['worker', 'service_worker', 'shared_worker'].includes(type) || type.includes('worker')) {
                try {
                    const client = await target.createCDPSession();
                    if (eTzStr) await client.send('Emulation.setTimezoneOverride', { timezoneId: eTzStr }).catch(() => {});
                } catch (e) { }
            }
        }

        if (config.save_tabs === false) {
            await page.goto(config.startupUrl || 'https://bot.sannysoft.com/', { waitUntil: 'domcontentloaded' }).catch(e => console.log('Init failed:', e.message));
        } else if (isFirstLaunch) {
            await page.goto(config.startupUrl || 'https://bot.sannysoft.com/', { waitUntil: 'domcontentloaded' }).catch(e => console.log('Init failed:', e.message));
        } else {
            // Es un perfil existente y no tiene desactivado explicitamente guardar pestañas.
            // Chromium restaurará automáticamente. NO inyectamos bot.sannysoft.com.
            await new Promise(r => setTimeout(r, 1000));
        }

        return { success: true };
    } catch (error) {
        console.error("Browser launch error: ", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('stop-profile', async (event, profileName) => {
    const safeName = profileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    if (activeBrowsers[safeName]) {
        try {
            await activeBrowsers[safeName].close();
        } catch (e) { }
        delete activeBrowsers[safeName];
    }
    return { success: true };
});
