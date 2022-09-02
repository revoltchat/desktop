import { contextBridge, ipcRenderer } from "electron";

type NonFunctionPropertyNames<T> = {
    [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];

export type Build = "stable" | "nightly" | "dev";
export type ConfigData = Pick<Config, NonFunctionPropertyNames<Config>>;

class Config {
    frame: boolean = true;
    build: Build = "stable";
    discordRPC: boolean = true;
    minimiseToTray: boolean = true;
    hardwareAcceleration: boolean = true;

    apply(data: Partial<ConfigData>) {
        Object.assign(this, data);
    }

    set(key: string, value: any) {
        // @ts-expect-error
        this[key] = value;
        ipcRenderer.send("set", { [key]: value });
    }
}

let config = new Config();
ipcRenderer.on("config", (_, data) => config.apply(data));

contextBridge.exposeInMainWorld("isNative", true);
contextBridge.exposeInMainWorld("nativeVersion", "1.0.6");
contextBridge.exposeInMainWorld("native", {
    min: () => ipcRenderer.send("min"),
    max: () => ipcRenderer.send("max"),
    close: () => ipcRenderer.send("close"),
    reload: () => ipcRenderer.send("reload"),
    relaunch: () => ipcRenderer.send("relaunch"),

    getConfig: () => config,
    set: (k: string, v: any) => config.set(k, v),

    getAutoStart: () =>
        new Promise((resolve) => {
            ipcRenderer.send("getAutoStart");
            ipcRenderer.on("autoStart", (_, arg) => resolve(arg));
        }),
    enableAutoStart: () =>
        new Promise((resolve) => {
            ipcRenderer.send("setAutoStart", true);
            ipcRenderer.on("autoStart", (_, arg) => resolve(arg));
        }),
    disableAutoStart: () =>
        new Promise((resolve) => {
            ipcRenderer.send("setAutoStart", false);
            ipcRenderer.on("autoStart", (_, arg) => resolve(arg));
        }),
});
