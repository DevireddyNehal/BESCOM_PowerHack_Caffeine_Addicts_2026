<?php
declare(strict_types=1);

class SimulationService
{
    public static function simulateTransfer(array $loads, float $t12, float $t13, float $t23): array
    {
        $ratings = ['DTR-01' => 250.0, 'DTR-02' => 200.0, 'DTR-03' => 160.0];
        $post = [
            'DTR-01' => $loads['DTR-01'] + $t12 + $t13,
            'DTR-02' => $loads['DTR-02'] - $t12 - $t23,
            'DTR-03' => $loads['DTR-03'] - $t13 + $t23,
        ];
        $loading = [];
        $drop = [];
        foreach ($post as $id => $load) {
            if ($load < 0) {
                respond(422, ['error' => 'Transfer cannot move more load than a transformer carries.']);
            }
            $loading[$id] = round(($load / $ratings[$id]) * 100, 1);
            $drop[$id] = round(($load / $ratings[$id]) * 3.8, 1);
        }
        $overloaded = array_keys(array_filter($loading, static fn (float $pct): bool => $pct >= 100));
        $nearLimit = array_keys(array_filter($loading, static fn (float $pct): bool => $pct >= 90 && $pct < 100));
        $maxDrop = max($drop);

        return [
            'source' => 'demo_heuristic',
            'post_transfer_load_kva' => $post,
            'post_transfer_loading_pct' => $loading,
            'voltage_drop_pct' => $drop,
            'max_voltage_drop_pct' => $maxDrop,
            'voltage_within_6pct' => $maxDrop <= 6,
            'overloaded_transformers' => $overloaded,
            'near_limit_transformers' => $nearLimit,
            'requires_human_approval' => true,
            'autonomous_switching_permitted' => false,
        ];
    }
}
