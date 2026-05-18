<?php

namespace App\Services;

/**
 * Maps Google Places (or gazetteer) address parts to Gazetteer feed tiers:
 * national = country, regional = city/metro (or state), local = neighbourhood when distinct.
 */
class PlaceFeedLevelParser
{
    /**
     * @param  array<int, array{value?: string}>  $terms
     * @return array{local: string, regional: string, national: string, display_name: string, feed_level: string}
     */
    public function parse(array $terms, string $description): array
    {
        $values = [];
        foreach ($terms as $term) {
            if (!is_array($term)) {
                continue;
            }
            $value = trim((string) ($term['value'] ?? ''));
            if ($value !== '') {
                $values[] = $value;
            }
        }

        $parts = array_values(array_filter(array_map('trim', explode(',', $description))));
        if ($values === [] && $parts !== []) {
            $values = $parts;
        }

        $partsCount = count($parts) > 0 ? count($parts) : count($values);
        $parsedLocal = $values[0] ?? ($parts[0] ?? $description);
        $parsedNational = $values !== [] ? (string) $values[count($values) - 1] : '';

        if ($parsedNational === '') {
            $parsedNational = $parsedLocal;
        }

        // Regional = city / metro. For "Paris, France" use Paris — not France.
        if (count($values) >= 3) {
            $parsedRegional = (string) $values[count($values) - 2];
        } elseif (count($values) === 2) {
            $parsedRegional = (string) $values[0];
        } else {
            $parsedRegional = $parsedLocal;
        }

        if (
            count($values) === 2
            && $this->norm($parsedRegional) === $this->norm($parsedNational)
        ) {
            $parsedRegional = (string) $values[0];
        }

        $feedLevel = 'local';
        $displayName = $parsedLocal;

        if (count($values) <= 1) {
            $feedLevel = 'national';
            $displayName = $parsedNational;
            $parsedLocal = $displayName;
            $parsedRegional = $displayName;
        } elseif (count($values) === 2) {
            $feedLevel = 'regional';
            $displayName = $parsedLocal;
        }

        return [
            'local' => $parsedLocal,
            'regional' => $parsedRegional,
            'national' => $parsedNational,
            'display_name' => $displayName,
            'feed_level' => $feedLevel,
        ];
    }

    private function norm(string $value): string
    {
        return strtolower(trim($value));
    }
}
