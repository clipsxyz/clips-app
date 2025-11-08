import React from 'react';
import { FiX, FiMoreVertical, FiScissors } from 'react-icons/fi';
import type { MediaClip } from '../types';

type TimelineProps = {
    clips: MediaClip[];
    currentTime: number;
    totalDuration: number;
    selectedClipId: string | null;
    onTimeChange: (time: number) => void;
    onClipSelect: (clipId: string) => void;
    onSplitClip: (clipId: string, time: number) => void;
    onReorderClips: (fromIndex: number, toIndex: number) => void;
    onTrimClip: (clipId: string, trimStart: number, trimEnd: number) => void;
    onDeleteClip: (clipId: string) => void;
};

export default function Timeline({
    clips,
    currentTime,
    totalDuration,
    selectedClipId,
    onTimeChange,
    onClipSelect,
    onSplitClip,
    onReorderClips,
    onTrimClip,
    onDeleteClip
}: TimelineProps) {
    const timelineRef = React.useRef<HTMLDivElement>(null);
    const [draggedClipId, setDraggedClipId] = React.useState<string | null>(null);
    const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const time = percentage * totalDuration;
        onTimeChange(time);
    };

    const handleClipDragStart = (e: React.DragEvent, clipId: string, index: number) => {
        setDraggedClipId(clipId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleClipDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIndex(index);
    };

    const handleClipDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedClipId === null) return;

        const dragIndex = clips.findIndex(c => c.id === draggedClipId);
        if (dragIndex !== -1 && dragIndex !== dropIndex) {
            onReorderClips(dragIndex, dropIndex);
        }

        setDraggedClipId(null);
        setDragOverIndex(null);
    };

    const handleClipDragEnd = () => {
        setDraggedClipId(null);
        setDragOverIndex(null);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="w-full">
            {/* Time indicators */}
            <div className="flex items-center justify-between mb-2 px-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTime(currentTime)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTime(totalDuration)}
                </span>
            </div>

            {/* Timeline track */}
            <div
                ref={timelineRef}
                onClick={handleTimelineClick}
                className="relative h-20 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-x-auto cursor-pointer"
            >
                <div className="relative h-full flex items-center" style={{ width: `${Math.max(100, (totalDuration / 5) * 100)}%` }}>
                    {/* Clips */}
                    {clips.map((clip, index) => {
                        const left = (clip.startTime / totalDuration) * 100;
                        const width = (clip.duration / totalDuration) * 100;
                        const isSelected = selectedClipId === clip.id;
                        const isDragging = draggedClipId === clip.id;
                        const isDragOver = dragOverIndex === index;

                        return (
                            <div
                                key={clip.id}
                                draggable
                                onDragStart={(e) => handleClipDragStart(e, clip.id, index)}
                                onDragOver={(e) => handleClipDragOver(e, index)}
                                onDrop={(e) => handleClipDrop(e, index)}
                                onDragEnd={handleClipDragEnd}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClipSelect(clip.id);
                                }}
                                className={`absolute h-full rounded border-2 transition-all ${isSelected
                                    ? 'border-blue-500 bg-blue-100 dark:bg-blue-900'
                                    : 'border-gray-400 dark:border-gray-500 bg-gray-300 dark:bg-gray-600'
                                    } ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'ring-2 ring-blue-400' : ''}`}
                                style={{
                                    left: `${left}%`,
                                    width: `${width}%`,
                                    minWidth: '40px'
                                }}
                            >
                                <div className="h-full flex items-center justify-center p-1">
                                    {clip.type === 'video' ? (
                                        <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 rounded flex items-center justify-center">
                                            <span className="text-white text-xs font-semibold">VID</span>
                                        </div>
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-green-500 to-teal-500 rounded flex items-center justify-center">
                                            <span className="text-white text-xs font-semibold">IMG</span>
                                        </div>
                                    )}
                                </div>

                                {/* Clip controls */}
                                {isSelected && (
                                    <div className="absolute -top-8 left-0 right-0 flex items-center justify-center gap-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSplitClip(clip.id, clip.startTime + clip.duration / 2);
                                            }}
                                            className="p-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                                            title="Split clip"
                                        >
                                            <FiScissors className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteClip(clip.id);
                                            }}
                                            className="p-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                                            title="Delete clip"
                                        >
                                            <FiX className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}

                                {/* Drag handle */}
                                <div className="absolute left-0 top-0 bottom-0 w-2 cursor-move flex items-center justify-center bg-gray-400 dark:bg-gray-500 opacity-50 hover:opacity-100 transition-opacity">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
                                        <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
                                        <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Playhead */}
                    <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                        style={{ left: `${(currentTime / totalDuration) * 100}%` }}
                    >
                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full" />
                    </div>
                </div>
            </div>

            {/* Clip info */}
            {selectedClipId && (
                <div className="mt-2 px-2">
                    {(() => {
                        const clip = clips.find(c => c.id === selectedClipId);
                        if (!clip) return null;
                        return (
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                                <span className="font-medium">{clip.type === 'video' ? 'Video' : 'Image'}</span>
                                {' • '}
                                <span>Duration: {formatTime(clip.duration)}</span>
                                {(clip.trimStart > 0 || clip.trimEnd > 0) && (
                                    <>
                                        {' • '}
                                        <span>Trimmed: {formatTime(clip.trimStart)} - {formatTime(clip.trimEnd)}</span>
                                    </>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}

