import type { ConfigData } from './app';

import { app, BrowserWindow, shell, ipcMain } from 'electron';
import Store from 'electron-store';
import { URL } from 'url';
import path from 'path';

const store = new Store<{ config: ConfigData }>();

function getURL() {
	const build: 'stable' | 'nightly' | 'dev' | undefined = store.get('config.build');

	switch (build) {
		case 'dev': return 'http://local.revolt.chat:3001';
		case 'nightly': return 'https://nightly.revolt.chat';
		default: return 'https://app.revolt.chat';
	}
}

function createWindow() {
	const initialConfig = store.get('config');
	const mainWindow = new BrowserWindow({
		autoHideMenuBar: true,
		title: 'Revolt',
		icon: 'logo.png',

		frame: initialConfig.frame,

		webPreferences: {
			preload: path.resolve(app.getAppPath(), 'bundle', 'app.js'),
			contextIsolation: true,
			nodeIntegration: false,
		},
	})
	
	mainWindow.webContents.openDevTools()
	mainWindow.loadURL(getURL())

	mainWindow.webContents.on('did-finish-load', () =>
		mainWindow.webContents.send('configLoad', initialConfig)
	)

	ipcMain.on('configSet', (_, arg: Partial<ConfigData>) => {
		store.set('config', {
			...store.get('config'),
			...arg
		});
	})

	ipcMain.on('reload', () => mainWindow.loadURL(getURL()))
	ipcMain.on('close', () => mainWindow.close())
}

app.whenReady().then(() => {
	createWindow()
	
	app.on('activate', function () {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

app.on('window-all-closed', function () {
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
