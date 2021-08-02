import type { ConfigData } from './app';

import { app, BrowserWindow, shell, ipcMain, nativeImage } from 'electron';
import windowStateKeeper from 'electron-window-state';
import { RelaunchOptions } from 'electron/main';
import AutoLaunch from 'auto-launch';
import Store from 'electron-store';
import { URL } from 'url';
import path from 'path';

const WindowIcon = nativeImage.createFromPath(path.join(__dirname, "icon.png"));
WindowIcon.setTemplateImage(true);

const store = new Store<{ config: Partial<ConfigData> }>();
const autoLaunch = new AutoLaunch({
    name: 'Revolt',
});

async function firstRun() {
	if (store.get('firstrun', false)) return;

	// Enable auto start by default on Windows / Mac OS.
	if (process.platform === 'win32' || process.platform === 'darwin') {
		const enabled = await autoLaunch.isEnabled();
		if (!enabled) {
			await autoLaunch.enable();
		}
	}

	// Use custom window frame on Windows.
	if (process.platform === 'win32') {
		store.set('config.frame', false);
	}

	store.set('firstrun', true);
}

function getURL() {
	const build: 'stable' | 'nightly' | 'dev' | undefined = store.get('config.build');

	switch (build) {
		case 'dev': return 'http://local.revolt.chat:3001';
		case 'nightly': return 'https://nightly.revolt.chat';
		default: return 'https://app.revolt.chat';
	}
}

var relaunch: boolean | undefined;
function createWindow() {
	const initialConfig = store.get('config', {});
	const mainWindowState = windowStateKeeper({
		defaultWidth: 1280,
		defaultHeight: 720
	});

	const mainWindow = new BrowserWindow({
		autoHideMenuBar: true,
		title: 'Revolt',
		icon: WindowIcon,

		frame: initialConfig.frame,

		webPreferences: {
			preload: path.resolve(app.getAppPath(), 'bundle', 'app.js'),
			contextIsolation: true,
			nodeIntegration: false,
		},

		x: mainWindowState.x,
		y: mainWindowState.y,
		width: mainWindowState.width,
		height: mainWindowState.height,

		minWidth: 480,
		minHeight: 300
	})
	
	mainWindowState.manage(mainWindow)
	mainWindow.loadURL(getURL())

	mainWindow.webContents.on('did-finish-load', () =>
		mainWindow.webContents.send('config', store.get('config'))
	)

	ipcMain.on('getAutoStart', () =>
		autoLaunch.isEnabled()
			.then(v => mainWindow.webContents.send('autoStart', v))
	)

	ipcMain.on('setAutoStart', async (_, value: boolean) => {
		if (value) {
			await autoLaunch.enable();
			mainWindow.webContents.send('autoStart', true);
		} else {
			await autoLaunch.disable();
			mainWindow.webContents.send('autoStart', false);
		}
	})

	ipcMain.on('set', (_, arg: Partial<ConfigData>) =>
		store.set('config', {
			...store.get('config'),
			...arg
		})
	)

	ipcMain.on('reload', () => mainWindow.loadURL(getURL()))
	ipcMain.on('relaunch', () => {
		relaunch = true;
		mainWindow.close();
	})

	ipcMain.on('min', () => mainWindow.minimize())
	ipcMain.on('max', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize())
	ipcMain.on('close', () => mainWindow.close())
}

app.whenReady().then(async () => {
	await firstRun();
	createWindow();
	
	app.on('activate', function () {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

app.on('window-all-closed', function () {
	if (relaunch) {
		const options: RelaunchOptions = {
			args: process.argv.slice(1).concat(['--relaunch']),
			execPath: process.execPath
		};

		if (app.isPackaged && process.env.APPIMAGE) {
			options.execPath = process.env.APPIMAGE;
    		options.args!.unshift('--appimage-extract-and-run');
		}
		
		app.relaunch(options);
		app.quit();

		return;
	}

	if (process.platform !== 'darwin') app.quit()
})

app.on('web-contents-created', (_, contents) => {
	contents.on('will-navigate', (event, navigationUrl) => {
		const parsedUrl = new URL(navigationUrl)
		
		if (parsedUrl.origin !== getURL()) {
			event.preventDefault()
		}
	})

	contents.setWindowOpenHandler(({ url }) => {
		if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:')) {
			setImmediate(() => {
				shell.openExternal(url)
			})
		}
		
		return { action: 'deny' }
	})
})
