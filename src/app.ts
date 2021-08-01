import { contextBridge, ipcRenderer } from 'electron';

type NonFunctionPropertyNames<T> = {
    [K in keyof T]: T[K] extends Function ? never : K;
  }[keyof T];

export type Build = 'stable' | 'nightly' | 'dev';
export type ConfigData = Pick<Config, NonFunctionPropertyNames<Config>>;

class Config {
    frame: boolean = false;
    build: Build = 'stable';

    apply(data: Partial<ConfigData>) {
        Object.assign(this, data);
    }

    setFrame(frame: boolean) {
        this.frame = frame;
        ipcRenderer.send('set', { frame })
    }

    setBuild(build: Build) {
        this.build = build;
        ipcRenderer.send('set', { build })
    }
}

let config = new Config();
ipcRenderer.on('config', (_, data) => config.apply(data));

contextBridge.exposeInMainWorld("isNative", true);
contextBridge.exposeInMainWorld("nativeVersion", "1.0.0");
contextBridge.exposeInMainWorld(
    "native", {
        min: () => ipcRenderer.send('min'),
        max: () => ipcRenderer.send('max'),
        close: () => ipcRenderer.send('close'),
        reload: () => ipcRenderer.send('reload'),
        relaunch: () => ipcRenderer.send('relaunch'),

        getConfig: () => config,
        setFrame: (v: boolean) => config.setFrame(v),
        setBuild: (v: Build) => config.setBuild(v),

        getAutoStart: () => new Promise(resolve => {
            ipcRenderer.send('getAutoStart')
            ipcRenderer.on('autoStart', (_, arg) => resolve(arg))
        }),
        enableAutoStart: () => new Promise(resolve => {
            ipcRenderer.send('setAutoStart', true)
            ipcRenderer.on('autoStart', (_, arg) => resolve(arg))
        }),
        disableAutoStart: () => new Promise(resolve => {
            ipcRenderer.send('setAutoStart', false)
            ipcRenderer.on('autoStart', (_, arg) => resolve(arg))
        })
    }
);

// https://stackoverflow.com/a/59814127
