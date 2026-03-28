<?php

namespace App\Services;

use App\Models\Post;
use App\Models\User;

/**
 * Server-side place matching for feed suggestions (aligned with src/utils/suggestedPlaces.ts).
 */
class SuggestedPlacesService
{
    /**
     * @return list<string>
     */
    public static function parsePlacesFromBio(?string $bio): array
    {
        if ($bio === null || $bio === '') {
            return [];
        }
        $parts = preg_split('/[,;.\n\r]|\s+and\s+|\s*[\x{2013}\x{2014}\-]\s*|:\s+/iu', $bio, -1, PREG_SPLIT_NO_EMPTY);
        $out = [];
        foreach ($parts as $part) {
            $p = trim($part);
            if (mb_strlen($p) >= 2) {
                $out[] = $p;
            }
        }
        $out = array_values(array_unique($out));
        if (count($out) === 0 && mb_strlen(trim($bio)) >= 2) {
            return [trim($bio)];
        }

        return $out;
    }

    public static function norm(string $s): string
    {
        $s = mb_strtolower($s);
        $s = preg_replace('/\s+/u', ' ', $s) ?? '';

        return trim($s);
    }

    /**
     * @param  list<string>|null  $placesTraveledExtra  From request body until all clients persist to DB
     * @return array{home: array<string, true>, traveled: array<string, true>}
     */
    public static function collectBuckets(User $user, ?array $placesTraveledExtra): array
    {
        $home = [];
        $traveled = [];

        $add = function (array &$set, ?string $raw) {
            if ($raw === null) {
                return;
            }
            $n = self::norm($raw);
            if (mb_strlen($n) >= 2) {
                $set[$n] = true;
            }
        };

        $add($home, $user->location_local);
        $add($home, $user->location_regional);
        $add($home, $user->location_national);

        $dbPlaces = $user->places_traveled;
        if (is_array($dbPlaces)) {
            foreach ($dbPlaces as $p) {
                if (is_string($p)) {
                    $add($traveled, $p);
                }
            }
        }
        if (is_array($placesTraveledExtra)) {
            foreach ($placesTraveledExtra as $p) {
                if (is_string($p)) {
                    $add($traveled, $p);
                }
            }
        }
        foreach (self::parsePlacesFromBio($user->bio) as $p) {
            $add($traveled, $p);
        }

        return ['home' => $home, 'traveled' => $traveled];
    }

    /**
     * @return list<array{value: string, weight: int}>
     */
    public static function postCandidates(Post $post, bool $includePosterRegionalNational): array
    {
        $list = [];
        $push = function (?string $v, int $weight) use (&$list) {
            if ($v === null) {
                return;
            }
            $t = trim($v);
            if (mb_strlen($t) < 2) {
                return;
            }
            $list[] = ['value' => $t, 'weight' => $weight];
        };

        $push($post->venue, 4);
        $push($post->landmark, 4);
        $push($post->location_label, 2);

        $author = $post->relationLoaded('user') ? $post->user : null;
        if ($author) {
            $push($author->location_local, 1);
            if ($includePosterRegionalNational) {
                $push($author->location_regional, 1);
                $push($author->location_national, 1);
            }
        }

        usort($list, fn ($a, $b) => $b['weight'] <=> $a['weight']);

        return $list;
    }

    public static function signalMatchesField(string $signalNorm, string $fieldRaw): bool
    {
        $f = self::norm($fieldRaw);
        if ($signalNorm === '' || $f === '') {
            return false;
        }
        if ($signalNorm === $f) {
            return true;
        }
        if (mb_strlen($signalNorm) >= 3 && str_contains($f, $signalNorm)) {
            return true;
        }
        if (mb_strlen($f) >= 3 && str_contains($signalNorm, $f)) {
            return true;
        }
        $sw = array_filter(preg_split('/\s+/u', $signalNorm) ?: [], fn ($w) => mb_strlen($w) >= 3);
        $fw = array_filter(preg_split('/[\s,]+/u', $f) ?: [], fn ($w) => mb_strlen($w) >= 3);
        foreach ($sw as $a) {
            if (in_array($a, $fw, true)) {
                return true;
            }
        }
        foreach ($fw as $a) {
            if (in_array($a, $sw, true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array{home: array<string, true>, traveled: array<string, true>}  $buckets
     * @return array{matched_place: string, reason: string}|null
     */
    public static function findBestMatch(Post $post, array $buckets, bool $includePosterRegionalNational): ?array
    {
        $home = array_keys($buckets['home']);
        $traveled = array_keys($buckets['traveled']);
        if (count($home) === 0 && count($traveled) === 0) {
            return null;
        }

        $candidates = self::postCandidates($post, $includePosterRegionalNational);
        foreach ($candidates as ['value' => $value]) {
            foreach ($traveled as $sig) {
                if (self::signalMatchesField($sig, $value)) {
                    return ['matched_place' => trim($value), 'reason' => 'places_traveled'];
                }
            }
            foreach ($home as $sig) {
                if (self::signalMatchesField($sig, $value)) {
                    return ['matched_place' => trim($value), 'reason' => 'home_area'];
                }
            }
        }

        return null;
    }
}
