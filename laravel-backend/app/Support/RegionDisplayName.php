<?php

namespace App\Support;

use App\Models\GazetteerRegion;

/**
 * Presentation-layer formatting for gazetteer region names.
 *
 * The rule this enforces: `gazetteer_regions.name` always stores the official name
 * exactly as the issuing authority writes it -- "County Dublin", "Co. Cork", "County
 * Galway" -- and is never stripped, abbreviated, or normalised on write. That column is
 * the source of truth and other systems read it, so it stays official.
 *
 * The UI, however, wants "Dublin" not "County Dublin": the level is already obvious from
 * context, "County" is noise in a compact chip or filter label, and it eats horizontal
 * space next to an avatar. So the stripping happens here, at the edge, on the way to
 * display -- never in the database.
 *
 * This is deliberately a pure string helper rather than an accessor on GazetteerRegion.
 * An accessor would change what `$region->name` returns, which would mean the API
 * silently serves abbreviated geography to any consumer that is not a human-facing UI,
 * and would make the stored value indistinguishable from the official one. Keeping it
 * separate means `name` stays official everywhere and callers opt in.
 *
 * Usage, once a transformer or endpoint is actually wired up:
 *
 *     'name'         => $region->name,                               // official
 *     'display_name' => RegionDisplayName::shorten($region->name),   // 'Dublin'
 *
 * Nothing calls this yet. There is no region endpoint to attach it to, and no
 * gazetteer_regions rows in the live database.
 */
final class RegionDisplayName
{
    /**
     * Prefixes removed from the front of a region name.
     *
     * Order matters only for readability: 'Co.' is listed before the bare 'Co', and
     * 'County' before both. Matching is case-insensitive, so "county dublin" and
     * "CO. CORK" are handled too -- seeded or imported data is not guaranteed to be
     * consistently cased.
     *
     * @var list<string>
     */
    private const COUNTY_PREFIXES = [
        'County',
        'Co.',
        'Co',
    ];

    /**
     * Region types whose name may carry a county prefix. Only these are stripped.
     *
     * A city or country that legitimately begins with "Co" -- "Cork City", "Costa Rica",
     * "Cologne" -- is never touched, because those are the name, not a prefix.
     * Constraining stripping by type is what makes this safe rather than a blanket
     * regex over every region name.
     *
     * @var list<string>
     */
    private const COUNTY_LEVEL_TYPES = [
        'county',
    ];

    /**
     * Return the name to show in the UI, with any county prefix removed.
     *
     * Strips a leading "County" / "Co." / "Co" and collapses the whitespace left behind,
     * so " Co. Cork " becomes "Cork" rather than " Cork".
     *
     * $type gates the stripping: pass the region type and a county prefix is only
     * removed from county-level names. Pass null and nothing is stripped, because we
     * cannot tell a prefix from a real name without the type. That fail-safe default
     * means a caller who forgets to pass the type sees the official name rather than a
     * mangled one.
     *
     * @param  string|null  $name
     * @param  string|null  $type  gazetteer_regions.type, e.g. 'county', 'city'
     */
    public static function shorten($name, $type = null): string
    {
        if (! is_string($name)) {
            return '';
        }

        $trimmed = trim($name);

        if ($trimmed === '') {
            return '';
        }

        if ($type === null || ! in_array($type, self::COUNTY_LEVEL_TYPES, true)) {
            return $trimmed;
        }

        return self::stripCountyPrefix($trimmed);
    }

    /**
     * Remove a leading county prefix, if there is one.
     *
     * Anchored at the start and bounded by requiring whitespace-or-end after the prefix,
     * which is what stops "Cork City" from becoming "rk City" via the bare 'Co' rule and
     * stops "Cortland" being cut down to "tland".
     *
     * If stripping would leave nothing -- a region genuinely named just "County" -- the
     * original is returned, because an empty label is worse than a verbose one.
     */
    private static function stripCountyPrefix(string $name): string
    {
        foreach (self::COUNTY_PREFIXES as $prefix) {
            $pattern = '/^'.preg_quote($prefix, '/').'\.?[\s]+/i';

            if (preg_match($pattern, $name, $matches) === 1) {
                $remainder = trim(substr($name, strlen($matches[0])));

                if ($remainder !== '') {
                    return $remainder;
                }
            }
        }

        return $name;
    }

    /**
     * Shorten a loaded region model for display.
     */
    public static function forRegion(GazetteerRegion $region): string
    {
        return self::shorten($region->name, $region->type);
    }
}
