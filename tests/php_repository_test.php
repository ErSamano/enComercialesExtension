<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/php/repository.php';

assert(DatabaseRepository::matchConfidence('Vino Ejemplo Reserva 2019 750 ml', 'Vino Ejemplo Reserva 2019 750 ML') === 'EXACT');
assert(DatabaseRepository::matchConfidence('Vino Ejemplo Reserva 2019 750 ml', 'Vino Ejemplo Reserva 2021 750 ml') === 'LOW');
assert(DatabaseRepository::matchConfidence('Vino Ejemplo Reserva 2019 750 ml', 'Vino Ejemplo Reserva 2019 1.5 L') === 'LOW');
assert(DatabaseRepository::matchConfidence('Vino Ejemplo Reserva 2019 6 x 750 ml', 'Vino Ejemplo Reserva 2019 1 x 750 ml') === 'LOW');
assert(DatabaseRepository::rating(['observations' => 5, 'low' => 80.0, 'average' => 100.0], ['price' => 90.0])['category'] === 'GREAT DEAL');
assert(DatabaseRepository::rating(['observations' => 2, 'low' => 80.0, 'average' => 100.0], ['price' => 90.0])['category'] === 'INSUFFICIENT DATA');
echo "php repository rules ok\n";
