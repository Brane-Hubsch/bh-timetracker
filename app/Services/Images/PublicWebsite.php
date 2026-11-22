<?php

namespace App\Services\Images;

use CurlHandle;
use GuzzleHttp\Psr7\Uri;
use InvalidArgumentException;
use Psr\Http\Message\UriInterface;

/** Downloads untrusted website assets on behalf of the client logo picker. */
class PublicWebsite
{
    /** @return array{url: UriInterface, body: string}|null */
    public function get(UriInterface $url, int $byteLimit, float $deadline): ?array
    {
        for ($hop = 0; $hop <= 3; $hop++) {
            $host = $url->getHost();
            $host = $host === '' ? false : idn_to_ascii($host);
            $scheme = $url->getScheme();
            if (! in_array($scheme, ['https', 'http'], true) || $url->getUserInfo() !== '' || $url->getPort() !== null) {
                return null;
            }

            // A DNS name with an alphabetic TLD prefix rules out curl's alternate IP literal forms.
            if ($host === false || filter_var($host, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME) === false || ! preg_match('/\.[a-z][a-z\d-]*$/iD', $host)) {
                return null;
            }

            if (microtime(true) >= $deadline) {
                return null;
            }

            $addresses = $this->publicAddresses($host);
            $remainingMs = (int) (($deadline - microtime(true)) * 1000);
            if ($addresses === [] || $remainingMs <= 0) {
                return null;
            }

            $body = '';
            $port = $scheme === 'https' ? 443 : 80;
            $url = $url->withHost($host)->withFragment('');
            $curl = curl_init((string) $url);
            if ($curl === false) {
                return null;
            }

            // Use only the checked addresses for this request. Redirects repeat the same checks.
            curl_setopt_array($curl, [
                CURLOPT_RESOLVE => ["{$host}:{$port}:".implode(',', $addresses)],
                CURLOPT_PROTOCOLS_STR => 'http,https',
                CURLOPT_PROXY => '',
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_USERAGENT => 'TimeReport Client Logo/1.0',
                CURLOPT_ENCODING => '',
                CURLOPT_CONNECTTIMEOUT_MS => min(1500, $remainingMs),
                CURLOPT_TIMEOUT_MS => min(3000, $remainingMs),
                CURLOPT_WRITEFUNCTION => static function (CurlHandle $handle, string $chunk) use (&$body, $byteLimit): int {
                    $length = strlen($chunk);
                    if (strlen($body) + $length > $byteLimit) {
                        return 0;
                    }

                    $body .= $chunk;

                    return $length;
                },
            ]);

            $success = curl_exec($curl);
            $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
            $location = curl_getinfo($curl, CURLINFO_REDIRECT_URL);
            unset($curl);

            if ($status >= 200 && $status < 300 && $success !== false && $body !== '') {
                return ['url' => $url, 'body' => $body];
            }

            if (! in_array($status, [301, 302, 303, 307, 308], true) || ! is_string($location) || $location === '') {
                return null;
            }

            try {
                $url = new Uri($location);
            } catch (InvalidArgumentException) {
                return null;
            }
        }

        return null;
    }

    /** @return list<string> */
    private function publicAddresses(string $host): array
    {
        $addresses = [];
        // Resolve the absolute name to avoid local resolver search suffixes.
        foreach (@dns_get_record($host.'.', DNS_A | DNS_AAAA) ?: [] as $record) {
            $ip = $record['ip'] ?? $record['ipv6'] ?? null;
            if (! is_string($ip) || filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_GLOBAL_RANGE) === false) {
                continue;
            }

            if (str_contains($ip, ':')) {
                // Only route IPv6 global unicast, excluding translation and multicast prefixes.
                if (preg_match('/^[23]/', $ip)) {
                    $addresses[] = '['.$ip.']';
                }
            } elseif (! preg_match('/^2(?:2[4-9]|3\d)\./', $ip)) {
                $addresses[] = $ip;
            }
        }

        return $addresses;
    }
}
