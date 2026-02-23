import React, { useState, useEffect } from 'react';
import { FiUser } from 'react-icons/fi';
import { unifiedSearch } from '../api/search';
import { getAvatarForHandle } from '../api/users';

interface TaggedAvatarsProps {
    taggedUserHandles: string[];
    onShowTaggedUsers: () => void;
    className?: string;
}

function SmallAvatar({ src, name }: { src?: string; name: string }) {
    const initial = (name || '?').trim().charAt(0).toUpperCase();
    return (
        <span className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-white/20 text-white text-[10px] font-semibold ring-[1.5px] ring-black">
            {src ? (
                <img src={src} alt="" className="w-full h-full object-cover" />
            ) : (
                <span>{initial}</span>
            )}
        </span>
    );
}

/** First 3 tagged users' profile pics + "X people tagged" text. Fetches avatars for handles. */
export default function TaggedAvatars({ taggedUserHandles, onShowTaggedUsers, className = '' }: TaggedAvatarsProps) {
    const [avatars, setAvatars] = useState<Array<{ handle: string; avatar_url?: string; display_name?: string }>>([]);

    const handlesToShow = taggedUserHandles.slice(0, 3);

    useEffect(() => {
        if (handlesToShow.length === 0) {
            setAvatars([]);
            return;
        }
        let cancelled = false;
        (async () => {
            const withFallback = handlesToShow.map(handle => ({
                handle,
                avatar_url: getAvatarForHandle(handle) || undefined,
                display_name: undefined as string | undefined
            }));
            setAvatars(withFallback);
            if (cancelled) return;

            try {
                const results = await Promise.all(
                    handlesToShow.map(async (handle) => {
                        try {
                            const result = await unifiedSearch({
                                q: handle,
                                types: 'users',
                                usersLimit: 1
                            });
                            const user = result.sections?.users?.items?.find(
                                (u: { handle?: string }) => u.handle?.toLowerCase() === handle.toLowerCase()
                            );
                            if (user) {
                                return {
                                    handle,
                                    avatar_url: user.avatar_url ?? getAvatarForHandle(handle),
                                    display_name: user.display_name
                                };
                            }
                        } catch {
                            // ignore
                        }
                        return {
                            handle,
                            avatar_url: getAvatarForHandle(handle),
                            display_name: undefined
                        };
                    })
                );
                if (!cancelled) setAvatars(results);
            } catch {
                if (!cancelled) setAvatars(withFallback);
            }
        })();
        return () => { cancelled = true; };
    }, [handlesToShow.join(',')]);

    const count = taggedUserHandles.length;
    const label = count === 1 ? '1 person tagged' : `${count} people tagged`;

    return (
        <div className={`px-4 pt-2 pb-1 flex items-center ${className}`}>
            <button
                type="button"
                onClick={onShowTaggedUsers}
                className="inline-flex items-center gap-2 text-xs text-gray-300 hover:text-white"
            >
                <span className="flex -space-x-1.5">
                    {avatars.length > 0
                        ? avatars.map((u, i) => (
                              <span
                                  key={u.handle}
                                  className="inline-block"
                                  style={{ zIndex: avatars.length - i }}
                              >
                                  <SmallAvatar
                                      src={u.avatar_url}
                                      name={u.display_name || u.handle}
                                  />
                              </span>
                          ))
                        : (
                              <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center ring-[1.5px] ring-black">
                                  <FiUser className="w-3.5 h-3.5" />
                              </span>
                          )}
                </span>
                <span>{label}</span>
            </button>
        </div>
    );
}
