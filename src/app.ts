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
        ipcRenderer.send('configSet', { frame })
    }

    setBuild(build: Build) {
        this.build = build;
        ipcRenderer.send('configSet', { build })
    }
}

let config = new Config();
ipcRenderer.on('configLoad', (_, data) => config.apply(data));

contextBridge.exposeInMainWorld("isNative", true);
contextBridge.exposeInMainWorld(
    "native", {
        close: () => ipcRenderer.send('close'),
        reload: () => ipcRenderer.send('reload'),

        getConfig: () => config,
        setFrame: (v: boolean) => config.setFrame(v),
        setBuild: (v: Build) => config.setBuild(v),
    }
);

// https://stackoverflow.com/a/59814127
