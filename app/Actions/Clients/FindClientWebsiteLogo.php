<?php

namespace App\Actions\Clients;

use App\Services\Images\PublicWebsite;
use Dom\HTMLDocument;
use GuzzleHttp\Psr7\Uri;
use GuzzleHttp\Psr7\UriResolver;
use InvalidArgumentException;
use Psr\Http\Message\UriInterface;

class FindClientWebsiteLogo
{
    public function __construct(private readonly PublicWebsite $website) {}

    /** @return array{image: string, mime: string, source: 'apple-touch'|'favicon'}|null */
    public function handle(string $website): ?array
    {
        try {
            $url = new Uri($website);
        } catch (InvalidArgumentException) {
            return null;
        }

        $deadline = microtime(true) + 8;
        $page = $this->website->get($url, 1024 * 1024, $deadline);
        $pageUrl = $page['url'] ?? $url;
        $candidates = $this->candidates($pageUrl, $page['body'] ?? '');
        $best = null;
        $bestSize = 0;
        $seen = [];

        foreach ($candidates as $candidate) {
            $key = (string) $candidate['url'];
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;

            $asset = $this->website->get($candidate['url'], 1024 * 1024, $deadline);
            if ($asset === null || ($info = $this->imageInfo($asset['body'])) === null) {
                continue;
            }

            $logo = [
                'image' => base64_encode($asset['body']),
                'mime' => $info['mime'],
                'source' => $candidate['source'],
            ];

            if (($logo['source'] === 'apple-touch' && $info['size'] >= 64) || $info['size'] >= 128) {
                return $logo;
            }

            if ($info['size'] > $bestSize) {
                $best = $logo;
                $bestSize = $info['size'];
            }
        }

        return $best;
    }

    /** @return list<array{url: UriInterface, source: 'apple-touch'|'favicon', size: int}> */
    private function candidates(UriInterface $page, string $html): array
    {
        $candidates = ['apple-touch' => [], 'favicon' => []];
        if ($html !== '') {
            $document = HTMLDocument::createFromString($html, LIBXML_NOERROR);
            $base = $document->head?->querySelector('base[href]')?->getAttribute('href');
            $baseUrl = $this->resolve($page, $base ?? '') ?? $page;

            foreach ($document->head?->getElementsByTagName('link') ?? [] as $link) {
                $relations = preg_split('/\s+/', strtolower($link->getAttribute('rel') ?? '')) ?: [];
                $source = array_intersect($relations, ['apple-touch-icon', 'apple-touch-icon-precomposed']) !== []
                    ? 'apple-touch'
                    : (in_array('icon', $relations, true) ? 'favicon' : null);

                if ($source === null || strtolower($link->getAttribute('type') ?? '') === 'image/svg+xml') {
                    continue;
                }

                $url = $this->resolve($baseUrl, $link->getAttribute('href') ?? '');
                if ($url === null || str_ends_with(strtolower($url->getPath()), '.svg')) {
                    continue;
                }

                preg_match_all('/\b(\d+)x(\d+)\b/i', $link->getAttribute('sizes') ?? '', $sizes, PREG_SET_ORDER);
                $size = max([0, ...array_map(fn (array $pair) => min((int) $pair[1], (int) $pair[2]), $sizes)]);
                $candidates[$source][] = ['url' => $url, 'source' => $source, 'size' => $size];
            }
        }

        foreach ($candidates as &$icons) {
            usort($icons, fn (array $a, array $b) => $b['size'] <=> $a['size']);
        }

        return [
            ...array_slice($candidates['apple-touch'], 0, 2),
            ['url' => UriResolver::resolve($page, new Uri('/apple-touch-icon.png')), 'source' => 'apple-touch', 'size' => 0],
            ...array_slice($candidates['favicon'], 0, 4),
            ['url' => UriResolver::resolve($page, new Uri('/favicon.ico')), 'source' => 'favicon', 'size' => 0],
        ];
    }

    private function resolve(UriInterface $base, string $reference): ?UriInterface
    {
        $reference = trim($reference);
        if ($reference === '') {
            return null;
        }

        try {
            return UriResolver::resolve($base, new Uri($reference))->withFragment('');
        } catch (InvalidArgumentException) {
            return null;
        }
    }

    /** @return array{mime: string, size: int}|null */
    private function imageInfo(string $bytes): ?array
    {
        $info = @getimagesizefromstring($bytes);
        if ($info === false || min($info[0], $info[1]) < 1 || max($info[0], $info[1]) > 1024) {
            return null;
        }

        if ($info[2] === IMAGETYPE_ICO) {
            // ICO decoding is handled by the browser before the preview is converted to PNG.
            return ['mime' => 'image/x-icon', 'size' => min($info[0], $info[1])];
        }

        if (! in_array($info[2], [IMAGETYPE_PNG, IMAGETYPE_JPEG, IMAGETYPE_WEBP, IMAGETYPE_GIF], true) || @imagecreatefromstring($bytes) === false) {
            return null;
        }

        return ['mime' => $info['mime'], 'size' => min($info[0], $info[1])];
    }
}
