<?php
declare(strict_types=1);

class TelemetryService
{
    public static function getFeederTelemetry(): array
    {
        $ratings = ['DTR-01' => 250.0, 'DTR-02' => 200.0, 'DTR-03' => 160.0];
        $loads = ['DTR-01' => 212.5, 'DTR-02' => 212.5, 'DTR-03' => 150.4];
        $transformers = [];
        foreach ($ratings as $id => $rating) {
            $load = $loads[$id];
            $transformers[] = [
                'dtr_id' => $id,
                'nameplate_kva' => $rating,
                'active_load_kva' => $load,
                'loading_pct' => round(($load / $rating) * 100, 1),
                'source' => 'simulated',
            ];
        }
        return [
            'feeder_id' => 'BESCOM-F11-DEMO',
            'source' => 'demo',
            'transformers' => $transformers,
        ];
    }

    public static function predictForecast(array $loads): array
    {
        $predictions = [];
        foreach (['DTR-01', 'DTR-02', 'DTR-03'] as $id) {
            if (!isset($loads[$id]) || !is_numeric($loads[$id]) || !is_finite((float) $loads[$id]) || (float) $loads[$id] < 0) {
                respond(422, ['error' => 'Valid non-negative loads are required for all three transformers.']);
            }
            $predictions[$id] = round((float) $loads[$id] * 1.03, 1);
        }
        return [
            'horizon' => '15_minutes',
            'source' => 'demo_heuristic',
            'predictions_kva' => $predictions,
            'note' => 'Illustrative estimate only; not a trained or live forecasting model.',
        ];
    }
}
