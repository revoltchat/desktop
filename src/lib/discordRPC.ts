import { Client } from 'discord-rpc';
import { getConfig } from './config';

export var rpc: Client;

export async function connectRPC() {
    if (!getConfig().discordRPC) return;

    try {
        rpc = new Client({ transport: 'ipc' });

        rpc.on('ready', () =>
            rpc.setActivity({
                state: 'revolt.chat',
                details: 'Chatting with others',
                largeImageKey: 'qr',
                largeImageText: 'Communication is critical – use Revolt.',
                buttons: [
                    { label: 'Join Private Beta', url: 'https://campaign.revolt.chat/api/discord-rpc' },
                    { label: 'Website', url: 'https://revolt.chat' }
                ]
            })
        )

        // @ts-expect-error
        rpc.on('disconnected', reconnect)

        rpc.login({ clientId: '872068124005007420' });
    } catch (err) {
        reconnect();
    }
}

const reconnect = () => setTimeout(() => connectRPC(), 1e4);

export async function dropRPC() {
    rpc?.destroy();
}
