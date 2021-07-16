const {app, BrowserWindow, shell} = require('electron')
const URL = require('url').URL
const path = require('path')

function createWindow () {
	const mainWindow = new BrowserWindow({
		contextIsolation: true,
		nodeIntegration: false,
		preload: path.join(__dirname, 'preload.js')
	})
	
	mainWindow.loadURL('https://app.revolt.chat')
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
		
		if (parsedUrl.origin !== 'https://app.revolt.chat') {
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
