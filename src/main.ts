import type { ConfigData } from "./app";

import {
    app as App,
    BrowserWindow,
    shell,
    ipcMain,
    nativeImage,
    Tray,
    Menu,
    MenuItem,
} from "electron";
import { execFile } from "node:child_process";
import windowStateKeeper from "electron-window-state";
import { RelaunchOptions } from "electron/main";
import { URL } from "node:url";
import path from "node:path";

import { firstRun, getConfig, store, onStart, getBuildURL } from "./lib/config";
import { connectRPC, dropRPC } from "./lib/discordRPC";
import { autoLaunch } from "./lib/autoLaunch";
import { autoUpdate } from "./lib/updater";

let forceQuit = false;

const trayIcon = nativeImage.createFromPath(
    path.resolve(
        App.getAppPath(),
        "assets",
        // MacOS has special size and naming requirements for tray icons
        // https://stackoverflow.com/questions/41664208/electron-tray-icon-change-depending-on-dark-theme/41998326#41998326
        process.platform === "darwin" ? "trayIconTemplate.png" : "trayIcon.png",
    ),
);

const WindowIcon = nativeImage.createFromPath(
    path.resolve(App.getAppPath(), "assets", "icon.png"),
);

trayIcon.setTemplateImage(true);
WindowIcon.setTemplateImage(true);

onStart();
autoUpdate();

type AppInterface = typeof App & {
    shouldRelaunch: boolean;
    shouldQuit: boolean;
};

let mainWindow: BrowserWindow;
let app = App as AppInterface;

/**
 * Create the main window.
 */
