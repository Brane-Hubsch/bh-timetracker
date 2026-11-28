import { Button, ProgressBar } from '@heroui/react';
import { useTranslation } from '@/lib/i18n';
import type { SnowGame, SnowTool } from '@/lib/snow/protocol';

function clock(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);

    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * The snowman game's scoreboard, above the drift while a tool is in use: how far the snowman has come,
 * the time, and how the tool in hand works. When the snowman is finished it shows the time to beat.
 */
export function SnowGameHud({
    tool,
    game,
    bestMs,
    isRecord,
    onRebuild,
}: {
    tool: Exclude<SnowTool, null>;
    game: SnowGame;
    bestMs: number | null;
    isRecord: boolean;
    onRebuild: () => void;
}) {
    const { t } = useTranslation();
    const isDone = game.phase === 'done';
    const percent = Math.round(game.progress * 100);

    return (
        <div
            className="pointer-events-none fixed bottom-40 left-1/2 z-40 w-[min(21rem,calc(100vw-2rem))] -translate-x-1/2 animate-enter rounded-3xl border border-border bg-overlay px-4 py-3.5 text-foreground shadow-overlay"
            data-test="snow-game"
        >
            {isDone ? (
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0" role="status">
                        <p className="text-sm font-semibold">
                            {t('Snowman built in :time', {
                                time: clock(game.elapsedMs),
                            })}
                        </p>
                        <p className="text-xs text-muted">
                            {isRecord
                                ? t('New record!')
                                : bestMs !== null
                                  ? t('Best time :time', {
                                        time: clock(bestMs),
                                    })
                                  : null}
                        </p>
                    </div>
                    <Button
                        size="sm"
                        variant="secondary"
                        onPress={onRebuild}
                        className="pointer-events-auto shrink-0"
                        data-test="snow-game-rebuild"
                    >
                        {t('Build another')}
                    </Button>
                </div>
            ) : (
                <>
                    <ProgressBar
                        aria-label={t('Snowman')}
                        value={percent}
                        className="w-full"
                    >
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="font-semibold">
                                {t('Build the snowman')}
                            </span>
                            <span className="text-xs text-muted tabular-nums">
                                {percent} % · {clock(game.elapsedMs)}
                            </span>
                        </div>
                        <ProgressBar.Track className="h-2">
                            <ProgressBar.Fill />
                        </ProgressBar.Track>
                    </ProgressBar>
                    <p className="mt-2 text-xs text-muted" aria-hidden="true">
                        {tool === 'blower'
                            ? t(
                                  '← → drive · ↑ ↓ aim the chute · Esc parks. Throw the snow onto the outline.',
                              )
                            : t(
                                  'Push slowly to pile the snow, flick to throw it onto the outline. Esc puts the shovel back.',
                              )}
                    </p>
                </>
            )}
        </div>
    );
}
