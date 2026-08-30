<?php

namespace App\Http\Resources;

use App\Models\Story;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StoryResource extends JsonResource
{
    public static $wrap = null;

    /**
     * @param  Story  $story
     * @return array<string, mixed>
     */
    public static function payload(Story $story, bool $hasViewer = false, ?string $viewerId = null): array
    {
        $data = (new static($story))->resolve();

        if ($story->relationLoaded('reactions')) {
            $data['reactions'] = $story->reactions->map(fn ($reaction) => [
                'id' => $reaction->id,
                'user_id' => $reaction->user_id,
                'user_handle' => $reaction->user_handle,
                'emoji' => $reaction->emoji,
                'created_at' => $reaction->created_at,
            ])->values()->all();
            $data['reactions_count'] = (int) ($story->reactions_count ?? $story->reactions->count());
        }

        if ($story->relationLoaded('replies')) {
            $data['replies'] = $story->replies->map(fn ($reply) => [
                'id' => $reply->id,
                'user_id' => $reply->user_id,
                'user_handle' => $reply->user_handle,
                'text' => $reply->text,
                'created_at' => $reply->created_at,
            ])->values()->all();
            $data['replies_count'] = (int) ($story->replies_count ?? $story->replies->count());
        }

        if ($hasViewer) {
            $attrs = $story->getAttributes();
            $data['has_viewed'] = array_key_exists('has_viewed', $attrs)
                ? (bool) $attrs['has_viewed']
                : false;
            $data['user_reaction'] = null;
            if ($story->relationLoaded('reactions') && $viewerId) {
                $data['user_reaction'] = optional(
                    $story->reactions->firstWhere('user_id', $viewerId)
                )->emoji;
            }
        } else {
            $data['has_viewed'] = false;
            $data['user_reaction'] = null;
        }

        return $data;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Story $story */
        $story = $this->resource;
        $data = $story->toArray();

        $data['views_count'] = (int) ($story->views_count ?? $data['views_count'] ?? 0);
        $data['reactions_count'] = (int) ($story->reactions_count ?? $data['reactions_count'] ?? 0);
        $data['replies_count'] = (int) ($story->replies_count ?? $data['replies_count'] ?? 0);

        return $data;
    }
}
