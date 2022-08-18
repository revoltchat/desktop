import { autoUpdater } from "electron-updater";

export function autoUpdate() {
    if (process.platform === "win32") {
        if (process.windowsStore) {
            return;
        }
    }

    if (process.platform === "linux") {
        if (typeof process.env.APP_IMAGE === "undefined") {
            return;
        }
    }

    autoUpdater.checkForUpdatesAndNotify();
}
