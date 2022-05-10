import type { ConfigData } from "./app";

import { app, BrowserWindow, shell, ipcMain, nativeImage } from "electron";
import windowStateKeeper from "electron-window-state";
import { RelaunchOptions } from "electron/main";
import { URL } from "url";
import path from "path";

import { firstRun, getConfig, store, onStart, getBuildURL } from "./lib/config";
import { connectRPC, dropRPC } from "./lib/discordRPC";
import { autoLaunch } from "./lib/autoLaunch";
import { autoUpdate } from "./lib/updater";

const WindowIcon = nativeImage.createFromPath(
    path.join(__dirname, "../build/icons/icon.png"),
);
WindowIcon.setTemplateImage(true);

onStart();
autoUpdate();

let mainWindow: BrowserWindow;
var relaunch: boolean | undefined;

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
            preload: path.resolve(app.getAppPath(), "bundle", "app.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },

        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,

        minWidth: 300,
        minHeight: 300,
    });

    mainWindowState.manage(mainWindow);
    mainWindow.loadURL(getBuildURL());

    mainWindow.webContents.on("did-finish-load", () =>
        mainWindow.webContents.send("config", getConfig()),
    );

    if (process.platform === "win32") {
        app.setAppUserModelId(mainWindow.title);
    }

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
        relaunch = true;
        mainWindow.close();
    });

    ipcMain.on("min", () => mainWindow.minimize());
    ipcMain.on("max", () =>
        mainWindow.isMaximized()
            ? mainWindow.unmaximize()
            : mainWindow.maximize(),
    );
    ipcMain.on("close", () => mainWindow.close());
}

/**
 * Only launch the application once.
 */
const acquiredLock = app.requestSingleInstanceLock();

if (!acquiredLock) {
    app.quit();
} else {
    app.on("second-instance", () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(async () => {
        await firstRun();
        createWindow();

        app.on("activate", function () {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });
}

/**
 * Close out application unless if instructed to relaunch.
 */
app.on("window-all-closed", function () {
    if (relaunch) {
        const options: RelaunchOptions = {
            args: process.argv.slice(1).concat(["--relaunch"]),
            execPath: process.execPath,
        };

        if (app.isPackaged && process.env.APPIMAGE) {
            options.execPath = process.env.APPIMAGE;
            options.args!.unshift("--appimage-extract-and-run");
        }

        app.relaunch(options);
        app.quit();

        return;
    }

    if (process.platform !== "darwin") app.quit();
});

/**
 * Add navigation handlers.
 */
app.on("web-contents-created", (_, contents) => {
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
