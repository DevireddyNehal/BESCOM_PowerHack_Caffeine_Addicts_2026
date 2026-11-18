<?php
declare(strict_types=1);

class TelemetryController
{
    public static function handleTelemetry(): void
    {
        requireMethod('GET');
        respond(200, TelemetryService::getFeederTelemetry());
    }

    public static function handleSimulateTransfer(): void
    {
        requireMethod('POST');
        $request = readJsonBody();
        $ratings = ['DTR-01' => 250.0, 'DTR-02' => 200.0, 'DTR-03' => 160.0];
        $loads = $request['base_loads_kva'] ?? ['DTR-01' => 212.5, 'DTR-02' => 212.5, 'DTR-03' => 150.4];
        if (!is_array($loads)) {
            respond(422, ['error' => 'base_loads_kva must be an object.']);
        }
        $validatedLoads = [];
        foreach ($ratings as $id => $rating) {
            if (!isset($loads[$id]) || !is_numeric($loads[$id])
                || !is_finite((float) $loads[$id]) || (float) $loads[$id] < 0) {
                respond(422, ['error' => 'Valid non-negative base loads are required for all three transformers.']);
            }
            $validatedLoads[$id] = (float) $loads[$id];
        }
        $t12 = numberField($request, 'tie_12_kva_to_dtr01', 0);
        $t13 = numberField($request, 'tie_13_kva_to_dtr01', 0);
        $t23 = numberField($request, 'tie_23_kva_to_dtr03', 0);
        if (!is_finite($t12) || !is_finite($t13) || !is_finite($t23)
            || abs($t12) > 60 || abs($t13) > 50 || abs($t23) > 40) {
            respond(422, ['error' => 'Transfer must be finite and within demo tie-link capacities.']);
        }

        respond(200, SimulationService::simulateTransfer($validatedLoads, $t12, $t13, $t23));
    }

    public static function handleForecast(): void
    {
        requireMethod('POST');
        $request = readJsonBody();
        $loads = $request['loads_kva'] ?? ['DTR-01' => 212.5, 'DTR-02' => 212.5, 'DTR-03' => 150.4];
        if (!is_array($loads)) {
            respond(422, ['error' => 'loads_kva must be an object.']);
        }
        respond(200, TelemetryService::predictForecast($loads));
    }
}