function createWindow() {
    const initialConfig = getConfig();
    const mainWindowState = windowStateKeeper({
        defaultWidth: 1280,
        defaultHeight: 720,
    });
    mainWindow = new BrowserWindow({
        autoHideMenuBar: true,
        title: "Revolt",
        icon: WindowIcon,

        frame: initialConfig.frame,

        webPreferences: {
            preload: path.resolve(App.getAppPath(), "bundle", "app.js"),
            contextIsolation: true,
            nodeIntegration: false,
	    //spellcheck needs to be set to true to initilze values
	    //if set to false toggle won't work properly
	    spellcheck: true,
        },

        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,

        backgroundColor: "#191919",

        minWidth: 300,
        minHeight: 300,
    });
    //sets value to whatever the previous state was defualt is same as webPref
    mainWindow.webContents.session.setSpellCheckerEnabled(store.get("spellcheck",true));

    if (process.platform === "win32") {
        App.setAppUserModelId(mainWindow.title);
    }

    mainWindowState.manage(mainWindow);
    if (app.commandLine.hasSwitch('server')) {
        mainWindow.loadURL(app.commandLine.getSwitchValue('server'));
    }
    else {
        mainWindow.loadURL(getBuildURL());
    }

    /**
     * Window events
     */
    mainWindow.on("show", () => buildMenu());
    mainWindow.on("hide", () => buildMenu());

    mainWindow.on("close", (event) => {
        if (
            !forceQuit &&
            !app.shouldQuit &&
            !app.shouldRelaunch &&
            getConfig().minimiseToTray
        ) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.webContents.on("before-input-event", (event, input) => {
        if (input.control && input.key === "=") {
            event.preventDefault();
            mainWindow.webContents.setZoomLevel(
                mainWindow.webContents.getZoomLevel() + 1,
            );
        } else if (input.control && input.key === "-") {
            event.preventDefault();
            mainWindow.webContents.setZoomLevel(
                mainWindow.webContents.getZoomLevel() - 1,
            );
        }
    });

    mainWindow.webContents.on("did-finish-load", () =>
        mainWindow.webContents.send("config", getConfig()),
    );

    mainWindow.webContents.on("context-menu", (_, params) => {
        const menu = new Menu();

        // Add each spelling suggestion
        for (const suggestion of params.dictionarySuggestions) {
            menu.append(
                new MenuItem({
                    label: suggestion,
                    click: () =>
                        mainWindow.webContents.replaceMisspelling(suggestion),
                }),
            );
        }

        // Allow users to add the misspelled word to the dictionary
        if (params.misspelledWord) {
            menu.append(
                new MenuItem({
                    label: "Add to dictionary",
                    click: () =>
                        mainWindow.webContents.session.addWordToSpellCheckerDictionary(
                            params.misspelledWord,
                        ),
                }),
            );
        }
	menu.append(
		new MenuItem({
			label: "Toggle spellcheck",
			click: ()=>{
				//to improve readability, stores current state of spell check
	 			let isSpellcheck = store.get("spellcheck",true);
				mainWindow.webContents.session.setSpellCheckerEnabled(!isSpellcheck);
				//stores spellcheck state locally to presist between session
				store.set("spellcheck",!isSpellcheck);
			},
		}),
	);
        if (menu.items.length > 0) {
            menu.popup();
        }
    });

    /**
     * Inter-process communication
     */
    ipcMain.on("getAutoStart", () =>
        autoLaunch
            .isEnabled()
            .then((v) => mainWindow.webContents.send("autoStart", v)),
    );

    ipcMain.on("setAutoStart", async (_, value: boolean) => {
        if (value) {
            await autoLaunch.enable();
            mainWindow.webContents.send("autoStart", true);
        } else {
            await autoLaunch.disable();
            mainWindow.webContents.send("autoStart", false);
        }
    });

    ipcMain.on("set", (_, arg: Partial<ConfigData>) => {
        if (typeof arg.discordRPC !== "undefined") {
            if (arg.discordRPC) {
                connectRPC();
            } else {
                dropRPC();
            }
        }

        store.set("config", {
            ...store.get("config"),
            ...arg,
        });
    });

    ipcMain.on("reload", () => mainWindow.loadURL(getBuildURL()));
    ipcMain.on("relaunch", () => {
        app.shouldRelaunch = true;
        mainWindow.close();
    });

    ipcMain.on("min", () => mainWindow.minimize());
    ipcMain.on("max", () =>
        mainWindow.isMaximized()
            ? mainWindow.unmaximize()
            : mainWindow.maximize(),
    );

    ipcMain.on("close", () => mainWindow.close());

    /**
     * System tray
     */
    const tray = new Tray(trayIcon);

    function buildMenu() {
        tray.setContextMenu(
            Menu.buildFromTemplate([
                { label: "Revolt", type: "normal", enabled: false },
                { label: "---", type: "separator" },
                {
                    label: mainWindow.isVisible()
                        ? "Hide Revolt"
                        : "Show Revolt",
                    type: "normal",
                    click: function () {
                        if (mainWindow.isVisible()) {
                            mainWindow.hide();
                        } else {
                            mainWindow.show();
                        }
                    },
                },
                {
                    label: "Restart Revolt",
                    type: "normal",
                    click: function () {
                        app.shouldRelaunch = true;
                        mainWindow.close();
                    },
                },
                {
                    label: "Quit Revolt",
                    type: "normal",
                    click: function () {
                        app.shouldQuit = true;
                        app.quit();
                    },
                },
            ]),
        );
    }

    buildMenu();
    tray.setToolTip("Revolt");
    tray.setImage(trayIcon);
}

/**
 * Only launch the application once.
 */
const acquiredLock = App.requestSingleInstanceLock();

if (!acquiredLock) {
    App.quit();
} else {
    App.on("second-instance", () => {
        if (mainWindow) {
            // Restore from tray if hidden
            if (!mainWindow.isVisible()) mainWindow.show();

            // Restore from taskbar if minimised
            if (mainWindow.isMinimized()) mainWindow.restore();

            // Then focus the window
            mainWindow.focus();
        }
    });

    App.whenReady().then(async () => {
        await firstRun();
        createWindow();

        App.on("activate", function () {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            } else {
                if (!mainWindow.isVisible()) return mainWindow.show();
                else return mainWindow.focus();
            }
        });
    });
}

app.on("before-quit", () => {
    forceQuit = true;
});

/**
 * Close out application unless if instructed to relaunch.
 */
App.on("window-all-closed", function () {
    if (app.shouldRelaunch) {
        const options: RelaunchOptions = {
            args: process.argv.slice(1).concat(["--relaunch"]),
        };

        if (App.isPackaged && process.env.APPIMAGE) {
            execFile(process.env.APPIMAGE, options.args);
        } else {
            App.relaunch(options);
        }

        App.quit();
        return;
    }

    if (process.platform !== "darwin") App.quit();
});

/**
 * Add navigation handlers.
 */
App.on("web-contents-created", (_, contents) => {
    contents.on("will-navigate", (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);

        if (parsedUrl.origin !== getBuildURL()) {
            event.preventDefault();
        }
    });

    contents.setWindowOpenHandler(({ url }) => {
        if (
            url.startsWith("http:") ||
            url.startsWith("https:") ||
            url.startsWith("mailto:")
        ) {
            setImmediate(() => {
                shell.openExternal(url);
            });
        }

        return { action: "deny" };
    });
});
