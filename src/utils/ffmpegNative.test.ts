import { beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.fn();
const isSuccess = vi.fn();

vi.mock('ffmpeg-kit-react-native-alt', () => ({
    FFmpegKit: { execute },
    ReturnCode: { isSuccess },
}));

describe('executeFfmpeg session logging', () => {
    beforeEach(() => {
        execute.mockReset();
        isSuccess.mockReset();
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    it('logs command + output and throws on failed return code', async () => {
        execute.mockResolvedValue({
            getReturnCode: async () => ({ getValue: () => 1 }),
            getOutput: async () => 'ffmpeg stderr blob',
            getAllLogsAsString: async () => 'all logs',
            getFailStackTrace: async () => 'native fail stack',
            getState: async () => 2,
        });
        isSuccess.mockReturnValue(false);

        const { executeFfmpeg } = await import('./ffmpegNative');
        await expect(executeFfmpeg('-ss 0 -i in.mp4 -t 15 -y out.mp4')).rejects.toThrow(
            /FFmpeg failed to trim video: native fail stack/,
        );

        expect(console.log).toHaveBeenCalledWith(
            '[FFmpeg Log] command:',
            '-ss 0 -i in.mp4 -t 15 -y out.mp4',
        );
        expect(console.log).toHaveBeenCalledWith(
            '[FFmpeg Log]',
            expect.stringContaining('ffmpeg stderr blob'),
        );
    });

    it('resolves when ReturnCode.isSuccess is true', async () => {
        execute.mockResolvedValue({
            getReturnCode: async () => ({ getValue: () => 0 }),
            getOutput: async () => 'ok',
            getAllLogsAsString: async () => 'ok logs',
            getFailStackTrace: async () => '',
            getState: async () => 3,
        });
        isSuccess.mockReturnValue(true);

        const { executeFfmpeg } = await import('./ffmpegNative');
        await expect(executeFfmpeg('-y -i in.mp4 out.mp4')).resolves.toBeUndefined();
        expect(console.log).toHaveBeenCalledWith('[FFmpeg Log]', expect.stringContaining('ok'));
    });
});
